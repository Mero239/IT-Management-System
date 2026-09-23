from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
from routes.auth import get_current_engineer
import models, schemas

router = APIRouter(prefix="/tasks", tags=["tasks"])

VALID_FREQUENCIES = ["daily", "weekly", "monthly", "one_time"]
VALID_STATUSES = ["pending", "done"]


# Tasks are personal: an engineer only ever sees/edits their own (matched by
# name — same convention as assigned_to everywhere else in this app). Admins
# can see and manage everyone's; an 'it_manager' can additionally *see*
# everyone's (oversight), but still only creates/edits/deletes their own.
def _is_admin(engineer):
    return engineer.permission_level == "admin"


def _can_view_all_tasks(engineer):
    return _is_admin(engineer) or engineer.access_scope == "it_manager"


@router.get("/", response_model=List[schemas.TaskOut])
def list_tasks(
    assigned_to: Optional[str] = None,
    frequency: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    engineer=Depends(get_current_engineer),
):
    q = db.query(models.EngineerTask)
    if _can_view_all_tasks(engineer):
        if assigned_to:
            q = q.filter(models.EngineerTask.assigned_to == assigned_to)
    else:
        q = q.filter(models.EngineerTask.assigned_to == engineer.name)
    if frequency:
        q = q.filter(models.EngineerTask.frequency == frequency)
    if status:
        q = q.filter(models.EngineerTask.status == status)
    return q.order_by(models.EngineerTask.task_date.desc()).all()


@router.post("/", response_model=schemas.TaskOut)
def create_task(data: schemas.TaskCreate, db: Session = Depends(get_db), engineer=Depends(get_current_engineer)):
    if data.frequency not in VALID_FREQUENCIES:
        raise HTTPException(400, f"frequency must be one of {VALID_FREQUENCIES}")
    if data.status not in VALID_STATUSES:
        raise HTTPException(400, f"status must be one of {VALID_STATUSES}")
    payload = data.model_dump()
    if not _is_admin(engineer):
        payload["assigned_to"] = engineer.name
    obj = models.EngineerTask(**payload)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.put("/{task_id}", response_model=schemas.TaskOut)
def update_task(task_id: int, data: schemas.TaskCreate, db: Session = Depends(get_db), engineer=Depends(get_current_engineer)):
    if data.frequency not in VALID_FREQUENCIES:
        raise HTTPException(400, f"frequency must be one of {VALID_FREQUENCIES}")
    if data.status not in VALID_STATUSES:
        raise HTTPException(400, f"status must be one of {VALID_STATUSES}")
    obj = db.query(models.EngineerTask).filter(models.EngineerTask.id == task_id).first()
    if not obj:
        raise HTTPException(404, "المهمة غير موجودة")
    if not _is_admin(engineer) and obj.assigned_to != engineer.name:
        raise HTTPException(403, "غير مصرح لك بتعديل مهام مهندس آخر")
    payload = data.model_dump()
    if not _is_admin(engineer):
        payload["assigned_to"] = engineer.name
    was_done = obj.status == "done"
    for k, v in payload.items():
        setattr(obj, k, v)
    if obj.status == "done" and not was_done:
        obj.completed_at = datetime.now(timezone.utc)
    elif obj.status == "pending" and was_done:
        # only a real done→pending transition should reset the reminder
        # clock — an unrelated save that merely leaves status=pending as-is
        # must not wipe last_reminded_at, or the task looks "never reminded"
        # and gets spuriously re-notified every time it's edited
        obj.completed_at = None
        obj.last_reminded_at = None
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/{task_id}")
def delete_task(task_id: int, db: Session = Depends(get_db), engineer=Depends(get_current_engineer)):
    obj = db.query(models.EngineerTask).filter(models.EngineerTask.id == task_id).first()
    if not obj:
        raise HTTPException(404, "المهمة غير موجودة")
    if not _is_admin(engineer) and obj.assigned_to != engineer.name:
        raise HTTPException(403, "غير مصرح لك بحذف مهام مهندس آخر")
    db.delete(obj)
    db.commit()
    return {"message": "تم الحذف بنجاح"}
