from fastapi import APIRouter, Depends, HTTPException, Header, Request, BackgroundTasks, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy import func
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel
from database import get_db, engine
from paths import data_path
import models
import secrets
import threading
import sqlite3
import shutil
import os
import tempfile
from datetime import datetime, timedelta, timezone
from services.auth import hash_password, verify_password, create_token, decode_token, DEFAULT_PASSWORD
from services.email_notifier import send_password_reset_email, send_otp_email, send_otp_admin_notice

DB_PATH = data_path('it_management.db')

# Non-admin (engineer / viewer) resets go through OTP instead of an email link;
# the admin below gets a copy notice for every such request.
OTP_NOTIFY_EMAIL = "amr.eisa@mobica.net"

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    email: str
    password: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class ForgotPasswordRequest(BaseModel):
    email: str


class ConfirmResetRequest(BaseModel):
    token: str
    new_password: str


class ConfirmOtpRequest(BaseModel):
    email: str
    code: str
    new_password: str


class UpdateProfileRequest(BaseModel):
    name: str
    role: Optional[str] = "IT Engineer"


def get_current_engineer(authorization: Optional[str] = Header(None), db: Session = Depends(get_db)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="غير مصرح")
    token = authorization.split(" ", 1)[1]
    try:
        payload = decode_token(token)
        eng_id = int(payload["sub"])
    except Exception:
        raise HTTPException(status_code=401, detail="جلسة منتهية أو غير صالحة")
    eng = db.query(models.ITEngineer).filter(models.ITEngineer.id == eng_id).first()
    if not eng or eng.active != "true":
        raise HTTPException(status_code=401, detail="الحساب غير نشط")
    return eng


@router.post("/login")
def login(data: LoginRequest, db: Session = Depends(get_db)):
    eng = db.query(models.ITEngineer).filter(
        func.lower(models.ITEngineer.email) == data.email.strip().lower()
    ).first()
    if not eng or eng.active != "true":
        raise HTTPException(status_code=401, detail="البريد الإلكتروني أو كلمة المرور غير صحيحة")

    # First login: password_hash is NULL → accept default password and set it
    if not eng.password_hash:
        if data.password != DEFAULT_PASSWORD:
            raise HTTPException(status_code=401, detail="البريد الإلكتروني أو كلمة المرور غير صحيحة")
        eng.password_hash = hash_password(DEFAULT_PASSWORD)
        db.commit()
    elif not verify_password(data.password, eng.password_hash):
        raise HTTPException(status_code=401, detail="البريد الإلكتروني أو كلمة المرور غير صحيحة")

    token = create_token(eng.id, eng.email, eng.permission_level)
    return {
        "token": token,
        "engineer": {
            "id": eng.id,
            "name": eng.name,
            "email": eng.email,
            "role": eng.role,
            "permission_level": eng.permission_level,
        },
    }


@router.get("/me")
def me(engineer=Depends(get_current_engineer)):
    return {
        "id": engineer.id,
        "name": engineer.name,
        "email": engineer.email,
        "role": engineer.role,
        "permission_level": engineer.permission_level,
        "created_at": engineer.created_at.isoformat() if engineer.created_at else None,
    }


@router.patch("/profile")
def update_profile(data: UpdateProfileRequest, engineer=Depends(get_current_engineer), db: Session = Depends(get_db)):
    if not data.name.strip():
        raise HTTPException(status_code=400, detail="الاسم لا يمكن أن يكون فارغاً")
    engineer.name = data.name.strip()
    engineer.role = (data.role or "IT Engineer").strip()
    db.commit()
    db.refresh(engineer)
    return {
        "id": engineer.id,
        "name": engineer.name,
        "email": engineer.email,
        "role": engineer.role,
        "permission_level": engineer.permission_level,
        "created_at": engineer.created_at.isoformat() if engineer.created_at else None,
    }


@router.post("/change-password")
def change_password(data: ChangePasswordRequest, engineer=Depends(get_current_engineer), db: Session = Depends(get_db)):
    if not engineer.password_hash:
        if data.current_password != DEFAULT_PASSWORD:
            raise HTTPException(status_code=400, detail="كلمة المرور الحالية غير صحيحة")
    elif not verify_password(data.current_password, engineer.password_hash):
        raise HTTPException(status_code=400, detail="كلمة المرور الحالية غير صحيحة")
    if len(data.new_password) < 6:
        raise HTTPException(status_code=400, detail="كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل")
    engineer.password_hash = hash_password(data.new_password)
    db.commit()
    return {"message": "تم تغيير كلمة المرور بنجاح"}


