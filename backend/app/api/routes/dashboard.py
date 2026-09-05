"""Dashboard analytics endpoints."""
from datetime import datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, case
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_staff
from app.models.entities import Scan, ScanSeverity, ScanStatus, User, Violation
from app.schemas.schemas import ApiResponse, DashboardResponse, RecentScan, StatusTrendPoint, CategoryPoint, ViolationPoint
from app.core.config import settings

router = APIRouter(prefix="/dashboard", tags=["dashboard"], dependencies=[Depends(require_staff)])


@router.get("/overview", response_model=ApiResponse[DashboardResponse])
def dashboard_overview(
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db),
):
    since = datetime.utcnow() - timedelta(days=days)

    # User-specific or global (admin sees all)
    # Note: for multi-user we'd filter by user_id; here returning global for admin simplicity
    total_scans = db.query(func.count(Scan.id)).filter(Scan.created_at >= since).scalar() or 0
    completed = db.query(func.count(Scan.id)).filter(Scan.status == ScanStatus.COMPLETED, Scan.created_at >= since).scalar() or 0
    failed = db.query(func.count(Scan.id)).filter(Scan.status == ScanStatus.FAILED, Scan.created_at >= since).scalar() or 0
    passed = db.query(func.count(Scan.id)).filter(Scan.verdict == ScanSeverity.PASS, Scan.created_at >= since).scalar() or 0
    avg_conf = db.query(func.avg(Scan.ocr_confidence)).filter(Scan.created_at >= since).scalar()
    avg_score = db.query(func.avg(Scan.compliance_score)).filter(Scan.created_at >= since).scalar()
    active_users = db.query(func.count(User.id.distinct())).join(Scan).filter(Scan.created_at >= since).scalar() or 0

    # Status trend (last N days)
    trend = []
    for i in range(days):
        day_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=days - 1 - i)
        day_end = day_start + timedelta(days=1)
        day_scans = db.query(Scan).filter(Scan.created_at >= day_start, Scan.created_at < day_end).all()
        t = len(day_scans)
        f = sum(1 for s in day_scans if s.verdict in (ScanSeverity.CRITICAL, ScanSeverity.MAJOR))
        p = sum(1 for s in day_scans if s.verdict == ScanSeverity.PASS)
        trend.append(StatusTrendPoint(date=day_start.strftime("%Y-%m-%d"), total=t, failed=f, passed=p))

    # Violation distribution by field_key
    viol_counts = db.query(Violation.field_key, func.count(Violation.id)).join(Scan).filter(
        Scan.created_at >= since, Violation.status != ScanSeverity.PASS
    ).group_by(Violation.field_key).all()

    labels_map = {
        "mrp": "MRP", "net_quantity": "Net Quantity", "manufacturer": "Manufacturer",
        "dates": "Best Before / Expiry", "customer_care": "Customer Care",
        "address": "Address", "fssai": "FSSAI", "batch_number": "Batch/Lot",
    }
    top_violations = [
        ViolationPoint(field_key=k, label=labels_map.get(k, k), count=c)
        for k, c in sorted(viol_counts, key=lambda x: -x[1])[:10]
    ]

    # Category distribution (placeholder)
    category_distribution = [
        CategoryPoint(label="Food", value=45),
        CategoryPoint(label="Cosmetics", value=30),
        CategoryPoint(label="Pharma", value=15),
        CategoryPoint(label="Other", value=10),
    ]

    # Recent scans
    recent = db.query(Scan).order_by(Scan.created_at.desc()).limit(5).all()
    recent_scans = [
        RecentScan(
            id=s.id,
            original_filename=s.original_filename,
            status=s.status,
            verdict=s.verdict,
            compliance_score=s.compliance_score,
            created_at=s.created_at,
            user=None,  # skip join for performance
        )
        for s in recent
    ]

    return ApiResponse(data=DashboardResponse(
        overview={
            "total_scans": total_scans,
            "completed_scans": completed,
            "fail_scans": failed,
            "pass_rate": round(passed / completed * 100, 1) if completed else 0,
            "avg_ocr_confidence": round(float(avg_conf), 2) if avg_conf else None,
            "avg_compliance_score": round(float(avg_score), 2) if avg_score else None,
            "last_24h_scans": db.query(func.count(Scan.id)).filter(Scan.created_at >= datetime.utcnow() - timedelta(hours=24)).scalar() or 0,
            "active_users": active_users,
        },
        status_trend=trend,
        category_distribution=category_distribution,
        top_violations=top_violations,
        recent_scans=recent_scans,
    ))