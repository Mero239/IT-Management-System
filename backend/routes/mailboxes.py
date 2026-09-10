from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, func, case
from typing import List, Optional
from datetime import datetime, timedelta
import io, openpyxl

from database import get_db
from models import Mailbox, Employee
from schemas import MailboxOut, MailboxImportResult
from routes.auth import get_current_engineer


def _enrich(mb: Mailbox, emp: Employee | None) -> dict:
    """Merge Mailbox ORM object with Employee lookup result into a dict."""
    d = {c.name: getattr(mb, c.name) for c in mb.__table__.columns}
    d["employee_code"] = emp.employee_code if emp else None
    d["name_ar"]       = emp.name_ar       if emp else None
    return d


class _MailboxEnriched:
    """Thin wrapper so Pydantic from_attributes works on an enriched dict."""
    def __init__(self, data: dict):
        for k, v in data.items():
            setattr(self, k, v)

router = APIRouter(prefix="/mailboxes", tags=["mailboxes"])


def _require_auth(engineer=Depends(get_current_engineer)):
    return engineer

def _require_admin(engineer=Depends(get_current_engineer)):
    if engineer.permission_level != "admin":
        raise HTTPException(403, "مطلوب صلاحية المدير")
    return engineer


# ── Helper ────────────────────────────────────────────────────────────────────

def _logon_bucket(last_logon: datetime | None) -> str:
    if last_logon is None:
        return "never"
    now = datetime.utcnow()
    days = (now - last_logon).days
    if days <= 7:    return "7d"
    if days <= 30:   return "30d"
    if days <= 90:   return "90d"
    if days <= 365:  return "1y"
    return "over1y"


def _size_bucket(mb: int | None) -> str:
    if mb is None: return "unknown"
    if mb >= 100 * 1024: return "100gb+"
    if mb >= 50  * 1024: return "50gb+"
    if mb >= 10  * 1024: return "10gb+"
    if mb >= 1   * 1024: return "1gb+"
    if mb >= 100:        return "100mb+"
    return "under100mb"


# ── Stats ─────────────────────────────────────────────────────────────────────

@router.get("/stats")
def get_stats(db: Session = Depends(get_db), _=Depends(_require_auth)):
    all_mb = db.query(Mailbox).all()
    total = len(all_mb)
    if total == 0:
        return {"total": 0}

    active   = sum(1 for m in all_mb if m.status == "active")
    inactive = total - active

    # Size
    sizes    = [m.total_size_mb for m in all_mb if m.total_size_mb is not None]
    total_gb = sum(sizes) / 1024 if sizes else 0
    avg_gb   = (sum(sizes) / len(sizes) / 1024) if sizes else 0
    max_mb   = max(sizes) if sizes else 0

    # Size buckets
    size_buckets = {}
    for m in all_mb:
        b = _size_bucket(m.total_size_mb)
        size_buckets[b] = size_buckets.get(b, 0) + 1

    # LastLogon buckets
    logon_buckets = {}
    for m in all_mb:
        b = _logon_bucket(m.last_logon)
        logon_buckets[b] = logon_buckets.get(b, 0) + 1

    # Create year
    create_years = {}
    for m in all_mb:
        if m.create_date:
            try:
                yr = str(m.create_date).split("/")[-1].strip()
                create_years[yr] = create_years.get(yr, 0) + 1
            except:
                pass

    # Domain distribution
    domains = {}
    for m in all_mb:
        d = m.domain or "unknown"
        domains[d] = domains.get(d, 0) + 1

    # Mobile device
    with_mobile = sum(1 for m in all_mb if m.mobile_device == "true")

    # Items distribution
    items = [m.total_items for m in all_mb if m.total_items is not None]
    avg_items = int(sum(items) / len(items)) if items else 0
    max_items = max(items) if items else 0

    # Top 10 largest
    top_largest = sorted(
        [m for m in all_mb if m.total_size_mb],
        key=lambda m: m.total_size_mb, reverse=True
    )[:10]

    # Recently created (last 30 days from latest create_date)
    recent = sorted(
        [m for m in all_mb if m.create_date],
        key=lambda m: m.create_date, reverse=True
    )[:5]

    # Inactive > 90 days
    never_recent = [m for m in all_mb if _logon_bucket(m.last_logon) in ("over1y", "1y", "never")]

    return {
        "total": total,
        "active": active,
        "inactive": inactive,
        "total_size_gb": round(total_gb, 1),
        "avg_size_gb": round(avg_gb, 2),
        "max_size_mb": max_mb,
        "with_mobile": with_mobile,
        "avg_items": avg_items,
        "max_items": max_items,
        "size_buckets": size_buckets,
        "logon_buckets": logon_buckets,
        "create_years": dict(sorted(create_years.items())),
        "domains": dict(sorted(domains.items(), key=lambda x: -x[1])),
        "top_largest": [
            {
                "id": m.id,
                "email": m.email,
                "display_name": m.display_name,
                "total_size_mb": m.total_size_mb,
                "total_size_gb": round(m.total_size_mb / 1024, 1),
                "total_items": m.total_items,
                "last_logon": m.last_logon,
                "status": m.status,
            }
            for m in top_largest
        ],
        "stale_count": len(never_recent),
    }


