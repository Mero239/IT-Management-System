import imaplib
import email
import email.header
import json
import ssl
import threading
import time
import os
from paths import data_path
import logging
from datetime import datetime
from typing import Optional

logger = logging.getLogger("email_agent")

CONFIG_PATH = data_path("email_agent_config.json")

DEFAULT_CONFIG = {
    "enabled": False,
    "imap_host": "imap.gmail.com",
    "imap_port": 993,
    "email": "it.support@mobica.net",
    "password": "",
    "poll_interval": 60,
    "ai_provider": "gemini",   # gemini | groq | claude
    "claude_api_key": "",
    "gemini_api_key": "",
    "groq_api_key": "",
    "auto_assign": "",
}


def load_config() -> dict:
    if os.path.exists(CONFIG_PATH):
        with open(CONFIG_PATH) as f:
            cfg = json.load(f)
        return {**DEFAULT_CONFIG, **cfg}
    return DEFAULT_CONFIG.copy()


def save_config(cfg: dict):
    with open(CONFIG_PATH, "w") as f:
        json.dump(cfg, f, indent=2)


def decode_header_value(value: str) -> str:
    parts = email.header.decode_header(value)
    result = []
    for part, charset in parts:
        if isinstance(part, bytes):
            result.append(part.decode(charset or "utf-8", errors="replace"))
        else:
            result.append(part)
    return "".join(result)


def _strip_html(html: str) -> str:
    import re
    text = re.sub(r'<style[^>]*>.*?</style>', ' ', html, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r'<script[^>]*>.*?</script>', ' ', text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r'<[^>]+>', ' ', text)
    text = re.sub(r'&nbsp;', ' ', text)
    text = re.sub(r'&amp;', '&', text)
    text = re.sub(r'&lt;', '<', text)
    text = re.sub(r'&gt;', '>', text)
    text = re.sub(r'\s+', ' ', text)
    return text.strip()


def extract_email_body(msg) -> str:
    plain = ""
    html  = ""
    parts = msg.walk() if msg.is_multipart() else [msg]
    for part in parts:
        ct = part.get_content_type()
        cd = str(part.get("Content-Disposition", ""))
        if "attachment" in cd:
            continue
        payload = part.get_payload(decode=True)
        if not payload:
            continue
        charset = part.get_content_charset() or "utf-8"
        decoded = payload.decode(charset, errors="replace")
        if ct == "text/plain":
            plain += decoded
        elif ct == "text/html":
            html += decoded
    body = plain.strip() or _strip_html(html)
    return body.strip()[:4000]


PROMPT_TEMPLATE = """You are an IT support ticket parser. Extract ticket information from this email.

From: {sender}
Subject: {subject}
Body:
{body}

Return ONLY valid JSON with these exact fields:
- title: short ticket title (max 100 chars)
- description: full problem description
- priority: one of [low, medium, high, critical]
- requester_name: sender full name (or empty string)
- requester_email: sender email address

Example: {{"title": "Laptop screen broken", "description": "Screen has cracks...", "priority": "high", "requester_name": "Ahmed Mohamed", "requester_email": "ahmed@company.com"}}"""


def _extract_json(text: str) -> dict:
    text = text.strip()
    if "```" in text:
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    return json.loads(text.strip())


def parse_with_ai(subject: str, body: str, sender: str, cfg: dict) -> dict:
    provider = cfg.get("ai_provider", "gemini")
    prompt = PROMPT_TEMPLATE.format(sender=sender, subject=subject, body=body[:3000])

    if provider == "gemini":
        from google import genai
        client = genai.Client(api_key=cfg["gemini_api_key"])
        resp = client.models.generate_content(
            model="gemini-2.5-flash-lite",
            contents=prompt,
        )
        return _extract_json(resp.text)

    elif provider == "groq":
        from groq import Groq
        client = Groq(api_key=cfg["groq_api_key"])
        resp = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=512,
            temperature=0.1,
        )
        return _extract_json(resp.choices[0].message.content)

    elif provider == "claude":
        from anthropic import Anthropic
        client = Anthropic(api_key=cfg["claude_api_key"])
        resp = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=512,
            messages=[{"role": "user", "content": prompt}],
        )
        return _extract_json(resp.content[0].text)

    else:
        raise ValueError(f"Unknown ai_provider: {provider}")


