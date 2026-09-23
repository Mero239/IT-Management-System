from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel
from routes.auth import get_current_engineer

router = APIRouter(prefix="/channels", tags=["channels"])


@router.get("/public")
def public_config():
    """No auth — WhatsApp contact info + the Telegram bot's @username (if the
    bot is enabled) for the public new-ticket form's "contact us" buttons."""
    from services.telegram_bot import load_config, bot
    cfg = load_config()
    telegram_username = ""
    if cfg.get("enabled") and cfg.get("token"):
        try:
            telegram_username = bot.get_bot_info(cfg["token"]).get("username") or ""
        except Exception:
            pass
    return {
        "whatsapp_phone":      cfg.get("whatsapp_phone", ""),
        "whatsapp_message_ar": cfg.get("whatsapp_message_ar", "مرحباً، أحتاج مساعدة فنية. مشكلتي: "),
        "whatsapp_message_en": cfg.get("whatsapp_message_en", "Hello, I need technical support. My issue: "),
        "telegram_username":   telegram_username,
    }


class TelegramConfig(BaseModel):
    enabled: bool | None = None
    token: str | None = None
    welcome_ar: str | None = None
    welcome_en: str | None = None
    success_ar: str | None = None
    success_en: str | None = None
    language: str | None = None
    whatsapp_phone: str | None = None
    whatsapp_message_ar: str | None = None
    whatsapp_message_en: str | None = None
    whatsapp_business_enabled: bool | None = None
    whatsapp_access_token: str | None = None
    whatsapp_phone_number_id: str | None = None
    whatsapp_verify_token: str | None = None
    server_report_usernames: list[str] | None = None


@router.get("/config")
def get_config(engineer=Depends(get_current_engineer)):
    if engineer.permission_level != "admin":
        raise HTTPException(403, "Admin only")
    from services.telegram_bot import load_config
    cfg = load_config()

    def _mask(v: str) -> str:
        return (v[:6] + "…" + v[-4:]) if len(v) > 10 else ("*" * len(v) if v else "")

    token = cfg.get("token", "")
    wa_token = cfg.get("whatsapp_access_token", "")
    return {
        **cfg,
        "token_preview": _mask(token), "token": "",
        "whatsapp_access_token_preview": _mask(wa_token), "whatsapp_access_token": "",
    }


@router.post("/config")
def save_config(body: TelegramConfig, engineer=Depends(get_current_engineer)):
    if engineer.permission_level != "admin":
        raise HTTPException(403, "Admin only")
    from services.telegram_bot import load_config, save_config, bot
    current = load_config()
    updates = body.model_dump(exclude_none=True)

    # If a token is submitted as an empty string, keep the existing one
    for key in ("token", "whatsapp_access_token"):
        if key in updates and updates[key] == "":
            del updates[key]

    merged = {**current, **updates}
    save_config(merged)

    # Auto-start/stop based on enabled flag
    if merged.get("enabled") and merged.get("token"):
        if not bot.is_running:
            bot.start()
    else:
        bot.stop()

    return {"ok": True}


@router.post("/telegram/token")
def save_token(body: dict, engineer=Depends(get_current_engineer)):
    """Separate endpoint to set token (keeps it out of regular config flow)."""
    if engineer.permission_level != "admin":
        raise HTTPException(403, "Admin only")
    token = body.get("token", "").strip()
    if not token:
        raise HTTPException(400, "Token required")
    from services.telegram_bot import load_config, save_config
    cfg = load_config()
    cfg["token"] = token
    save_config(cfg)
    return {"ok": True}


@router.get("/telegram/status")
def telegram_status(engineer=Depends(get_current_engineer)):
    if engineer.permission_level != "admin":
        raise HTTPException(403, "Admin only")
    from services.telegram_bot import bot, load_config
    cfg = load_config()
    info = {}
    if cfg.get("token"):
        try:
            info = bot.get_bot_info(cfg["token"])
        except Exception:
            pass
    return {
        "running": bot.is_running,
        "enabled": cfg.get("enabled", False),
        "has_token": bool(cfg.get("token")),
        "bot_username": info.get("username"),
        "bot_name": info.get("name"),
    }


@router.post("/telegram/start")
def start_bot(engineer=Depends(get_current_engineer)):
    if engineer.permission_level != "admin":
        raise HTTPException(403, "Admin only")
    from services.telegram_bot import bot, load_config
    cfg = load_config()
    if not cfg.get("token"):
        raise HTTPException(400, "Bot token not set")
    # Force enable + start
    from services.telegram_bot import save_config
    cfg["enabled"] = True
    save_config(cfg)
    bot.start()
    return {"ok": True, "running": bot.is_running}


@router.post("/telegram/stop")
def stop_bot(engineer=Depends(get_current_engineer)):
    if engineer.permission_level != "admin":
        raise HTTPException(403, "Admin only")
    from services.telegram_bot import bot, load_config, save_config
    cfg = load_config()
    cfg["enabled"] = False
    save_config(cfg)
    bot.stop()
    return {"ok": True}


@router.get("/whatsapp/status")
def whatsapp_status(engineer=Depends(get_current_engineer)):
    if engineer.permission_level != "admin":
        raise HTTPException(403, "Admin only")
    from services.telegram_bot import load_config
    cfg = load_config()
    return {
        "enabled": cfg.get("whatsapp_business_enabled", False),
        "has_token": bool(cfg.get("whatsapp_access_token")),
        "has_phone_number_id": bool(cfg.get("whatsapp_phone_number_id")),
        "has_verify_token": bool(cfg.get("whatsapp_verify_token")),
    }


# ── WhatsApp Cloud API webhook — both intentionally public (no auth): Meta
# calls these directly, it can't send our login token. GET is the one-time
# verification handshake done from the App Dashboard; POST is every
# subsequent message/status event.
@router.get("/whatsapp/webhook")
def whatsapp_webhook_verify(request: Request):
    from services.telegram_bot import load_config
    from services.whatsapp_bot import verify_webhook
    cfg = load_config()
    params = request.query_params
    challenge = verify_webhook(
        params.get("hub.mode", ""), params.get("hub.verify_token", ""),
        params.get("hub.challenge", ""), cfg,
    )
    if challenge is None:
        raise HTTPException(403, "Verification failed")
    return Response(content=challenge, media_type="text/plain")


@router.post("/whatsapp/webhook")
async def whatsapp_webhook_receive(request: Request):
    from services.telegram_bot import load_config
    from services.whatsapp_bot import handle_webhook_payload
    cfg = load_config()
    if cfg.get("whatsapp_business_enabled"):
        payload = await request.json()
        handle_webhook_payload(payload, cfg)
    return {"ok": True}
