import json
import os
from paths import data_path
import threading
import time
import logging
import requests

logger = logging.getLogger("telegram_bot")

CONFIG_PATH = data_path("telegram_config.json")
TELEGRAM_API = "https://api.telegram.org/bot{token}/{method}"

DEFAULT_CONFIG = {
    "enabled": False,
    "token": "",
    "welcome_ar": "مرحباً! 👋\nأرسل وصف مشكلتك وسنقوم بإنشاء تذكرة دعم فوراً.",
    "welcome_en": "Hello! 👋\nSend your issue description and we'll create a support ticket right away.",
    "success_ar": "✅ تم إنشاء تذكرة رقم #{id}\n\nسيتواصل معك فريق الدعم الفني قريباً.",
    "success_en": "✅ Ticket #{id} created successfully!\n\nOur support team will contact you soon.",
    "language": "ar",
}

PRIORITY_LABELS = {
    "ar": {"critical": "🔴 حرجة", "high": "🟠 عالية", "medium": "🟡 متوسطة", "low": "⚪ منخفضة"},
    "en": {"critical": "🔴 Critical", "high": "🟠 High", "medium": "🟡 Medium", "low": "⚪ Low"},
}
PRIORITY_QUESTION = {
    "ar": "ما مدى أهمية هذه المشكلة؟",
    "en": "What is the priority of this issue?",
}


def load_config() -> dict:
    if os.path.exists(CONFIG_PATH):
        with open(CONFIG_PATH) as f:
            cfg = json.load(f)
        return {**DEFAULT_CONFIG, **cfg}
    return DEFAULT_CONFIG.copy()


def save_config(cfg: dict):
    merged = {**DEFAULT_CONFIG, **cfg}
    with open(CONFIG_PATH, "w") as f:
        json.dump(merged, f, ensure_ascii=False, indent=2)


