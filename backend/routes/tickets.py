from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Request
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import or_, case, func
from typing import List, Optional
import threading
import os
import uuid
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel
from database import get_db
from paths import data_path
from routes.auth import get_current_engineer
import models, schemas
from services.ticket_routing import find_routed_engineer, find_routing_match

ATTACHMENTS_DIR = data_path("ticket_attachments")
os.makedirs(ATTACHMENTS_DIR, exist_ok=True)
ALLOWED_ATTACHMENT_EXT = (".jpg", ".jpeg", ".png", ".gif", ".webp")
MAX_ATTACHMENT_SIZE = 2 * 1024 * 1024  # 2 MB

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


_SYSTEM_EMAIL_MARKERS = ("mailer-daemon", "postmaster", "microsoftexchange", "no-reply", "noreply")


def _looks_like_real_recipient(email_str: Optional[str]) -> bool:
    """Reject system/bounce sender addresses (e.g. a ticket auto-created from a
    misrouted NDR email) so a notification never gets sent to a mailbox that can
    only bounce it back — which would otherwise create a new ticket from that
    bounce and repeat indefinitely."""
    if not email_str or "@" not in email_str:
        return False
    e = email_str.strip().lower()
    return not any(m in e for m in _SYSTEM_EMAIL_MARKERS)


_DUPLICATE_WINDOW_HOURS = 6
_STOPWORDS = {
    "the", "and", "for", "with", "from", "this", "that", "have", "has",
    "في", "من", "على", "إلى", "الى", "عن", "مع", "هذا", "هذه", "لا", "لم",
    "ولا", "التي", "الذي", "عند", "بعد", "قبل", "مشكلة", "problem", "issue",
}


def _title_tokens(title: str) -> set:
    words = "".join(ch if ch.isalnum() else " " for ch in (title or "").lower()).split()
    return {w for w in words if len(w) >= 3 and w not in _STOPWORDS}


def _find_possible_duplicate(title: str, category: Optional[str], db: Session):
    """Lightweight, AI-free duplicate check: flag a recent (last few hours) open
    ticket with heavy keyword overlap in the title — e.g. five people separately
    reporting "internet down" — so engineers notice and can merge/link them
    instead of duplicating work. Deliberately not AI-based, to stay reliable
    even when the routing AI's quota is exhausted."""
    tokens = _title_tokens(title)
    if len(tokens) < 2:
        return None
    since = datetime.now(timezone.utc) - timedelta(hours=_DUPLICATE_WINDOW_HOURS)
    q = db.query(models.SupportTicket).filter(
        models.SupportTicket.status.in_(["open", "in_progress"]),
        models.SupportTicket.created_at >= since,
    )
    if category:
        q = q.filter(models.SupportTicket.category == category)
    for candidate in q.order_by(models.SupportTicket.id.desc()).limit(50):
        other_tokens = _title_tokens(candidate.title)
        if len(other_tokens) < 2:
            continue
        shared = tokens & other_tokens
        overlap = len(shared) / min(len(tokens), len(other_tokens))
        if len(shared) >= 2 and overlap >= 0.6:
            return candidate
    return None


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


@router.get("/track")
def track_ticket(ticket_id: int, email: str, db: Session = Depends(get_db)):
    # Intentionally public (no login) — this is how a requester who submitted a
    # ticket anonymously checks on it. Requiring the exact requester_email match
    # (not just the ticket id) keeps it from being a plain ID-enumeration lookup.
    obj = db.query(models.SupportTicket).filter(models.SupportTicket.id == ticket_id).first()
    if not obj or not obj.requester_email or obj.requester_email.strip().lower() != email.strip().lower():
        raise HTTPException(status_code=404, detail="لم يتم العثور على تذكرة بهذه البيانات")
    return {
        "id": obj.id,
        "title": obj.title,
        "description": obj.description,
        "status": obj.status,
        "priority": obj.priority,
        "category": obj.category,
        "assigned_to": obj.assigned_to,
        "resolution": obj.resolution,
        "created_at": obj.created_at,
        "updated_at": obj.updated_at,
        "sla_due_at": obj.sla_due_at,
        "sla_status": obj.sla_status,
        "csat_rating": obj.csat_rating,
    }