@router.post("/forgot-password")
def forgot_password(data: ForgotPasswordRequest, request: Request, db: Session = Depends(get_db)):
    eng = db.query(models.ITEngineer).filter(
        func.lower(models.ITEngineer.email) == data.email.strip().lower()
    ).first()
    # Always return 200 to avoid user enumeration
    if not eng or eng.active != "true":
        return {"message": "إذا كان البريد مسجلاً، ستصله رسالة خلال دقائق", "method": "link"}

    # Admins keep the classic email-link flow
    if eng.permission_level == "admin":
        db.query(models.PasswordResetToken).filter(
            models.PasswordResetToken.engineer_id == eng.id,
            models.PasswordResetToken.used == "false"
        ).update({"used": "true"})

        token_val = secrets.token_urlsafe(32)
        expires   = datetime.now(timezone.utc) + timedelta(hours=1)
        rec = models.PasswordResetToken(engineer_id=eng.id, token=token_val, expires_at=expires)
        db.add(rec)
        db.commit()

        origin = request.headers.get("origin", "http://localhost:5173")
        reset_link = f"{origin}/reset-password?token={token_val}"

        def _send_link():
            send_password_reset_email(eng.name, eng.email, reset_link)
        threading.Thread(target=_send_link, daemon=True).start()

        return {"message": "إذا كان البريد مسجلاً، ستصله رسالة خلال دقائق", "method": "link"}

    # Engineers / viewers: OTP sent to their own email, with a copy notice to the admin
    db.query(models.PasswordResetOTP).filter(
        models.PasswordResetOTP.engineer_id == eng.id,
        models.PasswordResetOTP.used == "false"
    ).update({"used": "true"})

    code = f"{secrets.randbelow(1_000_000):06d}"
    expires = datetime.now(timezone.utc) + timedelta(minutes=10)
    rec = models.PasswordResetOTP(engineer_id=eng.id, code=code, expires_at=expires)
    db.add(rec)
    db.commit()

    def _send_otp():
        send_otp_email(eng.name, eng.email, code)
        send_otp_admin_notice(eng.name, eng.email, OTP_NOTIFY_EMAIL)
    threading.Thread(target=_send_otp, daemon=True).start()

    return {"message": "إذا كان البريد مسجلاً، ستصلك رسالة تحتوي على كود تحقق (OTP)", "method": "otp"}


@router.post("/confirm-otp")
def confirm_otp(data: ConfirmOtpRequest, db: Session = Depends(get_db)):
    eng = db.query(models.ITEngineer).filter(
        func.lower(models.ITEngineer.email) == data.email.strip().lower()
    ).first()
    if not eng:
        raise HTTPException(status_code=400, detail="بيانات غير صحيحة")

    rec = (
        db.query(models.PasswordResetOTP)
        .filter(
            models.PasswordResetOTP.engineer_id == eng.id,
            models.PasswordResetOTP.code == data.code.strip(),
            models.PasswordResetOTP.used == "false",
        )
        .order_by(models.PasswordResetOTP.id.desc())
        .first()
    )
    if not rec:
        raise HTTPException(status_code=400, detail="كود التحقق غير صحيح")

    exp = rec.expires_at
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if datetime.now(timezone.utc) > exp:
        raise HTTPException(status_code=400, detail="انتهت صلاحية الكود — يرجى طلب كود جديد")
    if len(data.new_password) < 6:
        raise HTTPException(status_code=400, detail="كلمة المرور يجب أن تكون 6 أحرف على الأقل")

    eng.password_hash = hash_password(data.new_password)
    rec.used = "true"
    db.commit()
    return {"message": "تم تغيير كلمة المرور بنجاح — يمكنك تسجيل الدخول الآن"}


@router.post("/confirm-reset")
def confirm_reset(data: ConfirmResetRequest, db: Session = Depends(get_db)):
    rec = db.query(models.PasswordResetToken).filter(
        models.PasswordResetToken.token == data.token
    ).first()
    if not rec:
        raise HTTPException(status_code=400, detail="الرابط غير صالح أو منتهي الصلاحية")
    if rec.used == "true":
        raise HTTPException(status_code=400, detail="هذا الرابط استُخدم من قبل")
    exp = rec.expires_at
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if datetime.now(timezone.utc) > exp:
        raise HTTPException(status_code=400, detail="انتهت صلاحية الرابط — يرجى طلب رابط جديد")
    if len(data.new_password) < 6:
        raise HTTPException(status_code=400, detail="كلمة المرور يجب أن تكون 6 أحرف على الأقل")

    eng = db.query(models.ITEngineer).filter(models.ITEngineer.id == rec.engineer_id).first()
    if not eng:
        raise HTTPException(status_code=404, detail="الحساب غير موجود")

    eng.password_hash = hash_password(data.new_password)
    rec.used = "true"
    db.commit()
    return {"message": "تم تغيير كلمة المرور بنجاح — يمكنك تسجيل الدخول الآن"}


