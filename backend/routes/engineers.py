from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from database import get_db
from routes.auth import get_current_engineer
from root_config import is_root
import models

router = APIRouter(prefix="/engineers", tags=["engineers"])

VALID_PERMISSIONS = ["admin", "engineer", "viewer"]
# 'it_manager' behaves like 'tickets_only' (sidebar restricted to the ticketing
# system) but additionally sees every engineer's tasks, not just their own —
# see _can_see_all_tasks() in routes/tasks.py.
VALID_ACCESS_SCOPES = ["full", "tickets_only", "it_manager"]


def _guard_root_target(target, requester):
    """The root account can only ever be changed by itself — no other admin
    can edit, demote, deactivate, or delete it."""
    if is_root(target) and not is_root(requester):
        raise HTTPException(403, "هذا الحساب محمي ولا يمكن لأي مسؤول آخر تعديله")


def _require_admin(engineer):
    if engineer.permission_level != "admin":
        raise HTTPException(403, "هذا الإجراء للمسؤولين فقط")

# Canonical permission matrix — single source of truth
PERMISSION_MATRIX = {
    "admin": {
        "view_all_tickets":    True,
        "create_ticket":       True,
        "edit_any_ticket":     True,
        "edit_own_ticket":     True,
        "delete_ticket":       True,
        "assign_ticket":       True,
        "change_status":       True,
        "close_ticket":        True,
    },
    "engineer": {
        "view_all_tickets":    True,
        "create_ticket":       True,
        "edit_any_ticket":     False,
        "edit_own_ticket":     True,
        "delete_ticket":       False,
        "assign_ticket":       True,
        "change_status":       True,
        "close_ticket":        False,
    },
    "viewer": {
        "view_all_tickets":    True,
        "create_ticket":       False,
        "edit_any_ticket":     False,
        "edit_own_ticket":     False,
        "delete_ticket":       False,
        "assign_ticket":       False,
        "change_status":       False,
        "close_ticket":        False,
    },
}


class EngineerCreate(BaseModel):
    name: str
    email: str
    employee_code: Optional[str] = None
    role: Optional[str] = "IT Engineer"
    active: Optional[str] = "true"
    permission_level: Optional[str] = "engineer"
    access_scope: Optional[str] = "full"


class EngineerOut(BaseModel):
    id: int
    name: str
    email: str
    employee_code: Optional[str] = None
    role: str
    active: str
    permission_level: str
    access_scope: str = "full"
    model_config = {"from_attributes": True}


@router.get("/", response_model=List[EngineerOut])
def list_engineers(db: Session = Depends(get_db)):
    return db.query(models.ITEngineer).order_by(models.ITEngineer.name).all()


@router.post("/", response_model=EngineerOut)
def create_engineer(data: EngineerCreate, db: Session = Depends(get_db), engineer=Depends(get_current_engineer)):
    _require_admin(engineer)
    if data.permission_level not in VALID_PERMISSIONS:
        raise HTTPException(400, f"permission_level must be one of {VALID_PERMISSIONS}")
    if data.access_scope not in VALID_ACCESS_SCOPES:
        raise HTTPException(400, f"access_scope must be one of {VALID_ACCESS_SCOPES}")
    existing = db.query(models.ITEngineer).filter(models.ITEngineer.email == data.email).first()
    if existing:
        raise HTTPException(400, f"Email already exists: {data.email}")
    obj = models.ITEngineer(**data.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.put("/{eid}", response_model=EngineerOut)
def update_engineer(eid: int, data: EngineerCreate, db: Session = Depends(get_db), engineer=Depends(get_current_engineer)):
    _require_admin(engineer)
    if data.permission_level not in VALID_PERMISSIONS:
        raise HTTPException(400, f"permission_level must be one of {VALID_PERMISSIONS}")
    if data.access_scope not in VALID_ACCESS_SCOPES:
        raise HTTPException(400, f"access_scope must be one of {VALID_ACCESS_SCOPES}")
    obj = db.query(models.ITEngineer).filter(models.ITEngineer.id == eid).first()
    if not obj:
        raise HTTPException(404, "Not found")
    _guard_root_target(obj, engineer)
    for k, v in data.model_dump().items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return obj


@router.patch("/{eid}/permission")
def set_permission(eid: int, permission_level: str, db: Session = Depends(get_db), engineer=Depends(get_current_engineer)):
    _require_admin(engineer)
    if permission_level not in VALID_PERMISSIONS:
        raise HTTPException(400, f"Must be one of {VALID_PERMISSIONS}")
    obj = db.query(models.ITEngineer).filter(models.ITEngineer.id == eid).first()
    if not obj:
        raise HTTPException(404, "Not found")
    _guard_root_target(obj, engineer)
    obj.permission_level = permission_level
    db.commit()
    return {"message": "Updated", "permission_level": permission_level}


@router.patch("/{eid}/access-scope")
def set_access_scope(eid: int, access_scope: str, db: Session = Depends(get_db), engineer=Depends(get_current_engineer)):
    _require_admin(engineer)
    if access_scope not in VALID_ACCESS_SCOPES:
        raise HTTPException(400, f"Must be one of {VALID_ACCESS_SCOPES}")
    obj = db.query(models.ITEngineer).filter(models.ITEngineer.id == eid).first()
    if not obj:
        raise HTTPException(404, "Not found")
    _guard_root_target(obj, engineer)
    obj.access_scope = access_scope
    db.commit()
    return {"message": "Updated", "access_scope": access_scope}


@router.get("/permission-matrix")
def get_permission_matrix():
    return PERMISSION_MATRIX


@router.get("/{eid}/stats")
def engineer_stats(eid: int, db: Session = Depends(get_db)):
    eng = db.query(models.ITEngineer).filter(models.ITEngineer.id == eid).first()
    if not eng:
        raise HTTPException(404, "Not found")
    from models import SupportTicket
    base = db.query(SupportTicket).filter(SupportTicket.assigned_to == eng.name)
    return {
        "total":      base.count(),
        "open":       base.filter(SupportTicket.status == "open").count(),
        "in_progress":base.filter(SupportTicket.status == "in_progress").count(),
        "resolved":   base.filter(SupportTicket.status == "resolved").count(),
        "closed":     base.filter(SupportTicket.status == "closed").count(),
    }


@router.patch("/{eid}/active")
def toggle_active(eid: int, active: str, db: Session = Depends(get_db), engineer=Depends(get_current_engineer)):
    _require_admin(engineer)
    if active not in ("true", "false"):
        raise HTTPException(400, "active must be 'true' or 'false'")
    obj = db.query(models.ITEngineer).filter(models.ITEngineer.id == eid).first()
    if not obj:
        raise HTTPException(404, "Not found")
    _guard_root_target(obj, engineer)
    obj.active = active
    db.commit()
    return {"message": "Updated", "active": active}


@router.delete("/{eid}")
def delete_engineer(eid: int, db: Session = Depends(get_db), engineer=Depends(get_current_engineer)):
    _require_admin(engineer)
    obj = db.query(models.ITEngineer).filter(models.ITEngineer.id == eid).first()
    if not obj:
        raise HTTPException(404, "Not found")
    _guard_root_target(obj, engineer)
    db.delete(obj)
    db.commit()
    return {"message": "Deleted"}