# ── List / Search ─────────────────────────────────────────────────────────────

@router.get("", response_model=List[MailboxOut])
def list_mailboxes(
    q: Optional[str] = Query(None),
    domain: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    logon: Optional[str] = Query(None, description="7d|30d|90d|1y|over1y|never"),
    size_min_gb: Optional[float] = Query(None),
    size_max_gb: Optional[float] = Query(None),
    sort: Optional[str] = Query("last_logon_desc"),
    limit: int = Query(50, le=500),
    offset: int = 0,
    db: Session = Depends(get_db),
    _=Depends(_require_auth),
):
    query = db.query(Mailbox, Employee).outerjoin(
        Employee, func.lower(Employee.email) == func.lower(Mailbox.email)
    )

    if q:
        like = f"%{q}%"
        query = query.filter(or_(
            Mailbox.email.ilike(like),
            Mailbox.display_name.ilike(like),
            Mailbox.account_id.ilike(like),
            Mailbox.department.ilike(like),
            Mailbox.job_title.ilike(like),
            Employee.employee_code.ilike(like),
            Employee.name_ar.ilike(like),
        ))
    if domain:
        query = query.filter(Mailbox.domain == domain)
    if status:
        query = query.filter(Mailbox.status == status)
    if size_min_gb is not None:
        query = query.filter(Mailbox.total_size_mb >= int(size_min_gb * 1024))
    if size_max_gb is not None:
        query = query.filter(Mailbox.total_size_mb <= int(size_max_gb * 1024))
    if logon:
        now = datetime.utcnow()
        if logon == "7d":
            query = query.filter(Mailbox.last_logon >= now - timedelta(days=7))
        elif logon == "30d":
            query = query.filter(Mailbox.last_logon >= now - timedelta(days=30))
        elif logon == "90d":
            query = query.filter(Mailbox.last_logon >= now - timedelta(days=90))
        elif logon == "1y":
            query = query.filter(Mailbox.last_logon >= now - timedelta(days=365))
        elif logon == "over1y":
            query = query.filter(Mailbox.last_logon < now - timedelta(days=365))
        elif logon == "never":
            query = query.filter(Mailbox.last_logon == None)

    if sort == "size_desc":
        query = query.order_by(Mailbox.total_size_mb.desc().nullslast())
    elif sort == "size_asc":
        query = query.order_by(Mailbox.total_size_mb.asc().nullsfirst())
    elif sort == "items_desc":
        query = query.order_by(Mailbox.total_items.desc().nullslast())
    elif sort == "last_logon_desc":
        query = query.order_by(Mailbox.last_logon.desc().nullslast())
    elif sort == "last_logon_asc":
        query = query.order_by(Mailbox.last_logon.asc().nullsfirst())
    elif sort == "create_desc":
        query = query.order_by(Mailbox.create_date.desc().nullslast())
    elif sort == "email_asc":
        query = query.order_by(Mailbox.email.asc())
    else:
        query = query.order_by(Mailbox.last_logon.desc().nullslast())

    rows = query.offset(offset).limit(limit).all()
    return [_MailboxEnriched(_enrich(mb, emp)) for mb, emp in rows]


@router.get("/count")
def count_mailboxes(
    q: Optional[str] = Query(None),
    domain: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _=Depends(_require_auth),
):
    query = db.query(func.count(Mailbox.id))
    if q:
        like = f"%{q}%"
        query = query.filter(or_(Mailbox.email.ilike(like), Mailbox.display_name.ilike(like)))
    if domain:
        query = query.filter(Mailbox.domain == domain)
    if status:
        query = query.filter(Mailbox.status == status)
    return {"count": query.scalar()}


