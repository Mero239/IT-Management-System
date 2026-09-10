from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from routes.auth import get_current_engineer
import models, schemas

router = APIRouter(prefix="/departments", tags=["departments"])


@router.get("/", response_model=List[schemas.DepartmentOut])
def list_departments(db: Session = Depends(get_db)):
    return db.query(models.Department).order_by(models.Department.name).all()


@router.post("/", response_model=schemas.DepartmentOut)
def create_department(dept: schemas.DepartmentCreate, db: Session = Depends(get_db), engineer=Depends(get_current_engineer)):
    existing = db.query(models.Department).filter(models.Department.name == dept.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="القسم موجود مسبقاً")
    obj = models.Department(**dept.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.put("/{dept_id}", response_model=schemas.DepartmentOut)
def update_department(dept_id: int, dept: schemas.DepartmentCreate, db: Session = Depends(get_db), engineer=Depends(get_current_engineer)):
    obj = db.query(models.Department).filter(models.Department.id == dept_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="القسم غير موجود")
    for k, v in dept.model_dump().items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/{dept_id}")
def delete_department(dept_id: int, db: Session = Depends(get_db), engineer=Depends(get_current_engineer)):
    obj = db.query(models.Department).filter(models.Department.id == dept_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="القسم غير موجود")
    db.delete(obj)
    db.commit()
    return {"message": "تم الحذف بنجاح"}
