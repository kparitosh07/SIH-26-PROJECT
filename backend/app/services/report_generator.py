"""Professional compliance report PDF generator using ReportLab.

Generates a structured, audit-ready PDF with:
- Cover page (scan metadata)
- Compliance summary table
- Violation details with evidence
- Extracted OCR fields
- Raw OCR text appendix
"""
from __future__ import annotations

import hashlib
import os
import textwrap
from datetime import datetime
from io import BytesIO
from pathlib import Path

from PIL import Image as PILImage, ImageOps
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    Frame,
    Image,
    PageTemplate,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from app.core.config import settings
from app.models.entities import Scan, ScanSeverity
from app.schemas.schemas import ReportGenerateRequest
from app.services.storage import get_storage


REPORT_DIR = Path(settings.REPORT_DIR)
REPORT_DIR.mkdir(parents=True, exist_ok=True)


# ---------------------------------------------------------------------------
# Styles
# ---------------------------------------------------------------------------
styles = getSampleStyleSheet()

title_style = ParagraphStyle("TitleLarge", parent=styles["Title"], fontSize=24, spaceAfter=12, alignment=TA_CENTER)
subtitle_style = ParagraphStyle("Subtitle", parent=styles["Normal"], fontSize=12, textColor=colors.HexColor("#555"), spaceAfter=6, alignment=TA_CENTER)


def _register_hindi_font() -> str:
    """Register a Devanagari-capable font so 'मानक' renders correctly."""
    candidates = [
        (r"C:\Windows\Fonts\Nirmala.ttc", 0),
        (r"C:\Windows\Fonts\mangal.ttf", None),
        ("/usr/share/fonts/truetype/noto/NotoSansDevanagari-Regular.ttf", None),
        ("/usr/share/fonts/opentype/noto/NotoSansDevanagari-Regular.ttf", None),
    ]
    for path, idx in candidates:
        if not Path(path).exists():
            continue
        try:
            if idx is not None:
                pdfmetrics.registerFont(TTFont("HindiFont", path, subfontIndex=idx))
            else:
                pdfmetrics.registerFont(TTFont("HindiFont", path))
            return "HindiFont"
        except Exception:
            continue
    return "Helvetica"


hindi_font = _register_hindi_font()
hindi_brand_style = ParagraphStyle(
    "HindiBrand",
    parent=styles["Normal"],
    fontName=hindi_font,
    fontSize=16,
    textColor=colors.HexColor("#2c5f8a"),
    spaceAfter=6,
    alignment=TA_CENTER,
)
heading1 = ParagraphStyle("H1", parent=styles["Heading1"], fontSize=16, spaceBefore=18, spaceAfter=10, textColor=colors.HexColor("#1e3a5f"))
heading2 = ParagraphStyle("H2", parent=styles["Heading2"], fontSize=13, spaceBefore=12, spaceAfter=6, textColor=colors.HexColor("#2c5f8a"))
body = ParagraphStyle("Body", parent=styles["Normal"], fontSize=10, leading=14, spaceAfter=6)
small = ParagraphStyle("Small", parent=styles["Normal"], fontSize=8, textColor=colors.HexColor("#777"))
mono = ParagraphStyle("Mono", parent=styles["Code"], fontSize=8, fontName="Courier", leading=10)

