from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import List, Any, Optional, Dict
from sqlalchemy.orm import Session
from database import get_db
from routes.auth import get_current_engineer
import models

router = APIRouter(prefix="/nav-config", tags=["nav-config"])


class NavConfigBody(BaseModel):
    sections: List[Any]
    labels: Optional[Dict[str, str]] = None


@router.get("/")
def get_nav_config(db: Session = Depends(get_db), engineer=Depends(get_current_engineer)):
    row = db.query(models.EngineerNavConfig).filter(models.EngineerNavConfig.engineer_id == engineer.id).first()
    if not row:
        return {"sections": None, "labels": None}
    return {"sections": row.sections, "labels": row.labels}


@router.post("/")
def save_nav_config(body: NavConfigBody, db: Session = Depends(get_db), engineer=Depends(get_current_engineer)):
    # Personal to the requesting engineer — no admin check needed, since this
    # can never affect anyone else's sidebar.
    row = db.query(models.EngineerNavConfig).filter(models.EngineerNavConfig.engineer_id == engineer.id).first()
    if row:
        row.sections = body.sections
        row.labels = body.labels
    else:
        row = models.EngineerNavConfig(engineer_id=engineer.id, sections=body.sections, labels=body.labels)
        db.add(row)
    db.commit()
    return {"ok": True}


@router.delete("/")
def reset_nav_config(db: Session = Depends(get_db), engineer=Depends(get_current_engineer)):
    db.query(models.EngineerNavConfig).filter(models.EngineerNavConfig.engineer_id == engineer.id).delete()
    db.commit()
    return {"ok": True}
