from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List
import os
import uuid
from database import get_db
from paths import data_path
from routes.auth import get_current_engineer
import models, schemas

router = APIRouter(prefix="/agreements", tags=["agreements"])

AGREEMENTS_DIR = data_path("agreements")
os.makedirs(AGREEMENTS_DIR, exist_ok=True)


def _require_admin(engineer):
    if engineer.permission_level != "admin":
        raise HTTPException(403, "هذا الإجراء للمسؤولين فقط")


@router.get("/", response_model=List[schemas.SupportAgreementOut])
def list_agreements(db: Session = Depends(get_db)):
    return db.query(models.SupportAgreement).order_by(models.SupportAgreement.uploaded_at.desc()).all()


@router.post("/", response_model=schemas.SupportAgreementOut)
async def upload_agreement(
    title: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    engineer=Depends(get_current_engineer),
):
    _require_admin(engineer)
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "الملفات المسموح بها PDF فقط")

    content = await file.read()
    if not content.startswith(b"%PDF"):
        raise HTTPException(400, "الملف ليس PDF صالحاً")
    if len(content) > 25 * 1024 * 1024:
        raise HTTPException(400, "الحجم الأقصى المسموح به 25 ميجابايت")

    stored_name = f"{uuid.uuid4().hex}.pdf"
    with open(os.path.join(AGREEMENTS_DIR, stored_name), "wb") as f:
        f.write(content)

    obj = models.SupportAgreement(
        title=title.strip() or file.filename,
        stored_filename=stored_name,
        original_filename=file.filename,
        file_size=len(content),
    )
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.get("/{agreement_id}/download")
def download_agreement(agreement_id: int, db: Session = Depends(get_db)):
    obj = db.query(models.SupportAgreement).filter(models.SupportAgreement.id == agreement_id).first()
    if not obj:
        raise HTTPException(404, "الملف غير موجود")
    path = os.path.join(AGREEMENTS_DIR, obj.stored_filename)
    if not os.path.exists(path):
        raise HTTPException(404, "الملف غير موجود على السيرفر")
    return FileResponse(path, media_type="application/pdf", filename=obj.original_filename)


@router.delete("/{agreement_id}")
def delete_agreement(agreement_id: int, db: Session = Depends(get_db), engineer=Depends(get_current_engineer)):
    _require_admin(engineer)
    obj = db.query(models.SupportAgreement).filter(models.SupportAgreement.id == agreement_id).first()
    if not obj:
        raise HTTPException(404, "الملف غير موجود")
    path = os.path.join(AGREEMENTS_DIR, obj.stored_filename)
    if os.path.exists(path):
        os.remove(path)
    db.delete(obj)
    db.commit()
    return {"message": "تم الحذف بنجاح"}
