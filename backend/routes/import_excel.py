from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException
from sqlalchemy.orm import Session
import openpyxl
import io
import json
from database import get_db
import models

router = APIRouter(prefix="/import", tags=["import"])

PRIORITY_NORMALIZE = {
    'low': 'low', 'منخفضة': 'low', 'منخفض': 'low',
    'medium': 'medium', 'متوسطة': 'medium', 'متوسط': 'medium', 'normal': 'medium',
    'high': 'high', 'عالية': 'high', 'عالي': 'high',
    'critical': 'critical', 'حرجة': 'critical', 'حرج': 'critical', 'urgent': 'critical',
}

ASSET_TYPE_NORMALIZE = {
    'hardware': 'hardware', 'عتاد': 'hardware', 'جهاز': 'hardware', 'أجهزة': 'hardware',
    'software': 'software', 'برمجيات': 'software', 'برنامج': 'software', 'تطبيق': 'software',
    'network': 'network', 'شبكات': 'network', 'شبكة': 'network',
    'service': 'service', 'خدمة': 'service', 'خدمات': 'service',
    'other': 'other', 'أخرى': 'other', 'أخرى': 'other',
}


def cell_str(val):
    if val is None:
        return ''
    return str(val).strip()


def get_val(row, spec):
    """spec is either an int (column index) or a fixed string value."""
    if spec is None or spec == '' or spec == -1:
        return ''
    if isinstance(spec, int):
        try:
            return cell_str(row[spec])
        except IndexError:
            return ''
    return str(spec)


def get_or_create_dept(name, db):
    if not name:
        return None
    dept = db.query(models.Department).filter(
        models.Department.name.ilike(name.strip())
    ).first()
    if not dept:
        dept = models.Department(name=name.strip())
        db.add(dept)
        db.flush()
    return dept.id


@router.post("/preview")
async def preview_excel(file: UploadFile = File(...)):
    """Upload an Excel file and return headers + first 8 sample rows."""
    if not file.filename.lower().endswith(('.xlsx', '.xls', '.xlsm')):
        raise HTTPException(400, "Only Excel files (.xlsx / .xls) are supported")

    content = await file.read()
    try:
        wb = openpyxl.load_workbook(io.BytesIO(content), data_only=True, read_only=True)
    except Exception as e:
        raise HTTPException(400, f"Cannot read file: {e}")

    ws = wb.active
    rows = [r for r in ws.iter_rows(values_only=True)]
    wb.close()

    if not rows:
        raise HTTPException(400, "File is empty")

    headers = [cell_str(h) or f"Column {i + 1}" for i, h in enumerate(rows[0])]
    sample = [[cell_str(v) for v in row] for row in rows[1:9]]

    return {
        "headers": headers,
        "sample_rows": sample,
        "total_data_rows": max(0, len(rows) - 1),
        "filename": file.filename,
    }


