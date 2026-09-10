from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from typing import List, Optional
import io
import openpyxl

from database import get_db
from models import Employee, ITEngineer
from schemas import EmployeeOut, EmployeeImportResult
from routes.auth import get_current_engineer


def require_auth(engineer=Depends(get_current_engineer)):
    return engineer


def require_admin(engineer=Depends(get_current_engineer)):
    if engineer.permission_level != "admin":
        raise HTTPException(403, "مطلوب صلاحية المدير")
    return engineer

router = APIRouter(prefix="/employees", tags=["employees"])


def _derive_name(email: str) -> str:
    """ahmed.ali@mobica.net -> Ahmed Ali"""
    local = email.split("@")[0]
    parts = local.replace("_", ".").replace("-", ".").split(".")
    return " ".join(p.capitalize() for p in parts if p)


# ── Search / list ────────────────────────────────────────────────────────────

@router.get("", response_model=List[EmployeeOut])
def list_employees(
    q: Optional[str] = Query(None, description="Search by name, email, code, or sector"),
    domain: Optional[str] = Query(None),
    company: Optional[str] = Query(None),
    has_email: Optional[bool] = Query(None),
    limit: int = Query(50, le=500),
    offset: int = 0,
    db: Session = Depends(get_db),
    _=Depends(require_auth),
):
    query = db.query(Employee)
    if q:
        like = f"%{q}%"
        query = query.filter(
            or_(
                Employee.email.ilike(like),
                Employee.name.ilike(like),
                Employee.name_ar.ilike(like),
                Employee.employee_code.ilike(like),
                Employee.sector.ilike(like),
                Employee.company.ilike(like),
            )
        )
    if domain:
        query = query.filter(Employee.domain == domain)
    if company:
        query = query.filter(Employee.company == company)
    if has_email is True:
        query = query.filter(Employee.email.isnot(None))
    elif has_email is False:
        query = query.filter(Employee.email.is_(None))
    return query.order_by(Employee.name_ar.asc().nullslast()).offset(offset).limit(limit).all()


@router.get("/count")
def count_employees(
    domain: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _=Depends(require_auth),
):
    total      = db.query(func.count(Employee.id)).scalar()
    with_code  = db.query(func.count(Employee.id)).filter(Employee.employee_code.isnot(None)).scalar()
    with_email = db.query(func.count(Employee.id)).filter(Employee.email.isnot(None)).scalar()
    merged     = db.query(func.count(Employee.id)).filter(Employee.email.isnot(None), Employee.name_ar.isnot(None)).scalar()
    domains    = (
        db.query(Employee.domain, func.count(Employee.id))
        .filter(Employee.domain.isnot(None))
        .group_by(Employee.domain)
        .order_by(func.count(Employee.id).desc())
        .all()
    )
    companies  = (
        db.query(Employee.company, func.count(Employee.id))
        .filter(Employee.company.isnot(None))
        .group_by(Employee.company)
        .order_by(func.count(Employee.id).desc())
        .all()
    )
    return {
        "total": total,
        "with_email": with_email,
        "with_code": with_code,
        "without_code": total - with_code,
        "merged": merged,
        "domains": [{"domain": d, "count": c} for d, c in domains],
        "companies": [{"company": c, "count": n} for c, n in companies],
    }


@router.get("/discrepancies")
def employee_discrepancies(
    db: Session = Depends(get_db),
    _=Depends(require_auth),
):
    """
    Report of mismatches between the mailbox/code list (email + employee_code)
    and the actual HR directory (name_ar). Two cases are flagged:
    - code_not_found: an email row has a code that doesn't match any HR record
    - duplicate_codes: the same code is used by more than one row
    """
    has_email_and_code = Employee.email.isnot(None), Employee.employee_code.isnot(None)

    not_found = (
        db.query(Employee)
        .filter(*has_email_and_code, Employee.name_ar.is_(None))
        .order_by(Employee.domain.asc())
        .all()
    )

    dup_codes = (
        db.query(Employee.employee_code)
        .filter(Employee.employee_code.isnot(None))
        .group_by(Employee.employee_code)
        .having(func.count(Employee.id) > 1)
        .all()
    )
    dup_codes = [c for c, in dup_codes]
    duplicates = []
    if dup_codes:
        rows = (
            db.query(Employee)
            .filter(Employee.employee_code.in_(dup_codes))
            .order_by(Employee.employee_code.asc())
            .all()
        )
        by_code = {}
        for r in rows:
            by_code.setdefault(r.employee_code, []).append(r)
        for code, items in by_code.items():
            duplicates.append({
                "employee_code": code,
                "name_ar": next((i.name_ar for i in items if i.name_ar), None),
                "rows": [{"id": i.id, "email": i.email, "domain": i.domain, "name": i.name} for i in items],
            })

    return {
        "summary": {
            "total": db.query(func.count(Employee.id)).scalar(),
            "with_email": db.query(func.count(Employee.id)).filter(Employee.email.isnot(None)).scalar(),
            "with_code": db.query(func.count(Employee.id)).filter(Employee.employee_code.isnot(None)).scalar(),
            "code_not_found": len(not_found),
            "duplicate_codes": len(duplicates),
        },
        "not_found": [
            {"id": e.id, "email": e.email, "domain": e.domain, "employee_code": e.employee_code, "name": e.name}
            for e in not_found
        ],
        "duplicates": duplicates,
    }


