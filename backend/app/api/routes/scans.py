"""Scan endpoints: upload, list, detail, retry, delete."""
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Query, Request, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_user, require_staff
from app.core.logging import get_logger
from app.core.rate_limit import limiter
from app.models.entities import Scan, ScanStatus, ScanSeverity, Violation, UserRole
from app.schemas.schemas import ApiResponse, Paginated, ScanActionRequest, ScanDetail, ScanRead
from app.services.audit import log_action
from app.services.storage import get_storage
from app.tasks.scan_tasks import process_scan_task, run_scan_processing

logger = get_logger("scans")
router = APIRouter(prefix="/scans", tags=["scans"], dependencies=[Depends(require_staff)])

storage = get_storage()
ALLOWED_EXTS = {".png", ".jpg", ".jpeg", ".pdf", ".webp", ".bmp"}
MAX_SIZE = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024


def _is_redis_alive() -> bool:
    import socket
    from urllib.parse import urlparse
    try:
        url = urlparse(settings.REDIS_URL)
        host = url.hostname or "localhost"
        port = url.port or 6379
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(0.2)
        s.connect((host, port))
        s.close()
        return True
    except Exception:
        return False


def _dispatch_scan(scan_id: int, background_tasks: BackgroundTasks):
    background_tasks.add_task(run_scan_processing, scan_id)
    if _is_redis_alive():
        try:
            process_scan_task.apply_async(args=[scan_id], connect_timeout=1)
        except Exception as err:
            logger.debug("Celery dispatch skipped/failed: %s", err)


@router.post("/upload", response_model=ApiResponse[ScanRead], status_code=status.HTTP_201_CREATED)
@limiter.limit(settings.RATE_LIMIT_UPLOAD)
async def upload_scan(
    request: Request,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    product_id: int | None = Query(None),
    db: Session = Depends(get_db),
    user = Depends(get_current_user),
):
    # Validate file type/size
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXTS:
        raise HTTPException(400, f"Unsupported file type. Allowed: {', '.join(ALLOWED_EXTS)}")

    content = await file.read()
    if len(content) > MAX_SIZE:
        raise HTTPException(400, f"File too large. Max {settings.MAX_UPLOAD_SIZE_MB} MB")

    # Check duplicate
    import hashlib
    file_hash = hashlib.sha256(content).hexdigest()
    existing = db.query(Scan).filter(Scan.file_hash == file_hash, Scan.user_id == user.id).first()
    if existing:
        log_action(db, user, "scan.duplicate_detected", "scans", existing.id, {"file_hash": file_hash}, request)
        return ApiResponse(data=ScanRead.model_validate(existing), message="Duplicate file detected (already scanned)")

    # Save to storage
    import io
    folder = f"scans/{datetime.utcnow().strftime('%Y/%m/%d')}/{user.id}"
    key, _, size = storage.save(io.BytesIO(content), folder, ext)

    scan = Scan(
        user_id=user.id,
        product_id=product_id,
        original_filename=file.filename or f"scan_{uuid.uuid4().hex}{ext}",
        file_path=key,
        file_hash=file_hash,
        file_size_bytes=size,
        content_type=file.content_type or "application/octet-stream",
        status=ScanStatus.UPLOADED,
        progress=0,
    )
    db.add(scan)
    db.commit()
    db.refresh(scan)

    # Queue background task
    _dispatch_scan(scan.id, background_tasks)

    log_action(db, user, "scan.uploaded", "scans", scan.id, {"filename": scan.original_filename, "size": size}, request)
    return ApiResponse(data=ScanRead.model_validate(scan), message="Upload accepted, processing started")