@router.get("/", response_model=List[schemas.SupportTicketOut])
def list_tickets(
    status: Optional[str] = None,
    priority: Optional[str] = None,
    department_id: Optional[int] = None,
    assigned_to: Optional[str] = None,
    date_from: Optional[str] = None,   # YYYY-MM-DD
    date_to: Optional[str] = None,     # YYYY-MM-DD
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
    if date_from:
        try:
            df = datetime.strptime(date_from, "%Y-%m-%d").replace(tzinfo=timezone.utc)
            q = q.filter(models.SupportTicket.created_at >= df)
        except ValueError:
            pass
    if date_to:
        try:
            from datetime import timedelta
            dt = datetime.strptime(date_to, "%Y-%m-%d").replace(tzinfo=timezone.utc) + timedelta(days=1)
            q = q.filter(models.SupportTicket.created_at < dt)
        except ValueError:
            pass
    return q.order_by(models.SupportTicket.id.desc()).all()


@router.get("/{ticket_id}", response_model=schemas.SupportTicketOut)
def get_ticket(ticket_id: int, db: Session = Depends(get_db)):
    obj = db.query(models.SupportTicket).filter(models.SupportTicket.id == ticket_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="التذكرة غير موجودة")
    return obj


@router.post("/", response_model=schemas.SupportTicketOut)
def create_ticket(ticket: schemas.SupportTicketCreate, db: Session = Depends(get_db)):
    if ticket.category and ticket.category not in models.TICKET_CATEGORIES:
        raise HTTPException(status_code=400, detail=f"category must be one of {models.TICKET_CATEGORIES}")
    duplicate_of = _find_possible_duplicate(ticket.title, ticket.category, db)
    obj = models.SupportTicket(**ticket.model_dump())
    routing_match = None
    if not obj.assigned_to:
        routing_match = find_routing_match(obj.title, obj.description, db)
        if routing_match:
            obj.assigned_to = routing_match["assigned_to"]
    db.add(obj)
    db.commit()
    db.refresh(obj)
    source_map = {"email": "إيميل", "telegram": "تيليجرام", "whatsapp": "واتساب"}
    source_label = source_map.get(getattr(obj, "source", "manual"), "يدوي")
    _add_activity(db, obj.id, f"تم إنشاء التذكرة ({source_label})")
    if obj.assigned_to and not ticket.assigned_to:
        _add_activity(db, obj.id, f"تم التوجيه التلقائي إلى {obj.assigned_to} بناءً على محتوى التذكرة")
    if duplicate_of:
        _add_activity(db, obj.id, f"🔁 قد تكون هذه التذكرة مرتبطة بتذكرة سابقة مشابهة: #{duplicate_of.id} \"{duplicate_of.title}\" — يُنصح بالمراجعة قبل البدء")

    # Notify every engineer on the matched routing rule — not just whichever one
    # ended up as assigned_to — so a rule shared by several people (e.g. laptop
    # purchases going to both Amr Issa and Mahmoud Farag) reaches all of them.
    if routing_match and len(routing_match["engineers"]) > 1:
        ticket_id, ticket_title, requester = obj.id, obj.title, obj.requester_name or ""

        def _notify_all(engineers):
            from services.email_notifier import send_assignment_email
            from database import SessionLocal
            session = SessionLocal()
            try:
                for eng in engineers:
                    notif = models.Notification(
                        engineer_name=eng["name"],
                        engineer_email=eng["email"],
                        ticket_id=ticket_id,
                        ticket_title=ticket_title,
                        message=f"تذكرة جديدة #{ticket_id} ضمن مسؤوليتك المشتركة: {ticket_title}",
                        is_read="false",
                        email_sent="false",
                    )
                    session.add(notif)
                    session.commit()
                    if eng["email"]:
                        sent = send_assignment_email(eng["name"], eng["email"], ticket_id, ticket_title, requester)
                        if sent:
                            notif.email_sent = "true"
                            session.commit()
            finally:
                session.close()

        threading.Thread(target=_notify_all, args=(routing_match["engineers"],), daemon=True).start()

    return obj


@router.post("/{ticket_id}/attachment", response_model=schemas.SupportTicketOut)
async def upload_ticket_attachment(ticket_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    # Intentionally public (no auth) — called right after public ticket
    # creation in the new-ticket form. Only allowed once per ticket (until
    # that attachment is replaced) to limit abuse of a guessable ticket id.
    obj = db.query(models.SupportTicket).filter(models.SupportTicket.id == ticket_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="التذكرة غير موجودة")

    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_ATTACHMENT_EXT:
        raise HTTPException(status_code=400, detail="الملفات المسموح بها: صور فقط (jpg, png, gif, webp)")

    content = await file.read()
    if len(content) > MAX_ATTACHMENT_SIZE:
        raise HTTPException(status_code=400, detail="الحجم الأقصى المسموح به 2 ميجابايت")

    # Remove a previous attachment on this ticket, if any, before saving the new one.
    if obj.attachment_filename:
        old_path = os.path.join(ATTACHMENTS_DIR, obj.attachment_filename)
        if os.path.exists(old_path):
            os.remove(old_path)

    stored_name = f"{uuid.uuid4().hex}{ext}"
    with open(os.path.join(ATTACHMENTS_DIR, stored_name), "wb") as f:
        f.write(content)

    obj.attachment_filename = stored_name
    obj.attachment_original_name = file.filename
    obj.attachment_size = len(content)
    db.commit()
    db.refresh(obj)
    return obj


@router.get("/{ticket_id}/attachment")
def download_ticket_attachment(ticket_id: int, db: Session = Depends(get_db)):
    obj = db.query(models.SupportTicket).filter(models.SupportTicket.id == ticket_id).first()
    if not obj or not obj.attachment_filename:
        raise HTTPException(status_code=404, detail="لا يوجد مرفق لهذه التذكرة")
    path = os.path.join(ATTACHMENTS_DIR, obj.attachment_filename)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="الملف غير موجود على السيرفر")
    return FileResponse(path, filename=obj.attachment_original_name)


@router.post("/{ticket_id}/csat")
def submit_csat(ticket_id: int, data: schemas.CsatSubmit, db: Session = Depends(get_db)):
    # Intentionally public (no auth) — reached from a link in the resolution
    # email sent to the requester. One rating per ticket (first submission wins).
    if data.rating < 1 or data.rating > 5:
        raise HTTPException(status_code=400, detail="Rating must be between 1 and 5")
    obj = db.query(models.SupportTicket).filter(models.SupportTicket.id == ticket_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if obj.csat_rating is not None:
        raise HTTPException(status_code=400, detail="A rating has already been submitted for this ticket")
    comment = (data.comment or "").strip()[:2000] or None
    obj.csat_rating = data.rating
    obj.csat_comment = comment
    obj.csat_submitted_at = datetime.now(timezone.utc)
    db.commit()
    note = f"⭐ قيّم مقدّم الطلب التذكرة: {data.rating}/5"
    if comment:
        note += f" — تعليق: {comment}"
    _add_activity(db, ticket_id, note)
    return {"message": "Thank you for your rating"}


@router.put("/{ticket_id}", response_model=schemas.SupportTicketOut)
def update_ticket(ticket_id: int, ticket: schemas.SupportTicketCreate, db: Session = Depends(get_db), _engineer=Depends(get_current_engineer)):
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
    request: Request,
    assigned_to: Optional[str] = None,
    resolution: Optional[str] = None,
    db: Session = Depends(get_db),
    _engineer=Depends(get_current_engineer),
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

    if status != old_status:
        origin = request.headers.get("origin", "http://localhost:23309")
        req_name, req_email, req_status, req_res = obj.requester_name, obj.requester_email, status, obj.resolution
        tg_chat_id, tg_source, tg_title = obj.telegram_chat_id, obj.source, obj.title

        def _notify():
            if req_email and _looks_like_real_recipient(req_email):
                from services.email_notifier import send_ticket_status_update_email, send_csat_request_email
                send_ticket_status_update_email(req_name, req_email, ticket_id, tg_title, req_status, req_res or "")
                if req_status == "resolved":
                    rate_url = f"{origin}/rate-ticket/{ticket_id}?"
                    send_csat_request_email(req_name, req_email, ticket_id, tg_title, rate_url)
            if tg_source == "telegram" and tg_chat_id:
                from services.telegram_bot import bot as telegram_bot
                telegram_bot.notify_status_update(tg_chat_id, ticket_id, tg_title, req_status)
                if req_status == "resolved":
                    telegram_bot.notify_csat_request(tg_chat_id, ticket_id, tg_title)

        threading.Thread(target=_notify, daemon=True).start()

    return {"message": "تم التحديث"}


@router.patch("/{ticket_id}/assign")
def assign_ticket(ticket_id: int, engineer_name: str, db: Session = Depends(get_db), _engineer=Depends(get_current_engineer)):
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
def add_comment(ticket_id: int, body: CommentIn, db: Session = Depends(get_db), _engineer=Depends(get_current_engineer)):
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
def delete_comment(ticket_id: int, comment_id: int, db: Session = Depends(get_db), _engineer=Depends(get_current_engineer)):
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
def delete_ticket(ticket_id: int, db: Session = Depends(get_db), _engineer=Depends(get_current_engineer)):
    obj = db.query(models.SupportTicket).filter(models.SupportTicket.id == ticket_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="التذكرة غير موجودة")
    db.delete(obj)
    db.commit()
    return {"message": "تم الحذف بنجاح"}
