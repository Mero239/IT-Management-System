from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from routes.auth import get_current_engineer
import models, schemas

router = APIRouter(prefix="/recurring-tickets", tags=["recurring-tickets"])

VALID_FREQUENCIES = ["daily", "weekly", "monthly"]


def _require_admin(engineer):
    if engineer.permission_level != "admin":
        raise HTTPException(403, "هذا الإجراء للمسؤولين فقط")


@router.get("/", response_model=List[schemas.RecurringTemplateOut])
def list_templates(db: Session = Depends(get_db), engineer=Depends(get_current_engineer)):
    return db.query(models.RecurringTicketTemplate).order_by(models.RecurringTicketTemplate.title).all()


@router.post("/", response_model=schemas.RecurringTemplateOut)
def create_template(data: schemas.RecurringTemplateCreate, db: Session = Depends(get_db), engineer=Depends(get_current_engineer)):
    _require_admin(engineer)
    if data.frequency not in VALID_FREQUENCIES:
        raise HTTPException(400, f"frequency must be one of {VALID_FREQUENCIES}")
    obj = models.RecurringTicketTemplate(**data.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.put("/{template_id}", response_model=schemas.RecurringTemplateOut)
def update_template(template_id: int, data: schemas.RecurringTemplateCreate, db: Session = Depends(get_db), engineer=Depends(get_current_engineer)):
    _require_admin(engineer)
    if data.frequency not in VALID_FREQUENCIES:
        raise HTTPException(400, f"frequency must be one of {VALID_FREQUENCIES}")
    obj = db.query(models.RecurringTicketTemplate).filter(models.RecurringTicketTemplate.id == template_id).first()
    if not obj:
        raise HTTPException(404, "غير موجود")
    for k, v in data.model_dump().items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/{template_id}")
def delete_template(template_id: int, db: Session = Depends(get_db), engineer=Depends(get_current_engineer)):
    _require_admin(engineer)
    obj = db.query(models.RecurringTicketTemplate).filter(models.RecurringTicketTemplate.id == template_id).first()
    if not obj:
        raise HTTPException(404, "غير موجود")
    db.delete(obj)
    db.commit()
    return {"message": "تم الحذف بنجاح"}


@router.post("/{template_id}/run-now")
def run_now(template_id: int, db: Session = Depends(get_db), engineer=Depends(get_current_engineer)):
    """Manually fire a template immediately (in addition to its schedule)."""
    _require_admin(engineer)
    from services.recurring_tickets import create_ticket_from_template
    obj = db.query(models.RecurringTicketTemplate).filter(models.RecurringTicketTemplate.id == template_id).first()
    if not obj:
        raise HTTPException(404, "غير موجود")
    ticket_id = create_ticket_from_template(obj, db)
    return {"message": "تم إنشاء التذكرة", "ticket_id": ticket_id}