class EmailAgent:
    def __init__(self):
        self.config = load_config()
        self.running = False
        self.status = "stopped"
        self.last_check: Optional[str] = None
        self.last_error: Optional[str] = None
        self.tickets_created = 0
        self.emails_processed = 0
        self._thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()

    def reload_config(self):
        self.config = load_config()

    def _connect_imap(self):
        cfg = self.config
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        mail = imaplib.IMAP4_SSL(cfg["imap_host"], cfg["imap_port"], ssl_context=ctx)
        mail.login(cfg["email"], cfg["password"])
        return mail

    def _is_processed(self, message_id: str, db_session) -> bool:
        from models import ProcessedEmail
        return db_session.query(ProcessedEmail).filter(
            ProcessedEmail.message_id == message_id
        ).first() is not None

    def _mark_processed(self, message_id: str, subject: str, sender: str, ticket_id: Optional[int], db_session):
        from models import ProcessedEmail
        rec = ProcessedEmail(
            message_id=message_id,
            subject=subject,
            sender=sender,
            ticket_id=ticket_id,
        )
        db_session.add(rec)
        db_session.commit()

    def _create_ticket(self, ticket_data: dict, message_id: str, db_session) -> int:
        from models import SupportTicket
        ticket = SupportTicket(
            title=ticket_data.get("title", "Support Request")[:200],
            description=ticket_data.get("description", ""),
            requester_name=ticket_data.get("requester_name", ""),
            requester_email=ticket_data.get("requester_email", ""),
            priority=ticket_data.get("priority", "medium"),
            status="open",
            assigned_to=self.config.get("auto_assign", "") or None,
            source="email",
            source_email_id=message_id,
        )
        db_session.add(ticket)
        db_session.commit()
        db_session.refresh(ticket)
        return ticket.id

    def _poll_once(self):
        from database import SessionLocal
        db = SessionLocal()
        mail = None
        try:
            mail = self._connect_imap()
            mail.select("INBOX")

            # Search for UNSEEN messages
            _, data = mail.search(None, "UNSEEN")
            uids = data[0].split()
            logger.info(f"Found {len(uids)} unread email(s)")

            for uid in uids:
                if self._stop_event.is_set():
                    break
                try:
                    _, msg_data = mail.fetch(uid, "(RFC822)")
                    raw = msg_data[0][1]
                    msg = email.message_from_bytes(raw)

                    message_id = msg.get("Message-ID", f"uid-{uid.decode()}")
                    subject = decode_header_value(msg.get("Subject", "(no subject)"))
                    sender = decode_header_value(msg.get("From", ""))
                    body = extract_email_body(msg)

                    if self._is_processed(message_id, db):
                        continue

                    # Parse with configured AI provider
                    ticket_data = parse_with_ai(subject, body, sender, self.config)
                    ticket_id = self._create_ticket(ticket_data, message_id, db)
                    self._mark_processed(message_id, subject, sender, ticket_id, db)

                    # Mark email as read
                    mail.store(uid, "+FLAGS", "\\Seen")

                    self.tickets_created += 1
                    self.emails_processed += 1
                    logger.info(f"Created ticket #{ticket_id} from email: {subject}")

                except Exception as e:
                    logger.error(f"Error processing email uid {uid}: {e}")
                    self.last_error = str(e)

            self.last_check = datetime.utcnow().isoformat()

        except Exception as e:
            logger.error(f"IMAP poll error: {e}")
            self.last_error = str(e)
            self.status = "error"
        finally:
            db.close()
            if mail:
                try:
                    mail.logout()
                except Exception:
                    pass

    def _run_loop(self):
        self.status = "running"
        logger.info("Email agent started")
        while not self._stop_event.is_set():
            self.reload_config()
            if not self.config.get("enabled"):
                break
            self._poll_once()
            interval = max(30, self.config.get("poll_interval", 60))
            self._stop_event.wait(interval)
        self.status = "stopped"
        self.running = False
        logger.info("Email agent stopped")

    def start(self):
        if self.running:
            return
        self._stop_event.clear()
        self.running = True
        self.status = "starting"
        self.last_error = None
        self._thread = threading.Thread(target=self._run_loop, daemon=True)
        self._thread.start()

    def stop(self):
        self._stop_event.set()
        self.running = False
        self.status = "stopping"

    def test_connection(self) -> dict:
        try:
            mail = self._connect_imap()
            mail.select("INBOX")
            _, data = mail.search(None, "UNSEEN")
            count = len(data[0].split()) if data[0] else 0
            mail.logout()
            return {"ok": True, "unread": count}
        except Exception as e:
            return {"ok": False, "error": str(e)}

    def get_status(self) -> dict:
        return {
            "running": self.running,
            "status": self.status,
            "last_check": self.last_check,
            "last_error": self.last_error,
            "tickets_created": self.tickets_created,
            "emails_processed": self.emails_processed,
            "config": {
                "enabled": self.config.get("enabled"),
                "email": self.config.get("email"),
                "imap_host": self.config.get("imap_host"),
                "imap_port": self.config.get("imap_port"),
                "poll_interval": self.config.get("poll_interval"),
                "auto_assign": self.config.get("auto_assign"),
                "ai_provider": self.config.get("ai_provider", "gemini"),
                "has_password": bool(self.config.get("password")),
                "has_gemini_key": bool(self.config.get("gemini_api_key")),
                "has_groq_key": bool(self.config.get("groq_api_key")),
                "has_claude_key": bool(self.config.get("claude_api_key")),
            },
        }


# Singleton instance
agent = EmailAgent()