class TelegramBot:
    def __init__(self):
        self.running  = False
        self._thread  = None
        self._offset  = 0
        self._pending = {}   # chat_id → {"text", "name", "username"}

    # ── public API ──────────────────────────────────────────────────────────
    def start(self) -> bool:
        if self.running:
            return True
        cfg = load_config()
        if not cfg.get("token") or not cfg.get("enabled"):
            return False
        self.running = True
        self._thread = threading.Thread(target=self._poll_loop, daemon=True, name="telegram-bot")
        self._thread.start()
        logger.info("Telegram bot started")
        return True

    def stop(self):
        self.running = False
        logger.info("Telegram bot stopped")

    @property
    def is_running(self):
        return self.running and (self._thread is not None) and self._thread.is_alive()

    def get_bot_info(self, token: str) -> dict:
        """Return bot username/name for display."""
        r = self._call(token, "getMe")
        if r.get("ok"):
            u = r["result"]
            return {"username": u.get("username"), "name": u.get("first_name")}
        return {}

    # ── internal ────────────────────────────────────────────────────────────
    def _call(self, token: str, method: str, **kwargs) -> dict:
        url = TELEGRAM_API.format(token=token, method=method)
        try:
            resp = requests.post(url, json=kwargs, timeout=15)
            return resp.json()
        except Exception as e:
            logger.warning(f"Telegram API error ({method}): {e}")
            return {}

    def _get_updates(self, token: str) -> list:
        url = TELEGRAM_API.format(token=token, method="getUpdates")
        try:
            resp = requests.get(url, params={"offset": self._offset, "timeout": 20}, timeout=30)
            data = resp.json()
            return data.get("result", []) if data.get("ok") else []
        except Exception as e:
            logger.warning(f"getUpdates error: {e}")
            return []

    def _send(self, token: str, chat_id: int, text: str, reply_markup=None):
        payload = {"chat_id": chat_id, "text": text, "parse_mode": "HTML"}
        if reply_markup:
            payload["reply_markup"] = reply_markup
        self._call(token, "sendMessage", **payload)

    def _create_ticket(self, text: str, name: str, username: str, priority: str, chat_id: int) -> int | None:
        from database import SessionLocal
        import models
        from services.ticket_routing import find_routed_engineer
        db = SessionLocal()
        try:
            title = (text[:97] + "…") if len(text) > 100 else text
            ticket = models.SupportTicket(
                title=title,
                description=text,
                requester_name=name,
                source="telegram",
                assigned_to=find_routed_engineer(title, text, db),
            )
            # set priority safely
            if priority in ("critical", "high", "medium", "low"):
                ticket.priority = priority
            db.add(ticket)
            db.commit()
            db.refresh(ticket)

            # add activity comment
            comment = models.TicketComment(
                ticket_id=ticket.id,
                author_name="Telegram Bot",
                content=f"تذكرة واردة من تيليجرام · المستخدم: {username or name} · معرّف المحادثة: {chat_id}",
                type="activity",
            )
            db.add(comment)
            db.commit()

            return ticket.id
        except Exception as e:
            logger.error(f"Failed to create ticket from Telegram: {e}")
            db.rollback()
            return None
        finally:
            db.close()

    def _poll_loop(self):
        while self.running:
            cfg = load_config()
            if not cfg.get("enabled") or not cfg.get("token"):
                time.sleep(5)
                continue

            token = cfg["token"]
            lang  = cfg.get("language", "ar")

            updates = self._get_updates(token)
            for upd in updates:
                self._offset = upd["update_id"] + 1
                try:
                    self._handle(upd, token, cfg, lang)
                except Exception as e:
                    logger.error(f"Error handling update: {e}")

    def _handle(self, upd: dict, token: str, cfg: dict, lang: str):
        # ── Callback (priority button press) ──────────────────────────────
        if "callback_query" in upd:
            cb       = upd["callback_query"]
            chat_id  = cb["message"]["chat"]["id"]
            data     = cb.get("data", "")
            self._call(token, "answerCallbackQuery", callback_query_id=cb["id"])

            if data.startswith("priority:") and chat_id in self._pending:
                priority = data.split(":", 1)[1]
                pending  = self._pending.pop(chat_id)
                ticket_id = self._create_ticket(
                    text=pending["text"],
                    name=pending["name"],
                    username=pending["username"],
                    priority=priority,
                    chat_id=chat_id,
                )
                if ticket_id:
                    key = f"success_{lang}"
                    msg = cfg.get(key, DEFAULT_CONFIG[key]).replace("#{id}", str(ticket_id))
                    self._send(token, chat_id, msg)
                else:
                    self._send(token, chat_id, "❌ حدث خطأ أثناء إنشاء التذكرة. حاول مرة أخرى.")
            return

        # ── Regular message ───────────────────────────────────────────────
        msg = upd.get("message") or upd.get("channel_post")
        if not msg or "text" not in msg:
            return

        chat_id  = msg["chat"]["id"]
        text     = msg["text"].strip()
        user     = msg.get("from", {})
        username = user.get("username", "")
        name     = " ".join(filter(None, [user.get("first_name", ""), user.get("last_name", "")])) \
                   or username or "Telegram User"

        # /start or /help
        if text.startswith("/"):
            key = f"welcome_{lang}"
            self._send(token, chat_id, cfg.get(key, DEFAULT_CONFIG[key]))
            return

        # Store message, ask for priority
        self._pending[chat_id] = {"text": text, "name": name, "username": username}
        lbl = PRIORITY_LABELS.get(lang, PRIORITY_LABELS["ar"])
        keyboard = {
            "inline_keyboard": [
                [
                    {"text": lbl["critical"], "callback_data": "priority:critical"},
                    {"text": lbl["high"],     "callback_data": "priority:high"},
                ],
                [
                    {"text": lbl["medium"],   "callback_data": "priority:medium"},
                    {"text": lbl["low"],      "callback_data": "priority:low"},
                ],
            ]
        }
        self._send(token, chat_id, PRIORITY_QUESTION.get(lang, PRIORITY_QUESTION["ar"]), reply_markup=keyboard)


bot = TelegramBot()
