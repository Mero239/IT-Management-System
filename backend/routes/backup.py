import io
import os
import zipfile
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse, StreamingResponse
from routes.auth import get_current_engineer
from paths import data_path
from root_config import is_root

router = APIRouter(prefix="/backup", tags=["backup"])

# Read-only bind mount of the full repo (backend + frontend + git history),
# set up in docker-compose.yml specifically so this endpoint can produce a
# real source-code backup rather than just the backend half baked into the
# running image at /app.
REPO_DIR = "/repo"
CODE_EXCLUDE_DIRS = {".git", "node_modules", "dist", "__pycache__", ".venv", "venv"}


def _require_admin(engineer):
    # Backups expose the full DB, source code, and logs — restricted to the
    # root account only, not every admin.
    if not is_root(engineer):
        raise HTTPException(403, "هذا الإجراء مقصور على حساب Root فقط")


def _ts() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")


def _dir_stats(path: str):
    if not os.path.isdir(path):
        return 0, 0
    files = [f for f in os.listdir(path) if os.path.isfile(os.path.join(path, f))]
    size = sum(os.path.getsize(os.path.join(path, f)) for f in files)
    return len(files), size


@router.get("/status")
def backup_status(engineer=Depends(get_current_engineer)):
    _require_admin(engineer)
    db_path = data_path("it_management.db")
    db_size = os.path.getsize(db_path) if os.path.exists(db_path) else 0
    log_count, log_size = _dir_stats(data_path("logs"))
    return {
        "database": {"available": db_size > 0, "size_bytes": db_size},
        "code": {"available": os.path.isdir(REPO_DIR)},
        "logs": {"available": log_count > 0, "size_bytes": log_size, "file_count": log_count},
    }


@router.get("/database")
def backup_database(engineer=Depends(get_current_engineer)):
    _require_admin(engineer)
    db_path = data_path("it_management.db")
    if not os.path.exists(db_path):
        raise HTTPException(404, "ملف قاعدة البيانات غير موجود")
    return FileResponse(db_path, filename=f"it_management_{_ts()}.db", media_type="application/octet-stream")


@router.get("/code")
def backup_code(engineer=Depends(get_current_engineer)):
    _require_admin(engineer)
    if not os.path.isdir(REPO_DIR):
        raise HTTPException(404, "نسخة الكود غير متاحة — مسار المستودع غير مربوط بالحاوية")

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for root, dirs, files in os.walk(REPO_DIR):
            dirs[:] = [d for d in dirs if d not in CODE_EXCLUDE_DIRS]
            for fname in files:
                full = os.path.join(root, fname)
                arcname = os.path.relpath(full, REPO_DIR)
                try:
                    zf.write(full, arcname)
                except OSError:
                    continue  # skip unreadable files (broken symlinks, sockets, etc.)
    buf.seek(0)
    filename = f"itms_code_{_ts()}.zip"
    return StreamingResponse(
        buf, media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/logs")
def backup_logs(engineer=Depends(get_current_engineer)):
    _require_admin(engineer)
    log_dir = data_path("logs")
    count, _ = _dir_stats(log_dir)
    if not count:
        raise HTTPException(404, "لا توجد ملفات سجلات بعد")

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for fname in os.listdir(log_dir):
            full = os.path.join(log_dir, fname)
            if os.path.isfile(full):
                zf.write(full, fname)
    buf.seek(0)
    filename = f"itms_logs_{_ts()}.zip"
    return StreamingResponse(
        buf, media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
