from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from routes.auth import get_current_engineer
import models, schemas

router = APIRouter(prefix="/canned-responses", tags=["canned-responses"])


@router.get("/", response_model=List[schemas.CannedResponseOut])
def list_canned_responses(db: Session = Depends(get_db)):
    return db.query(models.TicketCannedResponse).order_by(models.TicketCannedResponse.title).all()


@router.post("/", response_model=schemas.CannedResponseOut)
def create_canned_response(data: schemas.CannedResponseCreate, db: Session = Depends(get_db), engineer=Depends(get_current_engineer)):
    if not data.title.strip() or not data.body.strip():
        raise HTTPException(400, "العنوان والنص مطلوبان")
    obj = models.TicketCannedResponse(title=data.title.strip(), body=data.body.strip())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.put("/{cr_id}", response_model=schemas.CannedResponseOut)
def update_canned_response(cr_id: int, data: schemas.CannedResponseCreate, db: Session = Depends(get_db), engineer=Depends(get_current_engineer)):
    obj = db.query(models.TicketCannedResponse).filter(models.TicketCannedResponse.id == cr_id).first()
    if not obj:
        raise HTTPException(404, "غير موجود")
    obj.title = data.title.strip()
    obj.body = data.body.strip()
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/{cr_id}")
def delete_canned_response(cr_id: int, db: Session = Depends(get_db), engineer=Depends(get_current_engineer)):
    obj = db.query(models.TicketCannedResponse).filter(models.TicketCannedResponse.id == cr_id).first()
    if not obj:
        raise HTTPException(404, "غير موجود")
    db.delete(obj)
    db.commit()
    return {"message": "تم الحذف بنجاح"}
