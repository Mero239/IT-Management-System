from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, case
from database import get_db
import models, schemas
from datetime import datetime, timedelta, timezone

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/stats", response_model=schemas.ReportStats)
def get_stats(db: Session = Depends(get_db)):
    def count(model, **filters):
        q = db.query(func.count(model.id))
        for k, v in filters.items():
            q = q.filter(getattr(model, k) == v)
        return q.scalar() or 0

    return schemas.ReportStats(
        total_assets=count(models.Asset),
        active_assets=count(models.Asset, status="active"),
        maintenance_assets=count(models.Asset, status="maintenance"),
        retired_assets=count(models.Asset, status="retired"),
        total_requests=count(models.NeedsRequest),
        pending_requests=count(models.NeedsRequest, status="pending"),
        approved_requests=count(models.NeedsRequest, status="approved"),
        rejected_requests=count(models.NeedsRequest, status="rejected"),
        total_tickets=count(models.SupportTicket),
        open_tickets=count(models.SupportTicket, status="open"),
        in_progress_tickets=count(models.SupportTicket, status="in_progress"),
        resolved_tickets=count(models.SupportTicket, status="resolved"),
        total_departments=count(models.Department),
    )


@router.get("/assets-by-type")
def assets_by_type(db: Session = Depends(get_db)):
    rows = (
        db.query(models.Asset.asset_type, func.count(models.Asset.id))
        .group_by(models.Asset.asset_type)
        .all()
    )
    return [{"type": r[0], "count": r[1]} for r in rows]


@router.get("/assets-by-status")
def assets_by_status(db: Session = Depends(get_db)):
    rows = (
        db.query(models.Asset.status, func.count(models.Asset.id))
        .group_by(models.Asset.status)
        .all()
    )
    return [{"status": r[0], "count": r[1]} for r in rows]


@router.get("/assets-by-department")
def assets_by_department(db: Session = Depends(get_db)):
    rows = (
        db.query(models.Department.name, func.count(models.Asset.id))
        .outerjoin(models.Asset, models.Asset.department_id == models.Department.id)
        .group_by(models.Department.name)
        .all()
    )
    return [{"department": r[0], "count": r[1]} for r in rows]


@router.get("/tickets-by-priority")
def tickets_by_priority(db: Session = Depends(get_db)):
    rows = (
        db.query(models.SupportTicket.priority, func.count(models.SupportTicket.id))
        .group_by(models.SupportTicket.priority)
        .all()
    )
    return [{"priority": r[0], "count": r[1]} for r in rows]