@router.get("/{mb_id}", response_model=MailboxOut)
def get_mailbox(mb_id: int, db: Session = Depends(get_db), _=Depends(_require_auth)):
    row = db.query(Mailbox, Employee).outerjoin(
        Employee, func.lower(Employee.email) == func.lower(Mailbox.email)
    ).filter(Mailbox.id == mb_id).first()
    if not row:
        raise HTTPException(404, "not found")
    mb, emp = row
    return _MailboxEnriched(_enrich(mb, emp))


# ── Import ────────────────────────────────────────────────────────────────────

def _parse_mailbox_excel(data: bytes) -> list[dict]:
    wb = openpyxl.load_workbook(io.BytesIO(data))
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        return []

    header = [str(h).strip() if h else "" for h in rows[0]]

    def col(row, name):
        try:
            return row[header.index(name)]
        except (ValueError, IndexError):
            return None

    results = []
    for row in rows[1:]:
        email = col(row, "ExternalEmail")
        if not email or not isinstance(email, str) or "@" not in email:
            continue
        email = email.strip()

        # Parse create_date
        cd = col(row, "CreateDate")
        create_date_str = None
        if cd:
            if isinstance(cd, datetime):
                create_date_str = cd.strftime("%m/%d/%Y")
            else:
                create_date_str = str(cd).strip()

        # Status
        status_raw = col(row, "Status")
        status = "active" if status_raw is True or str(status_raw).lower() == "true" else "inactive"

        # Size
        sz = col(row, "TotalSizeMB")
        try:
            size_mb = int(float(str(sz))) if sz is not None else None
        except:
            size_mb = None

        # Mobile device
        md = col(row, "MobileDevice")
        mobile_device = "true" if md else "false"

        results.append({
            "account_id":     str(col(row, "AccountId")).strip() if col(row, "AccountId") else None,
            "account_name":   str(col(row, "AccountName")).strip() if col(row, "AccountName") else None,
            "display_name":   str(col(row, "DisplayName")).strip() if col(row, "DisplayName") else None,
            "email":          email,
            "domain":         email.split("@")[1].lower(),
            "first_name":     str(col(row, "FirstName")).strip() if col(row, "FirstName") else None,
            "last_name":      str(col(row, "LastName")).strip() if col(row, "LastName") else None,
            "department":     str(col(row, "Department")).strip() if col(row, "Department") else None,
            "job_title":      str(col(row, "JobTitle")).strip() if col(row, "JobTitle") else None,
            "mobile_phone":   str(col(row, "MobilePhone")).strip() if col(row, "MobilePhone") else None,
            "business_phone": str(col(row, "BusinessPhone")).strip() if col(row, "BusinessPhone") else None,
            "office":         str(col(row, "Office")).strip() if col(row, "Office") else None,
            "status":         status,
            "create_date":    create_date_str,
            "total_items":    int(col(row, "TotalItems")) if col(row, "TotalItems") is not None else None,
            "total_size_mb":  size_mb,
            "attachment_size": str(col(row, "AttachmentSize")).strip() if col(row, "AttachmentSize") else None,
            "mobile_device":  mobile_device,
            "last_logon":     col(row, "LastLogon") if isinstance(col(row, "LastLogon"), datetime) else None,
            "last_logoff":    col(row, "LastLogoff") if isinstance(col(row, "LastLogoff"), datetime) else None,
        })
    return results


@router.post("/import", response_model=MailboxImportResult)
async def import_mailboxes(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _=Depends(_require_admin),
):
    if not file.filename.endswith((".xlsx", ".xls")):
        raise HTTPException(400, "يجب رفع ملف Excel (.xlsx)")

    data = await file.read()
    rows = _parse_mailbox_excel(data)

    imported = updated = skipped = 0
    for row in rows:
        existing = db.query(Mailbox).filter(
            func.lower(Mailbox.email) == row["email"].lower()
        ).first()
        if existing:
            changed = False
            for k, v in row.items():
                if v is not None and getattr(existing, k) != v:
                    setattr(existing, k, v)
                    changed = True
            if changed:
                updated += 1
            else:
                skipped += 1
        else:
            mb = Mailbox(**row)
            db.add(mb)
            imported += 1

    db.commit()
    return MailboxImportResult(
        imported=imported, updated=updated, skipped=skipped,
        total=imported + updated + skipped,
    )
