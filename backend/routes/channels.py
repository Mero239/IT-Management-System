from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from routes.auth import get_current_engineer

router = APIRouter(prefix="/channels", tags=["channels"])


@router.get("/public")
def public_config():
    """No auth — returns only the WhatsApp contact info for the public new-ticket form."""
    from services.telegram_bot import load_config
    cfg = load_config()
    return {
        "whatsapp_phone":      cfg.get("whatsapp_phone", ""),
        "whatsapp_message_ar": cfg.get("whatsapp_message_ar", "مرحباً، أحتاج مساعدة فنية. مشكلتي: "),
        "whatsapp_message_en": cfg.get("whatsapp_message_en", "Hello, I need technical support. My issue: "),
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


@router.get("/config")
def get_config(engineer=Depends(get_current_engineer)):
    if engineer.permission_level != "admin":
        raise HTTPException(403, "Admin only")
    from services.telegram_bot import load_config
    cfg = load_config()
    # Don't expose full token in response — just a masked preview
    token = cfg.get("token", "")
    masked = (token[:6] + "…" + token[-4:]) if len(token) > 10 else ("*" * len(token) if token else "")
    return {**cfg, "token_preview": masked, "token": ""}


@router.post("/config")
def save_config(body: TelegramConfig, engineer=Depends(get_current_engineer)):
    if engineer.permission_level != "admin":
        raise HTTPException(403, "Admin only")
    from services.telegram_bot import load_config, save_config, bot
    current = load_config()
    updates = body.model_dump(exclude_none=True)

    # If token is empty string in update, keep existing token
    if "token" in updates and updates["token"] == "":
        del updates["token"]

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
