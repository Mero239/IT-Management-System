from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, case, func
from typing import List, Optional
import threading
from datetime import datetime, timezone
from pydantic import BaseModel
from database import get_db
import models, schemas
from services.ticket_routing import find_routed_engineer

router = APIRouter(prefix="/tickets", tags=["tickets"])

STATUS_LABELS = {
    "open": "مفتوحة",
    "in_progress": "قيد التنفيذ",
    "resolved": "محلولة",
    "closed": "مغلقة",
}
PRIORITY_LABELS = {
    "low": "منخفضة",
    "medium": "متوسطة",
    "high": "عالية",
    "critical": "حرجة",
}


def _add_activity(db: Session, ticket_id: int, content: str):
    db.add(models.TicketComment(ticket_id=ticket_id, author_name="النظام", content=content, type="activity"))
    db.commit()


@router.get("/engineer-stats")
def engineer_stats(engineer_name: str, db: Session = Depends(get_db)):
    base = db.query(models.SupportTicket).filter(models.SupportTicket.assigned_to == engineer_name)
    total      = base.count()
    open_      = base.filter(models.SupportTicket.status == "open").count()
    in_prog    = base.filter(models.SupportTicket.status == "in_progress").count()
    resolved   = base.filter(models.SupportTicket.status == "resolved").count()
    closed     = base.filter(models.SupportTicket.status == "closed").count()
    critical   = base.filter(models.SupportTicket.priority == "critical",
                              models.SupportTicket.status.notin_(["resolved", "closed"])).count()
    return {
        "total": total, "open": open_, "in_progress": in_prog,
        "resolved": resolved, "closed": closed, "critical": critical,
    }


