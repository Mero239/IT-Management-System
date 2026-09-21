from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
from routes.auth import get_current_engineer
import models, schemas

router = APIRouter(prefix="/tasks", tags=["tasks"])

VALID_FREQUENCIES = ["daily", "weekly", "monthly", "one_time"]
VALID_STATUSES = ["pending", "done"]


@router.get("/", response_model=List[schemas.TaskOut])
def list_tasks(
    assigned_to: Optional[str] = None,
    frequency: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    engineer=Depends(get_current_engineer),
):
    q = db.query(models.EngineerTask)
    if assigned_to:
        q = q.filter(models.EngineerTask.assigned_to == assigned_to)
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
    obj = models.EngineerTask(**data.model_dump())
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
    for k, v in data.model_dump().items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/{task_id}")
def delete_task(task_id: int, db: Session = Depends(get_db), engineer=Depends(get_current_engineer)):
    obj = db.query(models.EngineerTask).filter(models.EngineerTask.id == task_id).first()
    if not obj:
        raise HTTPException(404, "المهمة غير موجودة")
    db.delete(obj)
    db.commit()
    return {"message": "تم الحذف بنجاح"}