@router.get("/admin-dashboard")
def admin_dashboard(db: Session = Depends(get_db)):
    T = models.SupportTicket
    E = models.ITEngineer

    def tc(**f):
        q = db.query(func.count(T.id))
        for k, v in f.items():
            q = q.filter(getattr(T, k) == v)
        return q.scalar() or 0

    # ── ticket KPIs ──
    total_tickets      = tc()
    open_tickets       = tc(status="open")
    in_progress        = tc(status="in_progress")
    resolved           = tc(status="resolved")
    closed             = tc(status="closed")
    critical_open      = db.query(func.count(T.id)).filter(
        T.priority == "critical", T.status.notin_(["resolved", "closed"])
    ).scalar() or 0
    unassigned         = db.query(func.count(T.id)).filter(
        T.status.notin_(["resolved", "closed"]),
        (T.assigned_to == None) | (T.assigned_to == "")
    ).scalar() or 0
    email_tickets      = tc(source="email")

    # ── by priority ──
    by_priority = []
    for p in ["critical", "high", "medium", "low"]:
        by_priority.append({"priority": p, "total": tc(priority=p),
                            "open": db.query(func.count(T.id)).filter(T.priority==p, T.status.notin_(["resolved","closed"])).scalar() or 0})

    # ── engineer workload ──
    engineers = db.query(E).filter(E.active == "true").order_by(E.name).all()
    workload = []
    for eng in engineers:
        base = db.query(func.count(T.id)).filter(T.assigned_to == eng.name)
        workload.append({
            "id": eng.id,
            "name": eng.name,
            "role": eng.role,
            "permission_level": eng.permission_level,
            "open":        base.filter(T.status == "open").scalar() or 0,
            "in_progress": base.filter(T.status == "in_progress").scalar() or 0,
            "resolved":    base.filter(T.status == "resolved").scalar() or 0,
            "total":       base.scalar() or 0,
        })
    workload.sort(key=lambda x: x["open"] + x["in_progress"], reverse=True)

    # ── by department ──
    dept_rows = (
        db.query(models.Department.name, func.count(T.id))
        .outerjoin(T, T.department_id == models.Department.id)
        .filter(T.status.notin_(["resolved", "closed"]))
        .group_by(models.Department.name)
        .order_by(func.count(T.id).desc())
        .limit(6).all()
    )
    by_dept = [{"dept": r[0], "count": r[1]} for r in dept_rows]

    # ── recent tickets ──
    recent = (
        db.query(T).order_by(T.id.desc()).limit(8).all()
    )
    recent_list = [
        {
            "id": t.id, "title": t.title, "status": t.status,
            "priority": t.priority, "assigned_to": t.assigned_to,
            "requester_name": t.requester_name, "source": t.source,
            "created_at": t.created_at.isoformat() if t.created_at else None,
        }
        for t in recent
    ]

    # ── critical unresolved ──
    critical_list = [
        {
            "id": t.id, "title": t.title, "status": t.status,
            "assigned_to": t.assigned_to, "requester_name": t.requester_name,
            "created_at": t.created_at.isoformat() if t.created_at else None,
        }
        for t in db.query(T).filter(T.priority == "critical", T.status.notin_(["resolved", "closed"])).order_by(T.id.desc()).all()
    ]

    # ── unassigned active ──
    unassigned_list = [
        {
            "id": t.id, "title": t.title, "status": t.status,
            "priority": t.priority, "requester_name": t.requester_name,
            "created_at": t.created_at.isoformat() if t.created_at else None,
        }
        for t in db.query(T).filter(T.status.notin_(["resolved","closed"]), (T.assigned_to==None)|(T.assigned_to=="")).order_by(T.priority.desc(), T.id.desc()).limit(10).all()
    ]

    # ── engineer count ──
    active_engineers = db.query(func.count(E.id)).filter(E.active == "true").scalar() or 0
    total_engineers  = db.query(func.count(E.id)).scalar() or 0

    return {
        "kpi": {
            "total_tickets": total_tickets,
            "open": open_tickets,
            "in_progress": in_progress,
            "resolved": resolved,
            "closed": closed,
            "critical_open": critical_open,
            "unassigned": unassigned,
            "email_tickets": email_tickets,
            "active_engineers": active_engineers,
            "total_engineers": total_engineers,
        },
        "by_priority": by_priority,
        "workload": workload,
        "by_dept": by_dept,
        "recent_tickets": recent_list,
        "critical_list": critical_list,
        "unassigned_list": unassigned_list,
    }


