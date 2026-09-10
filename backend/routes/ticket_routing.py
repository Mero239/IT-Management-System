from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
import models, schemas

router = APIRouter(prefix="/ticket-routing", tags=["ticket-routing"])


@router.get("/", response_model=List[schemas.TicketRoutingRuleOut])
def list_rules(db: Session = Depends(get_db)):
    return (
        db.query(models.TicketRoutingRule)
        .order_by(models.TicketRoutingRule.priority_order, models.TicketRoutingRule.id)
        .all()
    )


@router.post("/", response_model=schemas.TicketRoutingRuleOut)
def create_rule(rule: schemas.TicketRoutingRuleCreate, db: Session = Depends(get_db)):
    if not rule.keywords.strip():
        raise HTTPException(400, "يجب إدخال كلمة مفتاحية واحدة على الأقل")
    obj = models.TicketRoutingRule(**rule.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.put("/{rule_id}", response_model=schemas.TicketRoutingRuleOut)
def update_rule(rule_id: int, rule: schemas.TicketRoutingRuleCreate, db: Session = Depends(get_db)):
    obj = db.query(models.TicketRoutingRule).filter(models.TicketRoutingRule.id == rule_id).first()
    if not obj:
        raise HTTPException(404, "القاعدة غير موجودة")
    for k, v in rule.model_dump().items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/{rule_id}")
def delete_rule(rule_id: int, db: Session = Depends(get_db)):
    obj = db.query(models.TicketRoutingRule).filter(models.TicketRoutingRule.id == rule_id).first()
    if not obj:
        raise HTTPException(404, "القاعدة غير موجودة")
    db.delete(obj)
    db.commit()
    return {"message": "تم الحذف بنجاح"}
