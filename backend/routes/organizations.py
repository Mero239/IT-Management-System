from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from routes.auth import get_current_engineer
import models, schemas

router = APIRouter(prefix="/organizations", tags=["organizations"])


@router.get("/", response_model=List[schemas.OrganizationOut])
def list_organizations(db: Session = Depends(get_db)):
    return db.query(models.Organization).order_by(models.Organization.name).all()


@router.post("/", response_model=schemas.OrganizationOut)
def create_organization(org: schemas.OrganizationCreate, db: Session = Depends(get_db)):
    # Intentionally public (no auth) — this can be added inline from the
    # public new-ticket form, same trust level as submitting the ticket itself.
    name = org.name.strip()
    if not name:
        raise HTTPException(400, "اسم المؤسسة مطلوب")
    existing = db.query(models.Organization).filter(models.Organization.name.ilike(name)).first()
    if existing:
        return existing
    obj = models.Organization(name=name)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.put("/{org_id}", response_model=schemas.OrganizationOut)
def update_organization(org_id: int, org: schemas.OrganizationCreate, db: Session = Depends(get_db), engineer=Depends(get_current_engineer)):
    obj = db.query(models.Organization).filter(models.Organization.id == org_id).first()
    if not obj:
        raise HTTPException(404, "المؤسسة غير موجودة")
    obj.name = org.name.strip()
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/{org_id}")
def delete_organization(org_id: int, db: Session = Depends(get_db), engineer=Depends(get_current_engineer)):
    obj = db.query(models.Organization).filter(models.Organization.id == org_id).first()
    if not obj:
        raise HTTPException(404, "المؤسسة غير موجودة")
    db.delete(obj)
    db.commit()
    return {"message": "تم الحذف بنجاح"}
