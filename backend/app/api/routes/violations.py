"""Violation endpoints (read-only, scoped to scan)."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_staff
from app.models.entities import Scan, Violation
from app.schemas.schemas import ApiResponse, Paginated, ViolationRead

router = APIRouter(prefix="/violations", tags=["violations"], dependencies=[Depends(require_staff)])


@router.get("", response_model=ApiResponse[Paginated[ViolationRead]])
def list_violations(
    scan_id: int = Query(..., description="Parent scan ID"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    field_key: str | None = Query(None),
    status: str | None = Query(None),
    db: Session = Depends(get_db),
):
    scan = db.get(Scan, scan_id)
    if not scan:
        raise HTTPException(404, "Scan not found")

    query = db.query(Violation).filter(Violation.scan_id == scan_id)
    if field_key:
        query = query.filter(Violation.field_key == field_key)
    if status:
        query = query.filter(Violation.status == status)

    total = query.count()
    items = query.order_by(Violation.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return ApiResponse(data=Paginated(
        items=[ViolationRead.model_validate(v) for v in items],
        total=total, page=page, page_size=page_size,
        total_pages=(total + page_size - 1) // page_size
    ))


@router.get("/scan/{scan_id}/summary", response_model=ApiResponse[dict])
def violations_summary(scan_id: int, db: Session = Depends(get_db)):
    scan = db.get(Scan, scan_id)
    if not scan:
        raise HTTPException(404, "Scan not found")

    violations = db.query(Violation).filter(Violation.scan_id == scan_id).all()
    by_status = {}
    for v in violations:
        by_status.setdefault(v.status.value, 0)
        by_status[v.status.value] += 1

    return ApiResponse(data={
        "scan_id": scan_id,
        "total": len(violations),
        "by_status": by_status,
        "fields": [v.field_key for v in violations],
    })