@router.get("/db-info")
def db_info(engineer=Depends(get_current_engineer)):
    if engineer.permission_level != "admin":
        raise HTTPException(status_code=403, detail="للمسؤولين فقط")
    db_path = os.path.abspath(DB_PATH)
    size_bytes = os.path.getsize(db_path)
    modified_at = datetime.fromtimestamp(os.path.getmtime(db_path), tz=timezone.utc).isoformat()

    conn = sqlite3.connect(db_path)
    cur  = conn.cursor()
    cur.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
    tables_raw = cur.fetchall()
    tables = []
    for (name,) in tables_raw:
        cur.execute(f'SELECT COUNT(*) FROM "{name}"')
        tables.append({"name": name, "rows": cur.fetchone()[0]})
    conn.close()

    return {
        "size_bytes": size_bytes,
        "size_kb": round(size_bytes / 1024, 1),
        "modified_at": modified_at,
        "tables": tables,
        "total_rows": sum(t["rows"] for t in tables),
    }


@router.get("/backup")
def download_backup(background_tasks: BackgroundTasks, engineer=Depends(get_current_engineer)):
    if engineer.permission_level != "admin":
        raise HTTPException(status_code=403, detail="للمسؤولين فقط")

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    tmp_path  = os.path.join(tempfile.gettempdir(), f"it_backup_{timestamp}.db")

    src = sqlite3.connect(os.path.abspath(DB_PATH))
    dst = sqlite3.connect(tmp_path)
    src.backup(dst)
    src.close()
    dst.close()

    background_tasks.add_task(os.unlink, tmp_path)

    return FileResponse(
        tmp_path,
        media_type="application/octet-stream",
        filename=f"it_management_backup_{timestamp}.db",
    )


@router.post("/restore")
async def restore_backup(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    engineer=Depends(get_current_engineer),
):
    if engineer.permission_level != "admin":
        raise HTTPException(status_code=403, detail="للمسؤولين فقط")

    # 1. Read uploaded content
    content = await file.read()
    if len(content) < 100:
        raise HTTPException(status_code=400, detail="الملف فارغ أو تالف")

    # 2. Validate SQLite magic bytes
    if not content.startswith(b"SQLite format 3\x00"):
        raise HTTPException(status_code=400, detail="الملف ليس قاعدة بيانات SQLite صالحة")

    # 3. Write to temp file and validate tables
    tmp_path = os.path.join(tempfile.gettempdir(), f"restore_validate_{datetime.now().strftime('%Y%m%d%H%M%S')}.db")
    with open(tmp_path, "wb") as f:
        f.write(content)

    try:
        check_conn = sqlite3.connect(tmp_path)
        check_cur  = check_conn.cursor()
        check_cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
        uploaded_tables = {row[0] for row in check_cur.fetchall()}

        # Collect info about uploaded DB
        uploaded_info = []
        for t in sorted(uploaded_tables):
            check_cur.execute(f'SELECT COUNT(*) FROM "{t}"')
            uploaded_info.append({"name": t, "rows": check_cur.fetchone()[0]})
        check_conn.close()
    except sqlite3.Error as e:
        os.unlink(tmp_path)
        raise HTTPException(status_code=400, detail=f"قاعدة البيانات تالفة: {e}")

    required = {"it_engineers", "support_tickets", "assets", "departments"}
    missing  = required - uploaded_tables
    if missing:
        os.unlink(tmp_path)
        raise HTTPException(status_code=400, detail=f"الملف لا يحتوي على الجداول المطلوبة: {', '.join(missing)}")

    # 4. Auto-save current DB before replacing
    db_path   = os.path.abspath(DB_PATH)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    pre_restore_path = os.path.join(
        os.path.dirname(db_path),
        f"pre_restore_{timestamp}.db",
    )
    src = sqlite3.connect(db_path)
    dst = sqlite3.connect(pre_restore_path)
    src.backup(dst)
    src.close()
    dst.close()

    # 5. Release all SQLAlchemy pool connections then replace file
    engine.dispose()
    shutil.copy2(tmp_path, db_path)
    background_tasks.add_task(os.unlink, tmp_path)

    return {
        "message": "تمت الاستعادة بنجاح",
        "pre_restore_backup": os.path.basename(pre_restore_path),
        "restored_tables": uploaded_info,
        "total_rows": sum(t["rows"] for t in uploaded_info),
        "file_size_kb": round(len(content) / 1024, 1),
    }


@router.post("/reset-password/{engineer_id}")
def reset_password(engineer_id: int, current_eng=Depends(get_current_engineer), db: Session = Depends(get_db)):
    if current_eng.permission_level != "admin":
        raise HTTPException(status_code=403, detail="هذا الإجراء للمسؤولين فقط")
    eng = db.query(models.ITEngineer).filter(models.ITEngineer.id == engineer_id).first()
    if not eng:
        raise HTTPException(status_code=404, detail="المهندس غير موجود")
    eng.password_hash = None
    db.commit()
    return {"message": f"تم إعادة تعيين كلمة مرور {eng.name} إلى الافتراضية ({DEFAULT_PASSWORD})"}
