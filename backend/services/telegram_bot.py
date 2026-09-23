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
    # WhatsApp Business Cloud API — turns inbound 1:1 messages to the
    # business number into tickets, the same way the Telegram bot does.
    # WhatsApp groups aren't supported by the official API at all, so this
    # only ever covers direct messages.
    "whatsapp_business_enabled": False,
    "whatsapp_access_token": "",
    "whatsapp_phone_number_id": "",
    "whatsapp_verify_token": "",
    # Telegram usernames (no leading @, lowercase) allowed to request the
    # live server-monitor report by chatting "server report" / "تقرير
    # السيرفرات" to the bot. The bot is reachable from the public new-ticket
    # page, so this must stay an explicit allowlist — never answered for
    # anyone not on it.
    "server_report_usernames": [],
}

PRIORITY_LABELS = {
    "ar": {"critical": "🔴 حرجة", "high": "🟠 عالية", "medium": "🟡 متوسطة", "low": "⚪ منخفضة"},
    "en": {"critical": "🔴 Critical", "high": "🟠 High", "medium": "🟡 Medium", "low": "⚪ Low"},
}
PRIORITY_QUESTION = {
    "ar": "ما مدى أهمية هذه المشكلة؟",
    "en": "What is the priority of this issue?",
}
CATEGORY_QUESTION = {
    "ar": "ما نوع المشكلة؟",
    "en": "What type of problem is this?",
}

# Recognizes a "send me the server status" chat command in Arabic or English —
# requires both a report/status word and a server/servers word together, to
# avoid matching an ordinary ticket message that just happens to mention
# "server" (e.g. "the server is down, please help").
_SERVER_REPORT_REPORT_WORDS = ("تقرير", "حالة", "report", "status")
_SERVER_REPORT_SERVER_WORDS = ("سيرفر", "سيرفرات", "الخوادم", "خادم", "خوادم", "server", "servers")
_SERVER_REPORT_BARE = {"السيرفرات", "الخوادم", "سيرفرات", "servers", "server", "server status", "server report", "servers status", "servers report"}


