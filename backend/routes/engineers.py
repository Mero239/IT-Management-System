from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from database import get_db
from routes.auth import get_current_engineer
import models

router = APIRouter(prefix="/engineers", tags=["engineers"])

VALID_PERMISSIONS = ["admin", "engineer", "viewer"]


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


class EngineerOut(BaseModel):
    id: int
    name: str
    email: str
    employee_code: Optional[str] = None
    role: str
    active: str
    permission_level: str
    model_config = {"from_attributes": True}


@router.get("/", response_model=List[EngineerOut])
def list_engineers(db: Session = Depends(get_db)):
    return db.query(models.ITEngineer).order_by(models.ITEngineer.name).all()


@router.post("/", response_model=EngineerOut)
def create_engineer(data: EngineerCreate, db: Session = Depends(get_db), engineer=Depends(get_current_engineer)):
    _require_admin(engineer)
    if data.permission_level not in VALID_PERMISSIONS:
        raise HTTPException(400, f"permission_level must be one of {VALID_PERMISSIONS}")
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
    obj = db.query(models.ITEngineer).filter(models.ITEngineer.id == eid).first()
    if not obj:
        raise HTTPException(404, "Not found")
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
    obj.permission_level = permission_level
    db.commit()
    return {"message": "Updated", "permission_level": permission_level}


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
    obj.active = active
    db.commit()
    return {"message": "Updated", "active": active}


@router.delete("/{eid}")
def delete_engineer(eid: int, db: Session = Depends(get_db), engineer=Depends(get_current_engineer)):
    _require_admin(engineer)
    obj = db.query(models.ITEngineer).filter(models.ITEngineer.id == eid).first()
    if not obj:
        raise HTTPException(404, "Not found")
    db.delete(obj)
    db.commit()
    return {"message": "Deleted"}
