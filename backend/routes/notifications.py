from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
import models

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("/")
def list_notifications(unread_only: bool = False, limit: int = 50, db: Session = Depends(get_db)):
    q = db.query(models.Notification).order_by(models.Notification.created_at.desc())
    if unread_only:
        q = q.filter(models.Notification.is_read == "false")
    rows = q.limit(limit).all()
    return [
        {
            "id": r.id,
            "engineer_name": r.engineer_name,
            "engineer_email": r.engineer_email,
            "ticket_id": r.ticket_id,
            "ticket_title": r.ticket_title,
            "message": r.message,
            "is_read": r.is_read,
            "email_sent": r.email_sent,
            "created_at": r.created_at,
        }
        for r in rows
    ]


@router.get("/unread-count")
def unread_count(db: Session = Depends(get_db)):
    count = db.query(models.Notification).filter(models.Notification.is_read == "false").count()
    return {"count": count}


@router.patch("/{nid}/read")
def mark_read(nid: int, db: Session = Depends(get_db)):
    obj = db.query(models.Notification).filter(models.Notification.id == nid).first()
    if obj:
        obj.is_read = "true"
        db.commit()
    return {"message": "ok"}


@router.patch("/mark-all-read")
def mark_all_read(db: Session = Depends(get_db)):
    db.query(models.Notification).filter(models.Notification.is_read == "false").update({"is_read": "true"})
    db.commit()
    return {"message": "ok"}
