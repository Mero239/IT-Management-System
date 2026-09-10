from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Optional
from routes.auth import get_current_engineer

router = APIRouter(prefix="/monitor", tags=["monitor"])


class ServerEntry(BaseModel):
    name: str
    ip: str
    os: Optional[str] = "none"
    ssh_user: Optional[str] = None
    ssh_pass: Optional[str] = None


class MonitorConfig(BaseModel):
    enabled: Optional[bool] = None
    channel_id: Optional[str] = None
    schedule: Optional[list[str]] = None
    alert_interval_minutes: Optional[int] = None
    thresholds: Optional[dict] = None
    servers: Optional[list[dict]] = None


def _require_admin(engineer):
    if engineer.permission_level != "admin":
        raise HTTPException(403, "Admin only")


@router.get("/config")
def get_config(engineer=Depends(get_current_engineer)):
    _require_admin(engineer)
    from services.monitor import load_config
    cfg = load_config()
    # mask ssh passwords in response
    safe = dict(cfg)
    safe["servers"] = [
        {**s, "ssh_pass": "••••" if s.get("ssh_pass") else ""}
        for s in cfg.get("servers", [])
    ]
    return safe


@router.post("/config")
def save_config(body: MonitorConfig, engineer=Depends(get_current_engineer)):
    _require_admin(engineer)
    from services.monitor import load_config, save_config as _save, monitor
    current = load_config()
    updates = body.model_dump(exclude_none=True)

    # If servers include masked passwords, keep existing ones
    if "servers" in updates:
        existing = {s["name"]: s for s in current.get("servers", [])}
        for srv in updates["servers"]:
            if srv.get("ssh_pass") in ("", "••••"):
                old = existing.get(srv["name"], {})
                srv["ssh_pass"] = old.get("ssh_pass", "")

    merged = {**current, **updates}
    _save(merged)

    if merged.get("enabled") and merged.get("channel_id"):
        if not monitor.is_running:
            monitor.start()
    else:
        monitor.stop()

    return {"ok": True}


@router.get("/status")
def get_status(engineer=Depends(get_current_engineer)):
    _require_admin(engineer)
    from services.monitor import monitor, load_config, local_stats, ping
    cfg  = load_config()
    ls   = local_stats()
    servers_status = []
    for srv in cfg.get("servers", []):
        servers_status.append({
            "name": srv["name"],
            "ip":   srv["ip"],
            "os":   srv.get("os", "none"),
            "up":   ping(srv["ip"]),
            "has_ssh": bool(srv.get("ssh_user")),
        })
    return {
        "running":    monitor.is_running,
        "enabled":    cfg.get("enabled", False),
        "channel_id": cfg.get("channel_id", ""),
        "schedule":   cfg.get("schedule", []),
        "thresholds": cfg.get("thresholds", {}),
        "local":      ls,
        "servers":    servers_status,
    }


@router.post("/start")
def start_monitor(engineer=Depends(get_current_engineer)):
    _require_admin(engineer)
    from services.monitor import monitor, load_config, save_config as _save
    cfg = load_config()
    if not cfg.get("channel_id"):
        raise HTTPException(400, "Channel ID not configured")
    cfg["enabled"] = True
    _save(cfg)
    monitor.start()
    return {"ok": True, "running": monitor.is_running}


@router.post("/stop")
def stop_monitor(engineer=Depends(get_current_engineer)):
    _require_admin(engineer)
    from services.monitor import monitor, load_config, save_config as _save
    cfg = load_config()
    cfg["enabled"] = False
    _save(cfg)
    monitor.stop()
    return {"ok": True}


@router.post("/report-now")
def report_now(background_tasks: BackgroundTasks, engineer=Depends(get_current_engineer)):
    _require_admin(engineer)
    from services.monitor import monitor
    background_tasks.add_task(monitor.send_report_now)
    return {"ok": True, "message": "تم إرسال التقرير إلى القناة"}


@router.get("/ping/{ip}")
def ping_server(ip: str, engineer=Depends(get_current_engineer)):
    _require_admin(engineer)
    from services.monitor import ping
    return {"ip": ip, "up": ping(ip)}