def _is_server_report_request(text: str) -> bool:
    t = text.strip().lower()
    if t in _SERVER_REPORT_BARE:
        return True
    return any(w in t for w in _SERVER_REPORT_REPORT_WORDS) and any(w in t for w in _SERVER_REPORT_SERVER_WORDS)


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

    def _get_categories(self, lang: str) -> list:
        from database import SessionLocal
        import models
        db = SessionLocal()
        try:
            rows = db.query(models.TicketCategory).order_by(models.TicketCategory.id).all()
            return [
                {"value": r.value, "label": (r.label_en or r.label) if lang == "en" else r.label, "icon": r.icon or "🏷️"}
                for r in rows
            ]
        finally:
            db.close()

    def _categories_keyboard(self, categories: list) -> dict:
        rows, row = [], []
        for c in categories:
            row.append({"text": f"{c['icon']} {c['label']}", "callback_data": f"category:{c['value']}"})
            if len(row) == 2:
                rows.append(row)
                row = []
        if row:
            rows.append(row)
        return {"inline_keyboard": rows}

    def _ask_priority(self, token: str, chat_id: int, lang: str):
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

    def _maybe_send_server_report(self, token: str, chat_id: int, username: str, text: str, cfg: dict) -> bool:
        """If this looks like a server-report request and the sender is on the
        allowlist, reply with the live server-monitor report and return True
        (message handled). Otherwise return False so the caller falls through
        to the normal ticket-creation flow — including for an unrecognized
        username, so we never confirm or deny the feature's existence to
        unauthorized senders."""
        if not _is_server_report_request(text):
            return False
        allowed = {u.lower().lstrip("@") for u in cfg.get("server_report_usernames", [])}
        if not username or username.lower() not in allowed:
            return False
        try:
            from services.monitor import build_report, load_config as monitor_load_config
            self._send(token, chat_id, build_report(monitor_load_config()))
        except Exception as e:
            logger.error(f"Failed to build/send server report: {e}")
            self._send(token, chat_id, "❌ تعذر جلب تقرير السيرفرات حاليًا")
        return True

    def _create_ticket(self, text: str, name: str, username: str, priority: str, chat_id: int, category: str | None = None) -> int | None:
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
                telegram_chat_id=chat_id,
                assigned_to=find_routed_engineer(title, text, db),
            )
            # category comes from a button built off the live DB list, but re-validate
            # in case it was deleted between the question being asked and answered
            if category and db.query(models.TicketCategory).filter(models.TicketCategory.value == category).first():
                ticket.category = category
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

    # ── outbound notifications (called from routes/tickets.py) ───────────────
    def notify_status_update(self, chat_id: int, ticket_id: int, title: str, status: str):
        cfg = load_config()
        if not cfg.get("token") or not chat_id:
            return
        from services.email_notifier import STATUS_LABELS_AR
        status_label = STATUS_LABELS_AR.get(status, status)
        text = f"🔔 <b>تحديث تذكرة #{ticket_id}</b>\n{title}\n\nالحالة الجديدة: <b>{status_label}</b>"
        self._send(cfg["token"], chat_id, text)

    def notify_csat_request(self, chat_id: int, ticket_id: int, title: str):
        cfg = load_config()
        if not cfg.get("token") or not chat_id:
            return
        text = (
            f"⭐ Your ticket #{ticket_id} has been resolved\n{title}\n\n"
            f"How was your experience with us? Tap a rating below (1 = lowest, 5 = highest):\n\n"
            f"Need further assistance? Contact IT Support — ext. 526"
        )
        keyboard = {
            "inline_keyboard": [[
                {"text": f"{i} {'⭐' * i}", "callback_data": f"csat:{ticket_id}:{i}"} for i in range(1, 6)
            ]]
        }
        self._send(cfg["token"], chat_id, text, reply_markup=keyboard)

    def _submit_csat(self, ticket_id: int, rating: int) -> str:
        from database import SessionLocal
        import models
        from datetime import datetime, timezone
        db = SessionLocal()
        try:
            obj = db.query(models.SupportTicket).filter(models.SupportTicket.id == ticket_id).first()
            if not obj:
                return "❌ Ticket not found"
            if obj.csat_rating is not None:
                return "You've already rated this ticket, thank you 🙏"
            obj.csat_rating = rating
            obj.csat_submitted_at = datetime.now(timezone.utc)
            db.commit()
            comment = models.TicketComment(
                ticket_id=ticket_id,
                author_name="Telegram Bot",
                content=f"⭐ Requester rated this ticket via Telegram: {rating}/5",
                type="activity",
            )
            db.add(comment)
            db.commit()
            return f"✅ Thank you for your feedback! ({'⭐' * rating})"
        except Exception as e:
            logger.error(f"Telegram CSAT submit error: {e}")
            db.rollback()
            return "❌ An error occurred while saving your rating"
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

            if data.startswith("csat:"):
                parts = data.split(":")
                if len(parts) == 3:
                    ticket_id, rating = int(parts[1]), int(parts[2])
                    msg = self._submit_csat(ticket_id, rating)
                    self._send(token, chat_id, msg)
                return

            if data.startswith("category:") and chat_id in self._pending:
                self._pending[chat_id]["category"] = data.split(":", 1)[1]
                self._ask_priority(token, chat_id, lang)
                return

            if data.startswith("priority:") and chat_id in self._pending:
                priority = data.split(":", 1)[1]
                pending  = self._pending.pop(chat_id)
                ticket_id = self._create_ticket(
                    text=pending["text"],
                    name=pending["name"],
                    username=pending["username"],
                    priority=priority,
                    category=pending.get("category"),
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

        # 🖥️ "server report" / "تقرير السيرفرات" — allowlisted usernames only
        if self._maybe_send_server_report(token, chat_id, username, text, cfg):
            return

        # Store message, ask for problem type first, then priority
        self._pending[chat_id] = {"text": text, "name": name, "username": username}
        categories = self._get_categories(lang)
        if categories:
            self._send(token, chat_id, CATEGORY_QUESTION.get(lang, CATEGORY_QUESTION["ar"]), reply_markup=self._categories_keyboard(categories))
        else:
            self._ask_priority(token, chat_id, lang)


bot = TelegramBot()