@router.get("", response_model=ApiResponse[Paginated[ScanRead]])
def list_scans(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: ScanStatus | None = Query(None),
    verdict: ScanSeverity | None = Query(None),
    product_id: int | None = Query(None),
    search: str | None = Query(None),
    db: Session = Depends(get_db),
    user = Depends(get_current_user),
):
    query = db.query(Scan)
    if user.role not in [UserRole.ADMIN, UserRole.AUDITOR]:
        query = query.filter(Scan.user_id == user.id)
    if status:
        query = query.filter(Scan.status == status)
    if verdict:
        query = query.filter(Scan.verdict == verdict)
    if product_id:
        query = query.filter(Scan.product_id == product_id)
    if search:
        query = query.filter(Scan.original_filename.ilike(f"%{search}%"))

    total = query.count()
    items = query.order_by(Scan.created_at.desc(), Scan.id.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return ApiResponse(data=Paginated(
        items=[ScanRead.model_validate(s) for s in items],
        total=total, page=page, page_size=page_size,
        total_pages=(total + page_size - 1) // page_size
    ))


@router.get("/stats/overview", response_model=ApiResponse[dict[str, Any]])
def scans_overview(db: Session = Depends(get_db), user = Depends(get_current_user)):
    base = db.query(Scan).filter(Scan.user_id == user.id)
    total = base.count()
    completed = base.filter(Scan.status == ScanStatus.COMPLETED).count()
    failed = base.filter(Scan.status == ScanStatus.FAILED).count()
    passed = base.filter(Scan.verdict == ScanSeverity.PASS).count()
    avg_conf = db.query(func.avg(Scan.ocr_confidence)).filter(Scan.user_id == user.id).scalar()
    avg_score = db.query(func.avg(Scan.compliance_score)).filter(Scan.user_id == user.id).scalar()

    return ApiResponse(data={
        "total_scans": total,
        "completed_scans": completed,
        "failed_scans": failed,
        "passed_scans": passed,
        "pass_rate": round(passed / completed * 100, 1) if completed else 0,
        "avg_ocr_confidence": round(float(avg_conf), 2) if avg_conf else None,
        "avg_compliance_score": round(float(avg_score), 2) if avg_score else None,
    })


@router.get("/{scan_id}", response_model=ApiResponse[ScanDetail])
def get_scan(scan_id: int, db: Session = Depends(get_db), user = Depends(get_current_user)):
    scan = db.get(Scan, scan_id)
    if not scan or scan.user_id != user.id:
        raise HTTPException(404, "Scan not found")

    violations = db.query(Violation).filter(Violation.scan_id == scan_id).all()
    scan_detail = ScanDetail.model_validate(scan)
    scan_detail.violations = [v for v in violations]
    return ApiResponse(data=scan_detail)


@router.get("/{scan_id}/download", response_class=FileResponse)
def download_scan_file(scan_id: int, db: Session = Depends(get_db), user = Depends(get_current_user)):
    scan = db.get(Scan, scan_id)
    if not scan or scan.user_id != user.id:
        raise HTTPException(404, "Scan not found")

    file_path = storage.get_path(scan.file_path)
    if not file_path.exists():
        raise HTTPException(404, "File not found on storage")

    return FileResponse(path=str(file_path), filename=scan.original_filename, media_type=scan.content_type)


@router.post("/{scan_id}/action", response_model=ApiResponse[ScanRead])
def scan_action(scan_id: int, payload: ScanActionRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db), user = Depends(get_current_user)):
    scan = db.get(Scan, scan_id)
    if not scan or scan.user_id != user.id:
        raise HTTPException(404, "Scan not found")

    if payload.action == "retry":
        if scan.status not in (ScanStatus.FAILED, ScanStatus.COMPLETED):
            raise HTTPException(400, "Can only retry failed or completed scans")
        scan.status = ScanStatus.UPLOADED
        scan.progress = 0
        scan.error_message = None
        db.commit()
        _dispatch_scan(scan.id, background_tasks)
        log_action(db, user, "scan.retry", "scans", scan.id, request=None)

    elif payload.action == "reprocess":
        if scan.status != ScanStatus.COMPLETED:
            raise HTTPException(400, "Can only reprocess completed scans")
        scan.status = ScanStatus.UPLOADED
        scan.progress = 0
        db.commit()
        _dispatch_scan(scan.id, background_tasks)
        log_action(db, user, "scan.reprocess", "scans", scan.id, request=None)

    else:
        raise HTTPException(400, "Invalid action")

    db.refresh(scan)
    return ApiResponse(data=ScanRead.model_validate(scan), message=f"Scan {payload.action} queued")


@router.delete("/{scan_id}", response_model=ApiResponse[None], status_code=status.HTTP_200_OK)
def delete_scan(scan_id: int, db: Session = Depends(get_db), user = Depends(get_current_user)):
    scan = db.get(Scan, scan_id)
    if not scan or scan.user_id != user.id:
        raise HTTPException(404, "Scan not found")

    # Delete file from storage
    storage.delete(scan.file_path)
    db.delete(scan)
    db.commit()
    log_action(db, user, "scan.deleted", "scans", scan_id, request=None)
    return ApiResponse(message="Scan deleted")