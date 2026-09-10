from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
from routes.auth import get_current_engineer
import models, schemas

router = APIRouter(prefix="/requests", tags=["requests"])


@router.get("/", response_model=List[schemas.NeedsRequestOut])
def list_requests(
    status: Optional[str] = None,
    priority: Optional[str] = None,
    department_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    q = db.query(models.NeedsRequest)
    if status:
        q = q.filter(models.NeedsRequest.status == status)
    if priority:
        q = q.filter(models.NeedsRequest.priority == priority)
    if department_id:
        q = q.filter(models.NeedsRequest.department_id == department_id)
    return q.order_by(models.NeedsRequest.id.desc()).all()


@router.get("/{req_id}", response_model=schemas.NeedsRequestOut)
def get_request(req_id: int, db: Session = Depends(get_db)):
    obj = db.query(models.NeedsRequest).filter(models.NeedsRequest.id == req_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="الطلب غير موجود")
    return obj


@router.post("/", response_model=schemas.NeedsRequestOut)
def create_request(req: schemas.NeedsRequestCreate, db: Session = Depends(get_db), engineer=Depends(get_current_engineer)):
    obj = models.NeedsRequest(**req.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.put("/{req_id}", response_model=schemas.NeedsRequestOut)
def update_request(req_id: int, req: schemas.NeedsRequestCreate, db: Session = Depends(get_db), engineer=Depends(get_current_engineer)):
    obj = db.query(models.NeedsRequest).filter(models.NeedsRequest.id == req_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="الطلب غير موجود")
    for k, v in req.model_dump().items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return obj


@router.patch("/{req_id}/status")
def update_request_status(req_id: int, status: str, db: Session = Depends(get_db), engineer=Depends(get_current_engineer)):
    obj = db.query(models.NeedsRequest).filter(models.NeedsRequest.id == req_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="الطلب غير موجود")
    valid = ["pending", "approved", "rejected", "fulfilled"]
    if status not in valid:
        raise HTTPException(status_code=400, detail="حالة غير صحيحة")
    obj.status = status
    db.commit()
    return {"message": "تم التحديث"}


@router.delete("/{req_id}")
def delete_request(req_id: int, db: Session = Depends(get_db), engineer=Depends(get_current_engineer)):
    obj = db.query(models.NeedsRequest).filter(models.NeedsRequest.id == req_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="الطلب غير موجود")
    db.delete(obj)
    db.commit()
    return {"message": "تم الحذف بنجاح"}