@router.get("/advanced")
def advanced_reports(days: int = Query(30, ge=0), db: Session = Depends(get_db)):
    T = models.SupportTicket
    E = models.ITEngineer
    A = models.Asset
    D = models.Department
    R = models.NeedsRequest

    now = datetime.now(timezone.utc)
    since = (now - timedelta(days=days)) if days > 0 else None

    def tq(**f):
        q = db.query(func.count(T.id))
        for k, v in f.items():
            q = q.filter(getattr(T, k) == v)
        if since:
            q = q.filter(T.created_at >= since)
        return q.scalar() or 0

    # ── KPI summary ──
    total   = tq()
    open_   = tq(status="open")
    inp     = tq(status="in_progress")
    res     = tq(status="resolved")
    closed  = tq(status="closed")
    crit    = db.query(func.count(T.id)).filter(T.priority=="critical",
              T.status.notin_(["resolved","closed"]),
              *([T.created_at >= since] if since else [])).scalar() or 0
    unass   = db.query(func.count(T.id)).filter(
              T.status.notin_(["resolved","closed"]),
              (T.assigned_to==None)|(T.assigned_to==""),
              *([T.created_at >= since] if since else [])).scalar() or 0
    email_c = tq(source="email")

    # ── Tickets trend (daily buckets, last min(days,60) days) ──
    bucket_days = min(days, 60) if days > 0 else 60
    trend = []
    for i in range(bucket_days - 1, -1, -1):
        day_start = (now - timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
        day_end   = day_start + timedelta(days=1)
        created_c = db.query(func.count(T.id)).filter(T.created_at >= day_start, T.created_at < day_end).scalar() or 0
        resolved_c= db.query(func.count(T.id)).filter(
            T.status.in_(["resolved","closed"]),
            T.updated_at >= day_start, T.updated_at < day_end
        ).scalar() or 0
        trend.append({
            "date": day_start.strftime("%Y-%m-%d"),
            "label": day_start.strftime("%d/%m"),
            "created": created_c,
            "resolved": resolved_c,
        })

    # ── Engineer performance ──
    engineers = db.query(E).order_by(E.name).all()
    eng_perf = []
    for eng in engineers:
        base = db.query(T).filter(T.assigned_to == eng.name)
        if since:
            base = base.filter(T.created_at >= since)
        tickets = base.all()
        resolved_tickets = [t for t in tickets if t.status in ("resolved", "closed") and t.updated_at and t.created_at]
        avg_hours = None
        if resolved_tickets:
            diffs = []
            for t in resolved_tickets:
                c = t.created_at.replace(tzinfo=timezone.utc) if t.created_at.tzinfo is None else t.created_at
                u = t.updated_at.replace(tzinfo=timezone.utc) if t.updated_at.tzinfo is None else t.updated_at
                diff = (u - c).total_seconds() / 3600
                if diff >= 0:
                    diffs.append(diff)
            avg_hours = round(sum(diffs) / len(diffs), 1) if diffs else None

        eng_perf.append({
            "id": eng.id,
            "name": eng.name,
            "role": eng.role,
            "active": eng.active,
            "permission_level": eng.permission_level,
            "total":       len(tickets),
            "open":        sum(1 for t in tickets if t.status == "open"),
            "in_progress": sum(1 for t in tickets if t.status == "in_progress"),
            "resolved":    sum(1 for t in tickets if t.status in ("resolved","closed")),
            "avg_resolution_hours": avg_hours,
        })
    eng_perf.sort(key=lambda x: x["resolved"], reverse=True)

    # ── Priority breakdown with resolution stats ──
    priority_stats = []
    for p in ["critical", "high", "medium", "low"]:
        base_q = db.query(T).filter(T.priority == p)
        if since:
            base_q = base_q.filter(T.created_at >= since)
        all_p  = base_q.all()
        res_p  = [t for t in all_p if t.status in ("resolved","closed") and t.updated_at and t.created_at]
        avg_h  = None
        if res_p:
            diffs = []
            for t in res_p:
                c = t.created_at.replace(tzinfo=timezone.utc) if t.created_at.tzinfo is None else t.created_at
                u = t.updated_at.replace(tzinfo=timezone.utc) if t.updated_at.tzinfo is None else t.updated_at
                d = (u - c).total_seconds() / 3600
                if d >= 0:
                    diffs.append(d)
            avg_h = round(sum(diffs)/len(diffs), 1) if diffs else None
        priority_stats.append({
            "priority": p,
            "total":    len(all_p),
            "open":     sum(1 for t in all_p if t.status in ("open","in_progress")),
            "resolved": len(res_p),
            "avg_resolution_hours": avg_h,
        })

    # ── Department breakdown (all statuses) ──
    dept_rows = db.query(D).all()
    dept_breakdown = []
    for d in dept_rows:
        base = db.query(T).filter(T.department_id == d.id)
        if since:
            base = base.filter(T.created_at >= since)
        all_t = base.all()
        if not all_t:
            continue
        dept_breakdown.append({
            "dept": d.name,
            "total":       len(all_t),
            "open":        sum(1 for t in all_t if t.status == "open"),
            "in_progress": sum(1 for t in all_t if t.status == "in_progress"),
            "resolved":    sum(1 for t in all_t if t.status in ("resolved","closed")),
        })
    dept_breakdown.sort(key=lambda x: x["total"], reverse=True)

    # ── Top requesters ──
    req_q = db.query(T.requester_name, func.count(T.id).label("cnt"))
    if since:
        req_q = req_q.filter(T.created_at >= since)
    top_req = req_q.filter(T.requester_name != None, T.requester_name != "")\
        .group_by(T.requester_name).order_by(func.count(T.id).desc()).limit(10).all()
    top_requesters = [{"name": r[0], "count": r[1]} for r in top_req]

    # ── Source distribution ──
    src_email  = tq(source="email")
    src_manual = total - src_email

    # ── Asset summary ──
    asset_by_type = [{"type": r[0], "count": r[1]}
        for r in db.query(A.asset_type, func.count(A.id)).group_by(A.asset_type).all()]
    asset_by_status = [{"status": r[0], "count": r[1]}
        for r in db.query(A.status, func.count(A.id)).group_by(A.status).all()]
    total_assets = db.query(func.count(A.id)).scalar() or 0

    # ── Needs requests summary ──
    req_by_status = [{"status": r[0], "count": r[1]}
        for r in db.query(R.status, func.count(R.id)).group_by(R.status).all()]
    total_requests = db.query(func.count(R.id)).scalar() or 0

    return {
        "period_days": days,
        "generated_at": now.isoformat(),
        "kpi": {
            "total": total, "open": open_, "in_progress": inp,
            "resolved": res, "closed": closed, "critical_open": crit,
            "unassigned": unass, "email_tickets": email_c,
            "resolution_rate": round((res + closed) / total * 100, 1) if total else 0,
        },
        "trend": trend,
        "engineer_performance": eng_perf,
        "priority_stats": priority_stats,
        "dept_breakdown": dept_breakdown,
        "top_requesters": top_requesters,
        "source": {"email": src_email, "manual": src_manual},
        "assets": {
            "total": total_assets,
            "by_type": asset_by_type,
            "by_status": asset_by_status,
        },
        "requests": {
            "total": total_requests,
            "by_status": req_by_status,
        },
    }


@router.get("/by-software")
def report_by_software(db: Session = Depends(get_db)):
    """
    Returns each software program with a breakdown per department:
    quantity requested and total cost.
    """
    from collections import defaultdict

    requests = (
        db.query(models.NeedsRequest)
        .outerjoin(models.Department, models.NeedsRequest.department_id == models.Department.id)
        .order_by(models.NeedsRequest.title, models.Department.name)
        .all()
    )

    # Group: software → department → {qty, cost, currency, unit_price}
    grouped: dict = defaultdict(lambda: defaultdict(lambda: {"quantity": 0, "cost": 0.0, "currency": "USD", "unit_price": 0.0}))

    for req in requests:
        dept_name = req.department.name if req.department else "—"
        entry = grouped[req.title][dept_name]
        entry["quantity"] += req.quantity or 0
        try:
            entry["cost"] += float(req.estimated_cost) if req.estimated_cost else 0.0
        except (ValueError, TypeError):
            pass
        entry["currency"] = req.currency or "USD"
        qty = req.quantity or 0
        try:
            cost = float(req.estimated_cost) if req.estimated_cost else 0.0
            if qty > 0 and entry["unit_price"] == 0.0:
                entry["unit_price"] = round(cost / qty, 2)
        except (ValueError, TypeError):
            pass

    result = []
    grand_total_cost = 0.0
    grand_total_qty = 0

    for title in sorted(grouped.keys()):
        dept_map = grouped[title]
        departments = [
            {
                "department": dept,
                "quantity": vals["quantity"],
                "cost": round(vals["cost"], 2),
                "currency": vals["currency"],
            }
            for dept, vals in sorted(dept_map.items())
        ]
        total_qty = sum(d["quantity"] for d in departments)
        total_cost = round(sum(d["cost"] for d in departments), 2)
        currency = departments[0]["currency"] if departments else "USD"
        # unit price is the same across all departments for the same software
        unit_price = next(
            (vals["unit_price"] for vals in dept_map.values() if vals["unit_price"] > 0), 0.0
        )

        grand_total_qty += total_qty
        grand_total_cost += total_cost

        result.append({
            "title": title,
            "currency": currency,
            "unit_price": unit_price,
            "departments": departments,
            "total_quantity": total_qty,
            "total_cost": total_cost,
        })

    return {
        "software": result,
        "grand_total_quantity": grand_total_qty,
        "grand_total_cost": round(grand_total_cost, 2),
    }
