from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
from routes.auth import get_current_engineer
import models, schemas

router = APIRouter(prefix="/licensed-software", tags=["licensed-software"])


@router.get("/", response_model=List[schemas.LicensedSoftwareOut])
def list_licensed_software(department_id: Optional[int] = None, db: Session = Depends(get_db)):
    q = db.query(models.LicensedSoftware)
    if department_id:
        q = q.filter(models.LicensedSoftware.department_id == department_id)
    return q.order_by(models.LicensedSoftware.software_name).all()


@router.post("/", response_model=schemas.LicensedSoftwareOut)
def create_licensed_software(item: schemas.LicensedSoftwareCreate, db: Session = Depends(get_db), engineer=Depends(get_current_engineer)):
    obj = models.LicensedSoftware(**item.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.put("/{item_id}", response_model=schemas.LicensedSoftwareOut)
def update_licensed_software(item_id: int, item: schemas.LicensedSoftwareCreate, db: Session = Depends(get_db), engineer=Depends(get_current_engineer)):
    obj = db.query(models.LicensedSoftware).filter(models.LicensedSoftware.id == item_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="السجل غير موجود")
    for k, v in item.model_dump().items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/{item_id}")
def delete_licensed_software(item_id: int, db: Session = Depends(get_db), engineer=Depends(get_current_engineer)):
    obj = db.query(models.LicensedSoftware).filter(models.LicensedSoftware.id == item_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="السجل غير موجود")
    db.delete(obj)
    db.commit()
    return {"message": "تم الحذف بنجاح"}
