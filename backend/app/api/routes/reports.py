"""Report endpoints: generate, list, download."""
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_staff
from app.models.entities import Report, Scan, UserRole
from app.schemas.schemas import ApiResponse, Paginated, ReportGenerateRequest, ReportRead
from app.services.audit import log_action
from app.services.report_generator import generate_report


def _report_accessible(scan: Scan | None, user) -> bool:
    """Admins/auditors see all scans; other roles only their own."""
    if scan is None:
        return False
    if scan.user_id == user.id:
        return True
    return user.role in (UserRole.ADMIN, UserRole.AUDITOR)

router = APIRouter(prefix="/reports", tags=["reports"], dependencies=[Depends(require_staff)])


@router.post("/{scan_id}/generate", response_model=ApiResponse[ReportRead])
def generate(scan_id: int, payload: ReportGenerateRequest, db: Session = Depends(get_db), user = Depends(get_current_user)):
    scan = db.get(Scan, scan_id)
    if not scan:
        raise HTTPException(404, "Scan not found")

    if scan.status != "completed":
        raise HTTPException(400, "Scan not completed yet")

    # Fetch violations
    from app.models.entities import Violation
    violations = db.query(Violation).filter(Violation.scan_id == scan_id).all()
    violations_data = [
        {
            "field_key": v.field_key,
            "label": v.label,
            "status": v.status.value,
            "message": v.message,
            "evidence": v.evidence,
            "regex_pattern": v.regex_pattern,
            "extracted_value": v.extracted_value,
        }
        for v in violations
    ]

    path, sha256 = generate_report(scan, violations_data, payload)

    # One report record per scan: replace any previously generated report so
    # regeneration doesn't hit the unique constraint on reports.scan_id.
    existing = db.query(Report).filter(Report.scan_id == scan_id).first()
    if existing:
        from pathlib import Path as P
        P(existing.report_file_path).unlink(missing_ok=True)
        db.delete(existing)
        db.flush()

    report = Report(
        scan_id=scan_id,
        report_file_path=path,
        report_hash=sha256,
        generated_by=user.id,
        remarks=payload.remarks,
        meta={"violations_count": len(violations_data)},
    )
    db.add(report)
    db.commit()
    db.refresh(report)

    log_action(db, user, "report.generated", "reports", report.id, {"scan_id": scan_id}, None)
    return ApiResponse(data=ReportRead.model_validate(report), message="Report generated")


@router.get("", response_model=ApiResponse[Paginated[ReportRead]])
def list_reports(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    scan_id: int | None = Query(None),
    db: Session = Depends(get_db),
    user = Depends(get_current_user),
):
    query = db.query(Report).join(Scan).filter(Scan.user_id == user.id)
    if scan_id:
        query = query.filter(Report.scan_id == scan_id)

    total = query.count()
    items = query.order_by(Report.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return ApiResponse(data=Paginated(
        items=[ReportRead.model_validate(r) for r in items],
        total=total, page=page, page_size=page_size,
        total_pages=(total + page_size - 1) // page_size
    ))


@router.get("/{report_id}", response_model=ApiResponse[ReportRead])
def get_report(report_id: int, db: Session = Depends(get_db), user = Depends(get_current_user)):
    report = db.get(Report, report_id)
    if not report:
        raise HTTPException(404, "Report not found")
    # Verify access through scan
    scan = db.get(Scan, report.scan_id)
    if not _report_accessible(scan, user):
        raise HTTPException(404, "Report not found")
    return ApiResponse(data=ReportRead.model_validate(report))


@router.get("/{report_id}/download", response_class=FileResponse)
def download_report(report_id: int, db: Session = Depends(get_db), user = Depends(get_current_user)):
    report = db.get(Report, report_id)
    if not report:
        raise HTTPException(404, "Report not found")
    scan = db.get(Scan, report.scan_id)
    if not _report_accessible(scan, user):
        raise HTTPException(404, "Report not found")

    from pathlib import Path
    path = Path(report.report_file_path)
    if not path.exists():
        raise HTTPException(404, "Report file missing")

    return FileResponse(
        path=str(path),
        filename=f"compliance_report_scan_{scan.id}.pdf",
        media_type="application/pdf",
    )


@router.delete("/{report_id}", response_model=ApiResponse[None], status_code=200)
def delete_report(report_id: int, db: Session = Depends(get_db), user = Depends(get_current_user)):
    report = db.get(Report, report_id)
    if not report:
        raise HTTPException(404, "Report not found")
    scan = db.get(Scan, report.scan_id)
    if not _report_accessible(scan, user):
        raise HTTPException(404, "Report not found")

    from pathlib import Path
    Path(report.report_file_path).unlink(missing_ok=True)
    db.delete(report)
    db.commit()
    log_action(db, user, "report.deleted", "reports", report_id, None)
    return ApiResponse(message="Report deleted")