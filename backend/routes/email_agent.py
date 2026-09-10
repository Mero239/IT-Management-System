from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel
from database import get_db
from routes.auth import get_current_engineer
import models
from services.email_agent import agent, load_config, save_config

router = APIRouter(prefix="/email-agent", tags=["email-agent"])


def _require_admin(engineer):
    if engineer.permission_level != "admin":
        raise HTTPException(403, "هذا الإجراء للمسؤولين فقط")


class AgentConfig(BaseModel):
    enabled: bool = False
    imap_host: str = "imap.gmail.com"
    imap_port: int = 993
    email: str = "it.support@mobica.net"
    password: Optional[str] = None
    poll_interval: int = 60
    ai_provider: str = "gemini"        # gemini | groq | claude
    gemini_api_key: Optional[str] = None
    groq_api_key: Optional[str] = None
    claude_api_key: Optional[str] = None
    auto_assign: Optional[str] = None


def _active_key(cfg: dict) -> bool:
    provider = cfg.get("ai_provider", "gemini")
    return bool(cfg.get(f"{provider}_api_key", ""))


@router.get("/status")
def get_status(engineer=Depends(get_current_engineer)):
    return agent.get_status()


@router.post("/start")
def start_agent(engineer=Depends(get_current_engineer)):
    _require_admin(engineer)
    cfg = load_config()
    if not cfg.get("password"):
        raise HTTPException(400, "كلمة مرور البريد غير مضبوطة")
    if not _active_key(cfg):
        raise HTTPException(400, f"مفتاح {cfg.get('ai_provider','gemini')} API غير مضبوط")
    cfg["enabled"] = True
    save_config(cfg)
    agent.reload_config()
    agent.start()
    return {"message": "Agent started"}


@router.post("/stop")
def stop_agent(engineer=Depends(get_current_engineer)):
    _require_admin(engineer)
    cfg = load_config()
    cfg["enabled"] = False
    save_config(cfg)
    agent.stop()
    return {"message": "Agent stopped"}


@router.post("/test-connection")
def test_connection(engineer=Depends(get_current_engineer)):
    _require_admin(engineer)
    result = agent.test_connection()
    if not result["ok"]:
        raise HTTPException(400, result.get("error", "Connection failed"))
    return result


@router.get("/config")
def get_config(engineer=Depends(get_current_engineer)):
    cfg = load_config()
    return {
        "enabled":        cfg.get("enabled", False),
        "imap_host":      cfg.get("imap_host", "imap.gmail.com"),
        "imap_port":      cfg.get("imap_port", 993),
        "email":          cfg.get("email", "it.support@mobica.net"),
        "poll_interval":  cfg.get("poll_interval", 60),
        "auto_assign":    cfg.get("auto_assign", ""),
        "ai_provider":    cfg.get("ai_provider", "gemini"),
        "has_password":   bool(cfg.get("password")),
        "has_gemini_key": bool(cfg.get("gemini_api_key")),
        "has_groq_key":   bool(cfg.get("groq_api_key")),
        "has_claude_key": bool(cfg.get("claude_api_key")),
    }


@router.put("/config")
def update_config(data: AgentConfig, engineer=Depends(get_current_engineer)):
    _require_admin(engineer)
    cfg = load_config()
    cfg["enabled"]      = data.enabled
    cfg["imap_host"]    = data.imap_host
    cfg["imap_port"]    = data.imap_port
    cfg["email"]        = data.email
    cfg["poll_interval"] = data.poll_interval
    cfg["ai_provider"]  = data.ai_provider
    cfg["auto_assign"]  = data.auto_assign or ""
    if data.password:        cfg["password"]        = data.password
    if data.gemini_api_key:  cfg["gemini_api_key"]  = data.gemini_api_key
    if data.groq_api_key:    cfg["groq_api_key"]    = data.groq_api_key
    if data.claude_api_key:  cfg["claude_api_key"]  = data.claude_api_key
    save_config(cfg)
    agent.reload_config()
    return {"message": "Config saved"}


@router.get("/providers")
def get_providers(engineer=Depends(get_current_engineer)):
    return [
        {
            "id":    "gemini",
            "name":  "Google Gemini",
            "model": "gemini-1.5-flash",
            "free":  True,
            "limit": "1,500 طلب/يوم — 15 طلب/دقيقة",
            "url":   "aistudio.google.com/app/apikey",
        },
        {
            "id":    "groq",
            "name":  "Groq (Llama 3.1)",
            "model": "llama-3.1-8b-instant",
            "free":  True,
            "limit": "14,400 طلب/يوم",
            "url":   "console.groq.com",
        },
        {
            "id":    "claude",
            "name":  "Anthropic Claude",
            "model": "claude-haiku",
            "free":  False,
            "limit": "مدفوع — $5 تكفي لآلاف الإيميلات",
            "url":   "console.anthropic.com",
        },
    ]


@router.get("/history")
def get_history(limit: int = 50, db: Session = Depends(get_db), engineer=Depends(get_current_engineer)):
    rows = (
        db.query(models.ProcessedEmail)
        .order_by(models.ProcessedEmail.processed_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": r.id,
            "subject": r.subject,
            "sender": r.sender,
            "ticket_id": r.ticket_id,
            "processed_at": r.processed_at,
        }
        for r in rows
    ]
