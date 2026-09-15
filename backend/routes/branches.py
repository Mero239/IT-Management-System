from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
from routes.auth import get_current_engineer
import models, schemas

router = APIRouter(prefix="/branches", tags=["branches"])


@router.get("/", response_model=List[schemas.BranchOut])
def list_branches(organization_id: Optional[int] = None, db: Session = Depends(get_db)):
    q = db.query(models.Branch)
    if organization_id:
        q = q.filter(models.Branch.organization_id == organization_id)
    return q.order_by(models.Branch.name).all()


@router.post("/", response_model=schemas.BranchOut)
def create_branch(branch: schemas.BranchCreate, db: Session = Depends(get_db)):
    # Intentionally public (no auth) — same "select or add inline" exception as
    # organizations, needed by the public new-ticket form.
    name = branch.name.strip()
    if not name:
        raise HTTPException(400, "اسم الفرع مطلوب")
    existing = db.query(models.Branch).filter(
        models.Branch.name.ilike(name),
        models.Branch.organization_id == branch.organization_id,
    ).first()
    if existing:
        return existing
    obj = models.Branch(name=name, organization_id=branch.organization_id)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.put("/{branch_id}", response_model=schemas.BranchOut)
def update_branch(branch_id: int, branch: schemas.BranchCreate, db: Session = Depends(get_db), engineer=Depends(get_current_engineer)):
    obj = db.query(models.Branch).filter(models.Branch.id == branch_id).first()
    if not obj:
        raise HTTPException(404, "الفرع غير موجود")
    obj.name = branch.name.strip()
    obj.organization_id = branch.organization_id
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/{branch_id}")
def delete_branch(branch_id: int, db: Session = Depends(get_db), engineer=Depends(get_current_engineer)):
    obj = db.query(models.Branch).filter(models.Branch.id == branch_id).first()
    if not obj:
        raise HTTPException(404, "الفرع غير موجود")
    db.delete(obj)
    db.commit()
    return {"message": "تم الحذف بنجاح"}