@router.get("/knowledge-base")
def knowledge_base(
    search:        Optional[str] = None,
    department_id: Optional[int] = None,
    priority:      Optional[str] = None,
    solved_by:     Optional[str] = None,
    page:          int = Query(1, ge=1),
    page_size:     int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    T = models.SupportTicket
    D = models.Department

    q = (
        db.query(T)
        .filter(
            T.status.in_(["resolved", "closed"]),
            T.resolution != None,
            T.resolution != "",
        )
    )

    if search and search.strip():
        s = f"%{search.strip()}%"
        q = q.filter(or_(
            T.title.ilike(s),
            T.description.ilike(s),
            T.resolution.ilike(s),
        ))

    if department_id:
        q = q.filter(T.department_id == department_id)

    if priority:
        q = q.filter(T.priority == priority)

    if solved_by:
        q = q.filter(T.assigned_to == solved_by)

    total = q.count()
    items = (
        q.order_by(T.updated_at.desc().nullslast(), T.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    def _steps(res):
        return [s.strip() for s in (res or "").split("\n") if s.strip()]

    result = []
    for t in items:
        steps = _steps(t.resolution)
        result.append({
            "id":             t.id,
            "title":          t.title,
            "description":    t.description,
            "resolution":     t.resolution,
            "steps":          steps,
            "steps_count":    len(steps),
            "priority":       t.priority,
            "status":         t.status,
            "department":     {"id": t.department.id, "name": t.department.name} if t.department else None,
            "assigned_to":    t.assigned_to,
            "source":         t.source,
            "created_at":     t.created_at.isoformat() if t.created_at else None,
            "resolved_at":    t.updated_at.isoformat() if t.updated_at else None,
        })

    # ── stats (unfiltered) ──
    total_kb = db.query(func.count(T.id)).filter(
        T.status.in_(["resolved", "closed"]), T.resolution != None, T.resolution != ""
    ).scalar() or 0

    return {
        "items": result,
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": max(1, -(-total // page_size)),
        "stats": {"total_solutions": total_kb},
    }


@router.get("/admin-log")
def admin_ticket_log(
    search:        Optional[str] = None,
    status:        Optional[str] = None,   # comma-separated
    priority:      Optional[str] = None,   # comma-separated
    department_id: Optional[int] = None,
    assigned_to:   Optional[str] = None,
    source:        Optional[str] = None,   # email | manual
    unassigned:    Optional[bool] = None,
    date_from:     Optional[str] = None,   # YYYY-MM-DD
    date_to:       Optional[str] = None,
    sort_by:       str = "id",
    sort_dir:      str = "desc",
    page:          int = Query(1, ge=1),
    page_size:     int = Query(25, ge=1, le=2000),
    db: Session = Depends(get_db),
):
    T = models.SupportTicket
    q = db.query(T)

    # ── text search ──
    if search and search.strip():
        s = f"%{search.strip()}%"
        q = q.filter(or_(
            T.title.ilike(s),
            T.requester_name.ilike(s),
            T.requester_email.ilike(s),
            T.description.ilike(s),
            T.assigned_to.ilike(s),
        ))

    # ── multi-value status / priority ──
    if status:
        vals = [v.strip() for v in status.split(",") if v.strip()]
        if vals:
            q = q.filter(T.status.in_(vals))
    if priority:
        vals = [v.strip() for v in priority.split(",") if v.strip()]
        if vals:
            q = q.filter(T.priority.in_(vals))

    if department_id:
        q = q.filter(T.department_id == department_id)
    if assigned_to:
        q = q.filter(T.assigned_to == assigned_to)
    if source:
        q = q.filter(T.source == source)
    if unassigned is True:
        q = q.filter(or_(T.assigned_to == None, T.assigned_to == ""))

    # ── date range ──
    if date_from:
        try:
            df = datetime.strptime(date_from, "%Y-%m-%d").replace(tzinfo=timezone.utc)
            q = q.filter(T.created_at >= df)
        except ValueError:
            pass
    if date_to:
        try:
            from datetime import timedelta
            dt = datetime.strptime(date_to, "%Y-%m-%d").replace(tzinfo=timezone.utc) + timedelta(days=1)
            q = q.filter(T.created_at < dt)
        except ValueError:
            pass

    # ── sorting ──
    PRI_ORDER = case(
        (T.priority == "critical", 0),
        (T.priority == "high",     1),
        (T.priority == "medium",   2),
        (T.priority == "low",      3),
        else_=4,
    )
    STAT_ORDER = case(
        (T.status == "open",        0),
        (T.status == "in_progress", 1),
        (T.status == "resolved",    2),
        (T.status == "closed",      3),
        else_=4,
    )
    sort_col = {
        "id":         T.id,
        "title":      T.title,
        "created_at": T.created_at,
        "updated_at": T.updated_at,
        "priority":   PRI_ORDER,
        "status":     STAT_ORDER,
        "requester":  T.requester_name,
        "assigned_to": T.assigned_to,
    }.get(sort_by, T.id)

    if sort_dir == "asc":
        q = q.order_by(sort_col.asc())
    else:
        q = q.order_by(sort_col.desc())

    total = q.count()
    offset = (page - 1) * page_size
    items = q.offset(offset).limit(page_size).all()

    def _t(t):
        dept = t.department
        return {
            "id": t.id, "title": t.title, "description": t.description,
            "requester_name": t.requester_name, "requester_email": t.requester_email,
            "department_id": t.department_id,
            "department": {"id": dept.id, "name": dept.name} if dept else None,
            "priority": t.priority, "status": t.status,
            "assigned_to": t.assigned_to, "resolution": t.resolution,
            "source": t.source,
            "created_at": t.created_at.isoformat() if t.created_at else None,
            "updated_at": t.updated_at.isoformat() if t.updated_at else None,
        }

    return {
        "items": [_t(t) for t in items],
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": max(1, -(-total // page_size)),  # ceiling div
    }


@router.get("/", response_model=List[schemas.SupportTicketOut])
def list_tickets(
    status: Optional[str] = None,
    priority: Optional[str] = None,
    department_id: Optional[int] = None,
    assigned_to: Optional[str] = None,
    db: Session = Depends(get_db),
):
    q = db.query(models.SupportTicket)
    if status:
        q = q.filter(models.SupportTicket.status == status)
    if priority:
        q = q.filter(models.SupportTicket.priority == priority)
    if department_id:
        q = q.filter(models.SupportTicket.department_id == department_id)
    if assigned_to:
        q = q.filter(models.SupportTicket.assigned_to == assigned_to)
    return q.order_by(models.SupportTicket.id.desc()).all()


@router.get("/{ticket_id}", response_model=schemas.SupportTicketOut)
def get_ticket(ticket_id: int, db: Session = Depends(get_db)):
    obj = db.query(models.SupportTicket).filter(models.SupportTicket.id == ticket_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="التذكرة غير موجودة")
    return obj


@router.post("/", response_model=schemas.SupportTicketOut)
def create_ticket(ticket: schemas.SupportTicketCreate, db: Session = Depends(get_db)):
    obj = models.SupportTicket(**ticket.model_dump())
    if not obj.assigned_to:
        routed = find_routed_engineer(obj.title, obj.description, db)
        if routed:
            obj.assigned_to = routed
    db.add(obj)
    db.commit()
    db.refresh(obj)
    source_map = {"email": "إيميل", "telegram": "تيليجرام", "whatsapp": "واتساب"}
    source_label = source_map.get(getattr(obj, "source", "manual"), "يدوي")
    _add_activity(db, obj.id, f"تم إنشاء التذكرة ({source_label})")
    if obj.assigned_to and not ticket.assigned_to:
        _add_activity(db, obj.id, f"تم التوجيه التلقائي إلى {obj.assigned_to} بناءً على محتوى التذكرة")
    return obj


@router.put("/{ticket_id}", response_model=schemas.SupportTicketOut)
def update_ticket(ticket_id: int, ticket: schemas.SupportTicketCreate, db: Session = Depends(get_db)):
    obj = db.query(models.SupportTicket).filter(models.SupportTicket.id == ticket_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="التذكرة غير موجودة")
    old_status = obj.status
    old_priority = obj.priority
    for k, v in ticket.model_dump().items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    if obj.status != old_status:
        _add_activity(db, ticket_id, f"تغيير الحالة: {STATUS_LABELS.get(old_status, old_status)} ← {STATUS_LABELS.get(obj.status, obj.status)}")
    if obj.priority != old_priority:
        _add_activity(db, ticket_id, f"تغيير الأولوية: {PRIORITY_LABELS.get(old_priority, old_priority)} ← {PRIORITY_LABELS.get(obj.priority, obj.priority)}")
    return obj


@router.patch("/{ticket_id}/status")
def update_ticket_status(
    ticket_id: int,
    status: str,
    assigned_to: Optional[str] = None,
    resolution: Optional[str] = None,
    db: Session = Depends(get_db),
):
    obj = db.query(models.SupportTicket).filter(models.SupportTicket.id == ticket_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="التذكرة غير موجودة")
    valid = ["open", "in_progress", "resolved", "closed"]
    if status not in valid:
        raise HTTPException(status_code=400, detail="حالة غير صحيحة")
    old_status = obj.status
    obj.status = status
    if assigned_to:
        obj.assigned_to = assigned_to
    if resolution is not None:
        obj.resolution = resolution
    db.commit()
    _add_activity(db, ticket_id, f"تغيير الحالة: {STATUS_LABELS.get(old_status, old_status)} ← {STATUS_LABELS.get(status, status)}")
    if status == "resolved" and resolution:
        steps = [s.strip() for s in resolution.split('\n') if s.strip()]
        summary = steps[0][:60] + ('...' if len(steps[0]) > 60 else '') if steps else ''
        _add_activity(db, ticket_id, f"تم تسجيل خطوات الحل ({len(steps)} خطوة){': ' + summary if summary else ''}")
    return {"message": "تم التحديث"}


@router.patch("/{ticket_id}/assign")
def assign_ticket(ticket_id: int, engineer_name: str, db: Session = Depends(get_db)):
    obj = db.query(models.SupportTicket).filter(models.SupportTicket.id == ticket_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="التذكرة غير موجودة")
    old_assigned = obj.assigned_to
    obj.assigned_to = engineer_name
    if obj.status == "open":
        obj.status = "in_progress"
    db.commit()

    if old_assigned:
        _add_activity(db, ticket_id, f"إعادة تحويل التذكرة من {old_assigned} إلى {engineer_name}")
    else:
        _add_activity(db, ticket_id, f"تحويل التذكرة إلى {engineer_name}")

    # Find engineer email
    eng = db.query(models.ITEngineer).filter(models.ITEngineer.name == engineer_name).first()
    engineer_email = eng.email if eng else ""

    # Create in-app notification
    notif = models.Notification(
        engineer_name=engineer_name,
        engineer_email=engineer_email,
        ticket_id=ticket_id,
        ticket_title=obj.title,
        message=f"تم تحويل تذكرة #{ticket_id} إليك: {obj.title}",
        is_read="false",
        email_sent="false",
    )
    db.add(notif)
    db.commit()
    notif_id = notif.id

    if engineer_email:
        def _send(nid, eng_name, eng_email, tid, title, requester):
            from services.email_notifier import send_assignment_email
            from database import SessionLocal
            sent = send_assignment_email(eng_name, eng_email, tid, title, requester)
            if sent:
                session = SessionLocal()
                try:
                    n = session.query(models.Notification).filter(models.Notification.id == nid).first()
                    if n:
                        n.email_sent = "true"
                        session.commit()
                finally:
                    session.close()

        threading.Thread(
            target=_send,
            args=(notif_id, engineer_name, engineer_email, ticket_id, obj.title, obj.requester_name or ""),
            daemon=True,
        ).start()

    return {"message": "تم التحويل", "assigned_to": engineer_name, "status": obj.status}


# ── Comments ──────────────────────────────────────────────────────────────────

class CommentIn(BaseModel):
    author_name: str
    content: str


@router.get("/{ticket_id}/comments")
def list_comments(ticket_id: int, db: Session = Depends(get_db)):
    rows = (
        db.query(models.TicketComment)
        .filter(models.TicketComment.ticket_id == ticket_id)
        .order_by(models.TicketComment.created_at)
        .all()
    )
    return [
        {
            "id": r.id,
            "author_name": r.author_name,
            "content": r.content,
            "type": r.type,
            "created_at": r.created_at,
        }
        for r in rows
    ]


@router.post("/{ticket_id}/comments")
def add_comment(ticket_id: int, body: CommentIn, db: Session = Depends(get_db)):
    if not db.query(models.SupportTicket).filter(models.SupportTicket.id == ticket_id).first():
        raise HTTPException(status_code=404, detail="التذكرة غير موجودة")
    c = models.TicketComment(
        ticket_id=ticket_id,
        author_name=body.author_name.strip() or "مجهول",
        content=body.content.strip(),
        type="comment",
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    return {"id": c.id, "author_name": c.author_name, "content": c.content, "type": c.type, "created_at": c.created_at}


@router.delete("/{ticket_id}/comments/{comment_id}")
def delete_comment(ticket_id: int, comment_id: int, db: Session = Depends(get_db)):
    c = db.query(models.TicketComment).filter(
        models.TicketComment.id == comment_id,
        models.TicketComment.ticket_id == ticket_id,
        models.TicketComment.type == "comment",
    ).first()
    if not c:
        raise HTTPException(status_code=404, detail="التعليق غير موجود")
    db.delete(c)
    db.commit()
    return {"message": "تم الحذف"}


@router.delete("/{ticket_id}")
def delete_ticket(ticket_id: int, db: Session = Depends(get_db)):
    obj = db.query(models.SupportTicket).filter(models.SupportTicket.id == ticket_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="التذكرة غير موجودة")
    db.delete(obj)
    db.commit()
    return {"message": "تم الحذف بنجاح"}
