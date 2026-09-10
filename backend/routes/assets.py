from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
import models, schemas

router = APIRouter(prefix="/assets", tags=["assets"])


@router.get("/", response_model=List[schemas.AssetOut])
def list_assets(
    status: Optional[str] = None,
    asset_type: Optional[str] = None,
    department_id: Optional[int] = None,
    branch: Optional[str] = None,
    db: Session = Depends(get_db),
):
    q = db.query(models.Asset)
    if status:
        q = q.filter(models.Asset.status == status)
    if asset_type:
        q = q.filter(models.Asset.asset_type == asset_type)
    if department_id:
        q = q.filter(models.Asset.department_id == department_id)
    if branch:
        q = q.filter(models.Asset.branch == branch)
    return q.order_by(models.Asset.id.desc()).all()


@router.get("/{asset_id}", response_model=schemas.AssetOut)
def get_asset(asset_id: int, db: Session = Depends(get_db)):
    obj = db.query(models.Asset).filter(models.Asset.id == asset_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="الأصل غير موجود")
    return obj


@router.post("/", response_model=schemas.AssetOut)
def create_asset(asset: schemas.AssetCreate, db: Session = Depends(get_db)):
    if asset.serial_number:
        existing = db.query(models.Asset).filter(models.Asset.serial_number == asset.serial_number).first()
        if existing:
            raise HTTPException(status_code=400, detail="الرقم التسلسلي مستخدم مسبقاً")
    obj = models.Asset(**asset.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.put("/{asset_id}", response_model=schemas.AssetOut)
def update_asset(asset_id: int, asset: schemas.AssetCreate, db: Session = Depends(get_db)):
    obj = db.query(models.Asset).filter(models.Asset.id == asset_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="الأصل غير موجود")
    for k, v in asset.model_dump().items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/{asset_id}")
def delete_asset(asset_id: int, db: Session = Depends(get_db)):
    obj = db.query(models.Asset).filter(models.Asset.id == asset_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="الأصل غير موجود")
    db.delete(obj)
    db.commit()
    return {"message": "تم الحذف بنجاح"}
