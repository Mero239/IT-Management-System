import logging
import requests

logger = logging.getLogger("whatsapp_bot")

WHATSAPP_API = "https://graph.facebook.com/v20.0/{phone_number_id}/messages"

SUCCESS_MESSAGE = {
    "ar": "✅ تم إنشاء تذكرة رقم #{id}\n\nسيتواصل معك فريق الدعم الفني قريباً.",
    "en": "✅ Ticket #{id} created successfully!\n\nOur support team will contact you soon.",
}


def verify_webhook(mode: str, token: str, challenge: str, cfg: dict) -> str | None:
    """Meta's one-time GET handshake when the webhook URL is registered in
    the App Dashboard. Must echo back `challenge` verbatim if the verify
    token matches what the admin configured."""
    if mode == "subscribe" and token and token == cfg.get("whatsapp_verify_token"):
        return challenge
    return None


def _send_text(token: str, phone_number_id: str, to: str, text: str):
    url = WHATSAPP_API.format(phone_number_id=phone_number_id)
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    try:
        resp = requests.post(
            url, headers=headers, timeout=10,
            json={"messaging_product": "whatsapp", "to": to, "type": "text", "text": {"body": text}},
        )
        if resp.status_code >= 400:
            logger.warning(f"WhatsApp reply failed for {to}: {resp.status_code} {resp.text[:300]}")
    except Exception as e:
        logger.warning(f"WhatsApp reply error for {to}: {e}")


def _create_ticket(text: str, from_number: str, sender_name: str) -> int | None:
    from database import SessionLocal
    import models
    from services.ticket_routing import find_routed_engineer

    db = SessionLocal()
    try:
        title = (text[:97] + "…") if len(text) > 100 else text
        ticket = models.SupportTicket(
            title=title,
            description=text,
            requester_name=sender_name or from_number,
            source="whatsapp",
            whatsapp_from=from_number,
            assigned_to=find_routed_engineer(title, text, db),
        )
        db.add(ticket)
        db.commit()
        db.refresh(ticket)

        db.add(models.TicketComment(
            ticket_id=ticket.id,
            author_name="WhatsApp Bot",
            content=f"تذكرة واردة من واتساب · المرسل: {sender_name or from_number} ({from_number})",
            type="activity",
        ))
        db.commit()
        return ticket.id
    except Exception as e:
        logger.error(f"Failed to create ticket from WhatsApp: {e}")
        db.rollback()
        return None
    finally:
        db.close()


def handle_webhook_payload(payload: dict, cfg: dict):
    """Process one Meta webhook POST body. Only handles plain text messages
    from a 1:1 chat — WhatsApp's Cloud API has no concept of receiving group
    messages, so there is nothing group-related to filter out here."""
    token = cfg.get("whatsapp_access_token", "")
    phone_number_id = cfg.get("whatsapp_phone_number_id", "")
    lang = cfg.get("language", "ar")

    for entry in payload.get("entry", []):
        for change in entry.get("changes", []):
            value = change.get("value", {})
            messages = value.get("messages", [])
            if not messages:
                continue  # status/delivery-receipt callbacks land here too — nothing to do

            contacts = {c.get("wa_id"): c.get("profile", {}).get("name", "") for c in value.get("contacts", [])}

            for msg in messages:
                if msg.get("type") != "text":
                    continue  # images/voice notes etc. — out of scope for now
                from_number = msg.get("from", "")
                text = msg.get("text", {}).get("body", "").strip()
                if not from_number or not text:
                    continue

                sender_name = contacts.get(from_number, "")
                ticket_id = _create_ticket(text, from_number, sender_name)
                if ticket_id and token and phone_number_id:
                    reply = SUCCESS_MESSAGE.get(lang, SUCCESS_MESSAGE["ar"]).replace("#{id}", str(ticket_id))
                    _send_text(token, phone_number_id, from_number, reply)