@router.get("/lookup")
def lookup_employee(
    q: str = Query(..., description="Email or employee code exact match"),
    db: Session = Depends(get_db),
):
    """Public lookup — used from ticket creation form to auto-fill requester info."""
    emp = db.query(Employee).filter(
        or_(
            func.lower(Employee.email) == q.lower(),
            Employee.employee_code == q,
        )
    ).first()
    if not emp:
        raise HTTPException(404, "لم يتم العثور على الموظف")
    return emp


@router.get("/{emp_id}", response_model=EmployeeOut)
def get_employee(emp_id: int, db: Session = Depends(get_db), _=Depends(require_auth)):
    emp = db.query(Employee).filter(Employee.id == emp_id).first()
    if not emp:
        raise HTTPException(404, "not found")
    return emp


@router.delete("/{emp_id}")
def delete_employee(emp_id: int, db: Session = Depends(get_db), _=Depends(require_admin)):
    emp = db.query(Employee).filter(Employee.id == emp_id).first()
    if not emp:
        raise HTTPException(404, "not found")
    db.delete(emp)
    db.commit()
    return {"ok": True}


# ── Import from Excel ─────────────────────────────────────────────────────────

def _parse_excel(data: bytes) -> list[dict]:
    wb = openpyxl.load_workbook(io.BytesIO(data))
    employees = []
    for sheet_name in wb.sheetnames:
        if sheet_name.lower() == "total":
            continue
        ws = wb[sheet_name]
        rows = list(ws.iter_rows(values_only=True))
        if not rows:
            continue
        header = rows[0]
        # Find (email_col, code_col) pairs — "Code" column sits right after email column
        pairs = []
        for i, val in enumerate(header):
            if val == "Code" and i > 0:
                pairs.append((i - 1, i))   # (email_col_idx, code_col_idx)

        for row in rows[1:]:
            for ecol, ccol in pairs:
                if len(row) <= ccol:
                    continue
                email = row[ecol]
                code = row[ccol]
                if not email or not isinstance(email, str) or "@" not in email:
                    continue
                email = email.strip()
                code = str(code).strip() if code else None
                domain = email.split("@")[1].lower()
                employees.append({"email": email, "code": code, "domain": domain})
    return employees


@router.post("/import", response_model=EmployeeImportResult)
async def import_employees(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    if not file.filename.endswith((".xlsx", ".xls")):
        raise HTTPException(400, "يجب رفع ملف Excel (.xlsx)")

    data = await file.read()
    rows = _parse_excel(data)

    imported = updated = skipped = 0
    seen_emails = set()

    for row in rows:
        email_lower = row["email"].lower()
        if email_lower in seen_emails:
            continue
        seen_emails.add(email_lower)

        existing = db.query(Employee).filter(func.lower(Employee.email) == email_lower).first()
        if existing:
            # Update code if we now have one and didn't before
            changed = False
            if row["code"] and existing.employee_code != row["code"]:
                existing.employee_code = row["code"]
                changed = True
            if changed:
                updated += 1
            else:
                skipped += 1
        else:
            emp = Employee(
                email=row["email"],
                employee_code=row["code"],
                name=_derive_name(row["email"]),
                domain=row["domain"],
            )
            db.add(emp)
            imported += 1

    db.commit()
    return EmployeeImportResult(
        imported=imported,
        updated=updated,
        skipped=skipped,
        total=imported + updated + skipped,
    )


# ── Sync engineer codes from directory ────────────────────────────────────────

@router.post("/sync-engineers")
def sync_engineer_codes(db: Session = Depends(get_db), _=Depends(require_admin)):
    """
    Match IT engineers to employee directory by email,
    and fill in employee_code where missing.
    """
    engineers = db.query(ITEngineer).all()
    synced = 0
    for eng in engineers:
        if eng.employee_code:
            continue
        emp = db.query(Employee).filter(
            func.lower(Employee.email) == eng.email.lower()
        ).first()
        if emp and emp.employee_code:
            eng.employee_code = emp.employee_code
            synced += 1
    db.commit()
    return {"synced": synced, "total_engineers": len(engineers)}