SEVERITY_COLOR = {
    ScanSeverity.PASS: colors.HexColor("#2e7d32"),
    ScanSeverity.MINOR: colors.HexColor("#f57c00"),
    ScanSeverity.MAJOR: colors.HexColor("#d84315"),
    ScanSeverity.CRITICAL: colors.HexColor("#b71c1c"),
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _sev_html(severity: ScanSeverity) -> str:
    color = SEVERITY_COLOR.get(severity, colors.grey)
    return f'<font color="{color.hexval()}"><b>{severity.value.upper()}</b></font>'


def _fmt_dt(dt: datetime | None) -> str:
    return dt.strftime("%Y-%m-%d %H:%M UTC") if dt else "—"


def _score_color(score: float | None) -> str:
    if score is None:
        return "#9e9e9e"
    if score >= 85:
        return "#2e7d32"
    if score >= 60:
        return "#f57c00"
    if score >= 35:
        return "#d84315"
    return "#b71c1c"


def _wrap(text: str, width: int = 90) -> str:
    return "<br/>".join(textwrap.wrap(text, width=width)) if text else "—"


def _is_compliant(score: float | None) -> bool:
    return score is not None and score >= 100


def _load_label_image(scan: Scan) -> Image | None:
    """Fetch the uploaded label from storage and return a fitted PNG flowable."""
    try:
        data = get_storage().read_bytes(scan.file_path)
        if not data:
            return None
        with ImageOps.exif_transpose(PILImage.open(BytesIO(data))) as src:
            if src.mode in ("RGBA", "P", "LA"):
                img = src.convert("RGB")
            else:
                img = src.convert("RGB")
            w, h = img.size
            buf = BytesIO()
            img.save(buf, format="JPEG", quality=92)
        buf.seek(0)
        max_w, max_h = 62 * mm, 78 * mm
        ratio = min(max_w / w, max_h / h, 1.5)
        return Image(buf, width=w * ratio, height=h * ratio)
    except Exception:
        return None


def _verdict_flowables(scan: Scan) -> list:
    score = scan.compliance_score
    compliant = _is_compliant(score)
    verdict_text = "COMPLIANT" if compliant else "NON-COMPLIANT"
    verdict_color = "#1b7a2f" if compliant else "#b71c1c"
    bg_color = "#e8f5e9" if compliant else "#fdecea"
    score_text = "N/A" if score is None else f"{score:.1f} / 100"

    block = [
        Paragraph(f"Scan ID: <b>{scan.id}</b>", body),
        Paragraph(f"File: <b>{scan.original_filename}</b>", body),
        Paragraph(f"Uploaded: <b>{_fmt_dt(scan.created_at)}</b>", body),
        (Paragraph(f"Inspector: <b>User ID {scan.user_id}</b>", body) if scan.user_id else Spacer(1, 0)),
        Spacer(1, 8 * mm),
        Paragraph(
            f'Overall Score: <font color="{_score_color(score)}"><b>{score_text}</b></font>',
            ParagraphStyle("ScoreStyle", parent=body, fontSize=13),
        ),
        Paragraph("", body),
        Paragraph(
            f'<font color="{verdict_color}" size="18"><b>{verdict_text}</b></font>',
            ParagraphStyle("VerdictStyle", parent=body, alignment=TA_LEFT, spaceBefore=4),
        ),
    ]

    inner = Table(
        [[block[-1]]],
        colWidths=[92 * mm],
        rowHeights=[12 * mm],
        style=TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor(bg_color)),
            ("BOX", (0, 0), (-1, -1), 1.2, colors.HexColor(verdict_color)),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (0, 0), (-1, -1), 6 * mm),
        ]),
    )
    block[-1] = inner
    return block


