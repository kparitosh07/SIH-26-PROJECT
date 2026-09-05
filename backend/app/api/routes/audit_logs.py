"""Audit log endpoints (read-only)."""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_admin
from app.models.entities import AuditLog, User
from app.schemas.schemas import ApiResponse, AuditLogRead, AuditLogDetail, Paginated, StatsSummary

router = APIRouter(prefix="/audit-logs", tags=["audit-logs"], dependencies=[Depends(require_admin)])


@router.get("", response_model=ApiResponse[Paginated[AuditLogRead]])
def list_audit_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    action: str | None = Query(None),
    user_id: int | None = Query(None),
    resource: str | None = Query(None),
    date_from: datetime | None = Query(None),
    date_to: datetime | None = Query(None),
    db: Session = Depends(get_db),
):
    query = db.query(AuditLog)
    if action:
        query = query.filter(AuditLog.action.ilike(f"%{action}%"))
    if user_id:
        query = query.filter(AuditLog.user_id == user_id)
    if resource:
        query = query.filter(AuditLog.resource == resource)
    if date_from:
        query = query.filter(AuditLog.created_at >= date_from)
    if date_to:
        query = query.filter(AuditLog.created_at <= date_to)

    total = query.count()
    items = query.order_by(AuditLog.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return ApiResponse(data=Paginated(
        items=[AuditLogRead.model_validate(a) for a in items],
        total=total, page=page, page_size=page_size,
        total_pages=(total + page_size - 1) // page_size
    ))


@router.get("/stats/summary", response_model=ApiResponse[StatsSummary])
def audit_stats(db: Session = Depends(get_db)):
    from app.models.entities import Scan, Report, Violation
    total_users = db.query(func.count(User.id)).scalar() or 0
    total_scans = db.query(func.count(Scan.id)).scalar() or 0
    total_violations = db.query(func.count(Violation.id)).scalar() or 0
    total_reports = db.query(func.count(Report.id)).scalar() or 0
    admin_count = db.query(func.count(User.id)).filter(User.role == "admin").scalar() or 0
    return ApiResponse(data=StatsSummary(
        total_users=total_users,
        total_scans=total_scans,
        total_violations=total_violations,
        total_reports=total_reports,
        admin_count=admin_count,
    ))


@router.get("/{log_id}", response_model=ApiResponse[AuditLogDetail])
def get_audit_log(log_id: int, db: Session = Depends(get_db)):
    log = db.get(AuditLog, log_id)
    if not log:
        raise HTTPException(404, "Audit log not found")
    detail = AuditLogDetail.model_validate(log)
    if log.user_id:
        detail.user = db.get(User, log.user_id)
    return ApiResponse(data=detail)