import json
from collections import Counter
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
from routes.auth import get_current_engineer
import models, schemas

router = APIRouter(prefix="/ticket-reports", tags=["ticket-reports"])


def _apply_filters(
    db: Session,
    date_from: Optional[str], date_to: Optional[str],
    status: Optional[str], priority: Optional[str], category: Optional[str],
    organization_id: Optional[int], branch_id: Optional[int], department_id: Optional[int],
    assigned_to: Optional[str], source: Optional[str],
):
    q = db.query(models.SupportTicket)
    if date_from:
        q = q.filter(models.SupportTicket.created_at >= date_from)
    if date_to:
        q = q.filter(models.SupportTicket.created_at <= date_to + " 23:59:59")
    if status:
        q = q.filter(models.SupportTicket.status == status)
    if priority:
        q = q.filter(models.SupportTicket.priority == priority)
    if category:
        q = q.filter(models.SupportTicket.category == category)
    if organization_id:
        q = q.filter(models.SupportTicket.organization_id == organization_id)
    if branch_id:
        q = q.filter(models.SupportTicket.branch_id == branch_id)
    if department_id:
        q = q.filter(models.SupportTicket.department_id == department_id)
    if assigned_to:
        q = q.filter(models.SupportTicket.assigned_to == assigned_to)
    if source:
        q = q.filter(models.SupportTicket.source == source)
    return q.order_by(models.SupportTicket.id.desc()).all()


@router.get("/data")
def get_report_data(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    category: Optional[str] = None,
    organization_id: Optional[int] = None,
    branch_id: Optional[int] = None,
    department_id: Optional[int] = None,
    assigned_to: Optional[str] = None,
    source: Optional[str] = None,
    db: Session = Depends(get_db),
):
    tickets = _apply_filters(
        db, date_from, date_to, status, priority, category,
        organization_id, branch_id, department_id, assigned_to, source,
    )

    by_status   = Counter(t.status for t in tickets)
    by_priority = Counter(t.priority for t in tickets)
    by_category = Counter(t.category or "uncategorized" for t in tickets)
    by_branch   = Counter((t.branch.name if t.branch else "—") for t in tickets)
    by_org      = Counter((t.organization.name if t.organization else "—") for t in tickets)
    by_engineer = Counter((t.assigned_to or "غير مسند") for t in tickets)
    by_source   = Counter(t.source or "manual" for t in tickets)
    by_sla      = Counter(t.sla_status for t in tickets)

    resolved_closed = [t for t in tickets if t.status in ("resolved", "closed") and t.updated_at]
    avg_resolution_hours = None
    if resolved_closed:
        total_hours = sum((t.updated_at - t.created_at).total_seconds() / 3600 for t in resolved_closed)
        avg_resolution_hours = round(total_hours / len(resolved_closed), 1)

    rated = [t for t in tickets if t.csat_rating]
    avg_csat_rating = round(sum(t.csat_rating for t in rated) / len(rated), 2) if rated else None
    by_csat_rating = Counter(t.csat_rating for t in rated)

    return {
        "total": len(tickets),
        "by_status": dict(by_status),
        "by_priority": dict(by_priority),
        "by_category": dict(by_category),
        "by_branch": dict(by_branch),
        "by_organization": dict(by_org),
        "by_engineer": dict(by_engineer),
        "by_source": dict(by_source),
        "by_sla_status": dict(by_sla),
        "avg_resolution_hours": avg_resolution_hours,
        "avg_csat_rating": avg_csat_rating,
        "csat_count": len(rated),
        "by_csat_rating": dict(by_csat_rating),
        "tickets": [schemas.SupportTicketOut.model_validate(t).model_dump(mode="json") for t in tickets],
    }


@router.get("/presets", response_model=List[schemas.TicketReportPresetOut])
def list_presets(db: Session = Depends(get_db)):
    rows = db.query(models.TicketReportPreset).order_by(models.TicketReportPreset.name).all()
    return [
        schemas.TicketReportPresetOut(
            id=r.id, name=r.name, filters=json.loads(r.filters),
            created_by=r.created_by, created_at=r.created_at,
        )
        for r in rows
    ]


@router.post("/presets", response_model=schemas.TicketReportPresetOut)
def create_preset(data: schemas.TicketReportPresetCreate, db: Session = Depends(get_db), engineer=Depends(get_current_engineer)):
    if not data.name.strip():
        raise HTTPException(400, "اسم التقرير مطلوب")
    obj = models.TicketReportPreset(
        name=data.name.strip(),
        filters=json.dumps(data.filters, ensure_ascii=False),
        created_by=engineer.name,
    )
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return schemas.TicketReportPresetOut(
        id=obj.id, name=obj.name, filters=json.loads(obj.filters),
        created_by=obj.created_by, created_at=obj.created_at,
    )


@router.delete("/presets/{preset_id}")
def delete_preset(preset_id: int, db: Session = Depends(get_db), engineer=Depends(get_current_engineer)):
    obj = db.query(models.TicketReportPreset).filter(models.TicketReportPreset.id == preset_id).first()
    if not obj:
        raise HTTPException(404, "التقرير غير موجود")
    db.delete(obj)
    db.commit()
    return {"message": "تم الحذف بنجاح"}
