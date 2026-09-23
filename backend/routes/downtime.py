from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
from routes.auth import get_current_engineer
import models, schemas

router = APIRouter(prefix="/downtime", tags=["downtime"])

VALID_SERVICES = ["email", "internet", "sap", "power", "network", "server", "other"]


@router.get("/", response_model=List[schemas.DowntimeOut])
def list_downtime(
    service: Optional[str] = None,
    ongoing_only: bool = False,
    db: Session = Depends(get_db),
    engineer=Depends(get_current_engineer),
):
    q = db.query(models.DowntimeIncident)
    if service:
        q = q.filter(models.DowntimeIncident.service == service)
    if ongoing_only:
        q = q.filter(models.DowntimeIncident.end_time.is_(None))
    return q.order_by(models.DowntimeIncident.start_time.desc()).all()


@router.post("/", response_model=schemas.DowntimeOut)
def create_downtime(data: schemas.DowntimeCreate, db: Session = Depends(get_db), engineer=Depends(get_current_engineer)):
    if data.service not in VALID_SERVICES:
        raise HTTPException(400, f"service must be one of {VALID_SERVICES}")
    obj = models.DowntimeIncident(**data.model_dump(), logged_by=engineer.name)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.put("/{incident_id}", response_model=schemas.DowntimeOut)
def update_downtime(incident_id: int, data: schemas.DowntimeCreate, db: Session = Depends(get_db), engineer=Depends(get_current_engineer)):
    if data.service not in VALID_SERVICES:
        raise HTTPException(400, f"service must be one of {VALID_SERVICES}")
    obj = db.query(models.DowntimeIncident).filter(models.DowntimeIncident.id == incident_id).first()
    if not obj:
        raise HTTPException(404, "الحادثة غير موجودة")
    for k, v in data.model_dump().items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/{incident_id}")
def delete_downtime(incident_id: int, db: Session = Depends(get_db), engineer=Depends(get_current_engineer)):
    obj = db.query(models.DowntimeIncident).filter(models.DowntimeIncident.id == incident_id).first()
    if not obj:
        raise HTTPException(404, "الحادثة غير موجودة")
    db.delete(obj)
    db.commit()
    return {"message": "تم الحذف بنجاح"}
