import re
import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from routes.auth import get_current_engineer
import models, schemas

router = APIRouter(prefix="/ticket-categories", tags=["ticket-categories"])


def _ensure_seeded(db: Session):
    if db.query(models.TicketCategory).count() > 0:
        return
    for row in models.TICKET_CATEGORIES_SEED:
        db.add(models.TicketCategory(**row))
    db.commit()


def _slugify(label: str) -> str:
    ascii_part = re.sub(r"[^a-z0-9]+", "_", label.strip().lower()).strip("_")
    return ascii_part or uuid.uuid4().hex[:8]


@router.get("/", response_model=List[schemas.TicketCategoryOut])
def list_categories(db: Session = Depends(get_db)):
    _ensure_seeded(db)
    return db.query(models.TicketCategory).order_by(models.TicketCategory.id).all()


@router.post("/", response_model=schemas.TicketCategoryOut)
def create_category(body: schemas.TicketCategoryCreate, db: Session = Depends(get_db), engineer=Depends(get_current_engineer)):
    _ensure_seeded(db)
    base_value = _slugify(body.label)
    value = base_value
    suffix = 1
    while db.query(models.TicketCategory).filter(models.TicketCategory.value == value).first():
        suffix += 1
        value = f"{base_value}_{suffix}"

    obj = models.TicketCategory(value=value, label=body.label, label_en=body.label_en or None, icon=body.icon or "🏷️")
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.put("/{category_id}", response_model=schemas.TicketCategoryOut)
def update_category(category_id: int, body: schemas.TicketCategoryCreate, db: Session = Depends(get_db), engineer=Depends(get_current_engineer)):
    obj = db.query(models.TicketCategory).filter(models.TicketCategory.id == category_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="نوع المشكلة غير موجود")
    obj.label = body.label
    obj.label_en = body.label_en or None
    obj.icon = body.icon or "🏷️"
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/{category_id}")
def delete_category(category_id: int, db: Session = Depends(get_db), engineer=Depends(get_current_engineer)):
    obj = db.query(models.TicketCategory).filter(models.TicketCategory.id == category_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="نوع المشكلة غير موجود")
    db.delete(obj)
    db.commit()
    return {"message": "تم الحذف بنجاح"}
