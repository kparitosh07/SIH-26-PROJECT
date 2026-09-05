"""Background scan processing task: OCR -> rule engine -> persist."""
from __future__ import annotations

import traceback
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from celery import shared_task
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.logging import get_logger
from app.models.entities import Product, Scan, ScanSeverity, ScanStatus, Violation
from app.services.ocr_pipeline import run_ocr
from app.services.product_matcher import match_product
from app.services.rule_engine import evaluate_compliance
from app.services.storage import get_storage

logger = get_logger("scan_task")

storage = get_storage()


def _update_scan_status(db: Session, scan_id: int, status: ScanStatus, progress: int, error: str | None = None):
    scan = db.get(Scan, scan_id)
    if scan:
        scan.status = status
        scan.progress = progress
        scan.error_message = error
        db.commit()


@shared_task(bind=True, max_retries=3, default_retry_delay=60, name="app.tasks.scan_tasks.process_scan_task")
def process_scan_task(self, scan_id: int) -> dict[str, Any]:
    db: Session = SessionLocal()
    try:
        scan = db.get(Scan, scan_id)
        if not scan:
            logger.error("Scan %s not found", scan_id)
            return {"status": "error", "message": "Scan not found"}

        _update_scan_status(db, scan_id, ScanStatus.PROCESSING, 10)
        logger.info("Starting scan %s: %s", scan_id, scan.original_filename)

        # 1. Resolve file path
        file_path = storage.get_path(scan.file_path)
        if not file_path.exists():
            raise FileNotFoundError(f"File missing at {file_path}")

        # 2. OCR
        _update_scan_status(db, scan_id, ScanStatus.PROCESSING, 25)
        ocr = run_ocr(file_path)

        scan.raw_ocr_text = ocr.raw_text
        scan.ocr_confidence = ocr.confidence
        scan.ocr_engine = ocr.engine
        scan.ocr_latency_ms = ocr.latency_ms
        db.commit()

        # 3. Rule engine
        _update_scan_status(db, scan_id, ScanStatus.PROCESSING, 55)
        report = evaluate_compliance(ocr.raw_text)

        # 4. Product match (optional)
        candidates = db.query(Product).all()
        matched = match_product(ocr.raw_text, candidates)
        if matched:
            scan.product_id = matched.id

        # 5. Persist violations
        _update_scan_status(db, scan_id, ScanStatus.PROCESSING, 75)
        for vr in report.results:
            violation = Violation(
                scan_id=scan_id,
                field_key=vr.key,
                label=vr.label,
                status=vr.status,
                message=vr.message,
                evidence=vr.evidence,
                regex_pattern=vr.regex_pattern,
                extracted_value=vr.extracted_value,
            )
            db.add(violation)

        # 6. Finalize scan
        scan.extracted_fields = report.extracted_fields
        scan.compliance_score = report.score
        scan.verdict = report.verdict
        scan.status = ScanStatus.COMPLETED
        scan.progress = 100
        scan.completed_at = datetime.now(timezone.utc)
        db.commit()

        logger.info("Scan %s completed: score=%.2f verdict=%s", scan_id, report.score, report.verdict.value)
        return {"status": "completed", "score": report.score, "verdict": report.verdict.value}

    except Exception as exc:
        logger.exception("Scan %s failed: %s", scan_id, exc)
        _update_scan_status(db, scan_id, ScanStatus.FAILED, 0, traceback.format_exc(limit=3))
        try:
            raise self.retry(exc=exc)
        except Exception:
            return {"status": "error", "message": str(exc)}
    finally:
        db.close()