@router.post("/execute")
async def execute_import(
    file: UploadFile = File(...),
    mapping: str = Form(...),   # JSON: {field: colIndex | fixedString}
    target: str = Form("requests"),   # "requests" | "assets" | "licensed_software"
    db: Session = Depends(get_db),
):
    """Execute the import with the provided column mapping."""
    content = await file.read()
    try:
        wb = openpyxl.load_workbook(io.BytesIO(content), data_only=True, read_only=True)
    except Exception as e:
        raise HTTPException(400, f"Cannot read file: {e}")

    ws = wb.active
    rows = [r for r in ws.iter_rows(values_only=True)]
    wb.close()

    if len(rows) < 2:
        raise HTTPException(400, "No data rows found (only header row detected)")

    try:
        col_map = json.loads(mapping)
        # Convert string keys that are digit strings to ints
        col_map = {k: (int(v) if isinstance(v, str) and v.lstrip('-').isdigit() else v)
                   for k, v in col_map.items()}
    except Exception:
        raise HTTPException(400, "Invalid mapping JSON")

    imported, skipped, errors = 0, 0, []

    for row_idx, row in enumerate(rows[1:], start=2):
        try:
            if target == "requests":
                title = get_val(row, col_map.get('title'))
                if not title:
                    skipped += 1
                    errors.append({"row": row_idx, "msg": "Empty title — skipped"})
                    continue

                dept_name = get_val(row, col_map.get('department_name'))
                dept_id = get_or_create_dept(dept_name, db) if dept_name else None

                qty_str = get_val(row, col_map.get('quantity'))
                try:
                    qty = max(1, int(float(qty_str))) if qty_str else 1
                except ValueError:
                    qty = 1

                raw_type = get_val(row, col_map.get('asset_type')).lower()
                asset_type = ASSET_TYPE_NORMALIZE.get(raw_type, 'software')

                raw_priority = get_val(row, col_map.get('priority')).lower()
                priority = PRIORITY_NORMALIZE.get(raw_priority, 'medium')

                currency_val = get_val(row, col_map.get('currency')) or 'USD'
                currency_val = currency_val.upper().strip()
                if currency_val not in ('USD', 'EUR', 'EGP'):
                    currency_val = 'USD'

                obj = models.NeedsRequest(
                    title=title,
                    description=get_val(row, col_map.get('description')),
                    requester_name=get_val(row, col_map.get('requester_name')),
                    requester_email=get_val(row, col_map.get('requester_email')),
                    department_id=dept_id,
                    asset_type=asset_type,
                    quantity=qty,
                    estimated_cost=get_val(row, col_map.get('estimated_cost')),
                    currency=currency_val,
                    priority=priority,
                    notes=get_val(row, col_map.get('notes')),
                    status='pending',
                )
                db.add(obj)

            elif target == "assets":
                name = get_val(row, col_map.get('name'))
                if not name:
                    skipped += 1
                    errors.append({"row": row_idx, "msg": "Empty name — skipped"})
                    continue

                dept_name = get_val(row, col_map.get('department_name'))
                dept_id = get_or_create_dept(dept_name, db) if dept_name else None

                raw_type = get_val(row, col_map.get('asset_type')).lower()
                asset_type = ASSET_TYPE_NORMALIZE.get(raw_type, 'hardware')

                serial = get_val(row, col_map.get('serial_number')) or None
                if serial:
                    exists = db.query(models.Asset).filter(
                        models.Asset.serial_number == serial
                    ).first()
                    if exists:
                        skipped += 1
                        errors.append({"row": row_idx, "msg": f"Serial '{serial}' already exists — skipped"})
                        continue

                obj = models.Asset(
                    name=name,
                    asset_type=asset_type,
                    brand=get_val(row, col_map.get('brand')),
                    model=get_val(row, col_map.get('model')),
                    serial_number=serial,
                    status='active',
                    location=get_val(row, col_map.get('location')),
                    assigned_to=get_val(row, col_map.get('assigned_to')),
                    department_id=dept_id,
                    notes=get_val(row, col_map.get('notes')),
                )
                db.add(obj)

            elif target == "licensed_software":
                software_name = get_val(row, col_map.get('software_name'))
                if not software_name:
                    skipped += 1
                    errors.append({"row": row_idx, "msg": "Empty software name — skipped"})
                    continue

                dept_name = get_val(row, col_map.get('department_name'))
                dept_id = get_or_create_dept(dept_name, db) if dept_name else None

                renewal_raw = get_val(row, col_map.get('license_renewal_date'))
                renewal_date = renewal_raw.split(' ')[0] if renewal_raw else None

                qty_str = get_val(row, col_map.get('quantity'))
                try:
                    qty = max(1, int(float(qty_str))) if qty_str else 1
                except ValueError:
                    qty = 1

                obj = models.LicensedSoftware(
                    software_name=software_name,
                    department_id=dept_id,
                    user_name=get_val(row, col_map.get('user_name')),
                    quantity=qty,
                    license_renewal_date=renewal_date,
                    notes=get_val(row, col_map.get('notes')),
                )
                db.add(obj)

            imported += 1

        except Exception as e:
            skipped += 1
            errors.append({"row": row_idx, "msg": str(e)})

    db.commit()

    return {
        "imported": imported,
        "skipped": skipped,
        "total": len(rows) - 1,
        "errors": errors[:50],   # return at most 50 error details
    }