# ---------------------------------------------------------------------------
# Generator
# ---------------------------------------------------------------------------
def generate_report(
    scan: Scan,
    violations: list[dict],
    request: ReportGenerateRequest | None = None,
) -> tuple[str, str]:
    """Build PDF, save to REPORT_DIR, return (path, sha256)."""
    file_name = f"report_{scan.id}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.pdf"
    out_path = REPORT_DIR / file_name

    doc = SimpleDocTemplate(
        str(out_path),
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=18 * mm,
        bottomMargin=18 * mm,
    )

    story: list = []
    width, height = A4

    # ==================== COVER ====================
    story.append(Spacer(1, 24 * mm))
    story.append(Paragraph("Label Compliance Report", title_style))
    story.append(Spacer(1, 6 * mm))
    story.append(Paragraph("मानक (MANAK)", hindi_brand_style))
    story.append(Spacer(1, 12 * mm))

    left = _verdict_flowables(scan)
    image_flow = _load_label_image(scan)

    if image_flow is not None:
        caption = Paragraph("Uploaded label image", small)
        right = [
            image_flow,
            Spacer(1, 2 * mm),
            caption,
        ]
        cover = Table(
            [[left, right]],
            colWidths=[100 * mm, 62 * mm],
            style=TableStyle([
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("ALIGN", (1, 0), (1, -1), "CENTER"),
                ("LEFTPADDING", (0, 0), (-1, -1), 2),
                ("RIGHTPADDING", (0, 0), (-1, -1), 2),
            ]),
        )
    else:
        cover = Table(
            [[left]],
            colWidths=[172 * mm],
            style=TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]),
        )
    story.append(cover)
    story.append(Spacer(1, 10 * mm))
    story.append(Paragraph(settings.PDF_LICENSE_HEADER, small))
    story.append(Spacer(1, 18 * mm))

    # ==================== COMPLIANCE SUMMARY ====================
    story.append(Paragraph("1. Compliance Summary", heading1))

    fields = [
        "mrp", "net_quantity", "manufacturer", "dates",
        "customer_care", "address", "fssai", "batch_number"
    ]
    labels = [
        "MRP", "Net Quantity", "Manufacturer", "Best Before / Expiry",
        "Customer Care", "Address", "FSSAI License", "Batch / Lot"
    ]

    v_by_key = {v["field_key"]: v for v in violations}
    cell_center = ParagraphStyle("CellCenter", parent=small, alignment=TA_CENTER)
    rows = [["#", "Field", "Status", "Extracted Value", "Evidence"]]
    for i, (f, lbl) in enumerate(zip(fields, labels), 1):
        v = v_by_key.get(f)
        if v:
            status = Paragraph(_sev_html(ScanSeverity(v["status"])), cell_center)
            val = Paragraph(_wrap(v.get("extracted_value") or "—"), small)
            ev = Paragraph(_wrap(v.get("evidence") or "—"), small)
        else:
            status = Paragraph(_sev_html(ScanSeverity.PASS), cell_center)
            val = Paragraph("—", small)
            ev = Paragraph("Not found", small)
        rows.append([str(i), lbl, status, val, ev])

    table = Table(rows, colWidths=[25 * mm, 35 * mm, 25 * mm, 50 * mm, 55 * mm])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e3a5f")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#ddd")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f9f9f9")]),
    ]))
    story.append(table)
    story.append(Spacer(1, 10 * mm))

    # ==================== VIOLATION DETAIL ====================
    story.append(Paragraph("2. Violation Details", heading1))
    failing = [v for v in violations if v["status"] != ScanSeverity.PASS.value]
    if not failing:
        story.append(Paragraph("No violations detected. All mandatory fields present and well-formed.", body))
    else:
        for v in failing:
            sev = ScanSeverity(v["status"])
            story.append(Paragraph(f"<b>{v['label']}</b> — {_sev_html(sev)}", body))
            story.append(Paragraph(f"Message: {v['message']}", body))
            if v.get("extracted_value"):
                story.append(Paragraph(f"Extracted: <font face='Courier'>{v['extracted_value']}</font>", body))
            if v.get("evidence"):
                story.append(Paragraph(f"Evidence (OCR): <font face='Courier'>{_wrap(v['evidence'], 100)}</font>", body))
            if v.get("regex_pattern"):
                story.append(Paragraph(f"Pattern: <font face='Courier' size='7'>{v['regex_pattern']}</font>", small))
            story.append(Spacer(1, 4 * mm))

    # ==================== EXTRACTED FIELDS ====================
    story.append(Paragraph("3. Extracted Structured Fields", heading1))
    if scan.extracted_fields:
        ef_rows = [["Field", "Value"]]
        for k, val in scan.extracted_fields.items():
            ef_rows.append([k.replace("_", " ").title(), str(val)])
        ef_table = Table(ef_rows, colWidths=[50 * mm, 120 * mm])
        ef_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e3a5f")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#ddd")),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ]))
        story.append(ef_table)
    else:
        story.append(Paragraph("No structured fields extracted.", body))
    story.append(Spacer(1, 10 * mm))

    # ==================== RAW OCR TEXT ====================
    story.append(Paragraph("4. Raw OCR Text (Appendix)", heading1))
    story.append(Paragraph(
        "Below is the unprocessed OCR output for transparency and manual verification.",
        small,
    ))
    if scan.raw_ocr_text:
        story.append(Paragraph(f'<font face="Courier" size="8">{_wrap(scan.raw_ocr_text, 110)}</font>', mono))
    else:
        story.append(Paragraph("No OCR text available.", small))

    # ==================== BUILD ====================
    doc.build(story)

    # SHA256
    with out_path.open("rb") as f:
        sha256 = hashlib.sha256(f.read()).hexdigest()
    return str(out_path), sha256