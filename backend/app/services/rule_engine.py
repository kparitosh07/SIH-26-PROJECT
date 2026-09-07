"""Field parsing and compliance rule engine.

Each rule detects a mandatory packaging-labelling field using regex, marks a
violation if the field is missing or malformed, and records machine-readable
evidence. Rules are configurable via REGEX_RULES.

Compliance scoring weights and severity thresholds are defined here so they can
be tuned without touching pipeline code.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

from app.models.entities import ScanSeverity


# ---------------------------------------------------------------------------
# Regex catalog
# ---------------------------------------------------------------------------
# Each rule: key -> {label, type, severity_if_missing, patterns}
# The `type` drives lightweight semantic validation once text is extracted.
REGEX_RULES: dict[str, dict[str, Any]] = {
    "mrp": {
        "label": "MRP (Maximum Retail Price)",
        "field_type": "money",
        "severity_if_missing": ScanSeverity.CRITICAL,
        "patterns": [
            r"MRP\s*(?:\(.*?\))?\s*[:.]?\s*(?:Rs\.?|INR|₹)?\s*(\d{1,5}(?:[.,]\d{1,2})?)",
            r"(?:Rs\.?|INR|₹)\s*(\d{1,5}(?:[.,]\d{1,2})?)",
            r"MAX(?:IMUM)?\s+RET(?:AIL)?\s+PRICE\s*(?:Rs\.?|INR|₹)?\s*(\d{1,5}(?:[.,]\d{1,2})?)",
            r"\b(\d{1,4}\.\d{2})\b",
        ],
    },
    "net_quantity": {
        "label": "Net Quantity / Net Weight",
        "field_type": "quantity",
        "severity_if_missing": ScanSeverity.CRITICAL,
        "patterns": [
            r"NET\s+(?:WT\.?|WEIGHT|QTY\.?|QUANTITY|CONTENT|VOL(?:UME)?)\s*[=:]?\s*([\d.,]+\s*(?:g|kg|ml|l|L|mg|gm|kgs?\.?|litre?s?|grams?|pcs)?)",
            r"NET WT[.\s]*[:=]?\s*([\d.,]+\s*(?:g|kg|ml|l|L|mg)?)",
            r"NET\s+QUANTITY\s*[=:]?\s*([\d.,]+\s*(?:g|kg|ml|l|L)?)",
            r"\b([\d.,]+\s*(?:ml|l|L|g|kg|gm))\b",
        ],
    },
    "manufacturer": {
        "label": "Manufacturer Details",
        "field_type": "text_keyword",
        "severity_if_missing": ScanSeverity.MAJOR,
        "patterns": [
            r"(?:M(?:ANUFACTURED|FG)\s+(?:BY|IN)|MFG\s*BY|M(?:ANUFACTURER)|\bMFG\.?)\s*[=:]?\s*([A-Za-z0-9][A-Za-z0-9 &.'-]{2,})",
            r"(?:PROCTER\s*&\s*GAMBLE|P&G|UNILEVER|NESTLE|DABUR|BRITANNIA|MARICO|ITC|HINDUSTAN)\s*([A-Za-z0-9 &.'-]{0,30})",
            r"(?:A\s+(?:GROUP\s+)?COMPANY\s+OF|PRODUCED BY|MARKETED BY|MKT BY)\s*[=:]?\s*([A-Za-z0-9][A-Za-z0-9 &.'-]{2,})",
        ],
    },
    "dates": {
        "label": "Best Before / Expiry Date",
        "field_type": "date",
        "severity_if_missing": ScanSeverity.MAJOR,
        "patterns": [
            r"(?:BEST\s+BEFORE|USE\s+BEFORE|USE\s+WITHIN|CONSUME\s+WITHIN|SHELF\s+LIFE)\s*[:.]?\s*(\d{1,3}\s*(?:DAYS?|MONTHS?|YEARS?|WEEKS?)(?:\s+FROM\s+[A-Za-z\s]{2,25})?)",
            r"(?:BEST\s+BEFORE(?:\s+\d+\s+(?:MONTHS|DAYS))?|EXPIRY|EXP(?:IRES)?.?\s+DATE)\s*[:.]?\s*([A-Z]{0,3}\s?\d{1,2}/?\d{1,2}/?\d{2,4}|\d{1,2}\s[A-Z]{3}\s?\d{2,4})",
            r"(?:USE\s+BY|SELL\s+BY|USE\s+BEFORE)\s*[:.]?\s*([A-Z]{0,3}\s?\d{1,2}/?\d{1,2}/?\d{2,4})",
            r"(?:M\.?F\.?G|PKD|PACKED)\s*[.:]?\s*([A-Z]{0,3}\s?\d{1,2}/?\d{1,2}/?\d{2,4}|\d{2}/\d{2,4})",
            r"\b(\d{2}/\d{2,4})\b",
        ],
    },
    "customer_care": {
        "label": "Customer Care Contact",
        "field_type": "contact",
        "severity_if_missing": ScanSeverity.MAJOR,
        "patterns": [
            r"(?:CUSTOMER\s+CARE|TOLL\s+FREE|TOLLFREE|CONSUMER)\s*(?:NO\.?|NUMBER|CELL)?\s*[.=:]?\s*(\+?\d[\d\s.-]{7,}\d)",
            r"\b(?:1[89]00|1800|1860)\d{7}\b",
            r"\b(\d{10})\b",
        ],
    },
    "address": {
        "label": "Packaged / Registered Office Address",
        "field_type": "text_keyword",
        "severity_if_missing": ScanSeverity.MINOR,
        "patterns": [
            r"(?:PACKED\s+AT|PACKAGED\s+(?:AT|BY)|REGISTERED\s+OFFICE|CORPORATE\s+OFFICE|ADDRESS)\s*[=:]?\s*([A-Za-z0-9][A-Za-z0-9,./&'() -]{10,})",
        ],
    },
    "fssai": {
        "label": "FSSAI License Number",
        "field_type": "fssai",
        "severity_if_missing": ScanSeverity.MINOR,
        "patterns": [
            r"\bLIC(?:ENSE)?\.?\s+NO\.?\s*[=:]?\s*(\d{14})",
            r"\bFSSAI\s*(?:LICENSE\s+NO\.?)?\s*[=:]?\s*(\d{14})",
            r"\b(\d{14})\b",
        ],
    },
    "batch_number": {
        "label": "Batch / Lot Number",
        "field_type": "text_keyword",
        "severity_if_missing": ScanSeverity.MINOR,
        "patterns": [
            r"\b(?:BATCH|LOT|B\.NO|L\.NO)\s*(?:NO\.?|NUMBER)?\s*[=:.]?\s*([A-Z0-9][A-Z0-9/-]{2,})",
            r"\b([A-Z0-9]{6,12})\b",
        ],
    },
}

SEVERITY_WEIGHT: dict[ScanSeverity, float] = {
    ScanSeverity.CRITICAL: 1.0,
    ScanSeverity.MAJOR: 0.7,
    ScanSeverity.MINOR: 0.4,
    ScanSeverity.PASS: 0.0,
}


# ---------------------------------------------------------------------------
# Semantic validators per field type
# ---------------------------------------------------------------------------
def _validate_money(value: str) -> bool:
    m = re.fullmatch(r"\d{1,4}(?:[.,]\d{1,2})?", re.sub(r"[^\d.,]", "", value))
    if not m:
        return False
    try:
        amount = float(m.group(0).replace(",", ""))
    except ValueError:
        return False
    return amount > 0


def _validate_quantity(value: str) -> bool:
    cleanup = value.lower().replace(" ", "")
    return bool(
        re.fullmatch(r"[\d.,]+\s*(?:g|kg|mg|ml|l|gm|litres?|grams?|kgs?|units|pieces|pcs)?", cleanup)
    )


def _validate_date(value: str) -> bool:
    val_upper = value.upper().strip()
    # Check relative shelf life / duration statements (e.g. "30 DAYS", "6 MONTHS FROM PACKAGING")
    if re.search(r"\d{1,3}\s*(?:DAYS?|MONTHS?|YEARS?|WEEKS?)", val_upper):
        return True

    normal = re.sub(r"\s+", "", val_upper)
    return bool(
        re.fullmatch(
            r"(?:\d{1,2}[/-]\d{2,4}"                            # 12/2027, 07/26
            r"|\d{1,2}[/-]\d{1,2}[/-]\d{2,4}"                  # 25/12/2026
            r"|[A-Z]{3,}[/-]?\d{2,4}"                          # DEC2027, JAN-2027
            r"|\d{1,2}[A-Z]{3}\d{2,4})",                       # 12DEC2027
            normal,
        )
    )


def _validate_contact(value: str) -> bool:
    digits = re.sub(r"\D", "", value)
    return 10 <= len(digits) <= 15


def _validate_fssai(value: str) -> bool:
    return re.fullmatch(r"\d{14}", re.sub(r"\s+", "", value)) is not None


FIELD_VALIDATORS = {
    "money": _validate_money,
    "quantity": _validate_quantity,
    "date": _validate_date,
    "contact": _validate_contact,
    "fssai": _validate_fssai,
    "text_keyword": lambda v: len(v.strip()) >= 3,
}


# ---------------------------------------------------------------------------
# Research dataclasses
# ---------------------------------------------------------------------------
@dataclass
class FieldExtraction:
    key: str
    value: str | None
    evidence: str | None
    matched_pattern: str | None = None
    line_number: int | None = None


@dataclass
class RuleResult:
    key: str
    label: str
    status: ScanSeverity
    message: str
    evidence: str | None = None
    regex_pattern: str | None = None
    extracted_value: str | None = None


@dataclass
class ComplianceReport:
    score: float
    verdict: ScanSeverity
    results: list[RuleResult] = field(default_factory=list)
    extracted_fields: dict[str, Any] = field(default_factory=dict)


# ---------------------------------------------------------------------------
# Engine
# ---------------------------------------------------------------------------
def _run_field_extraction(text: str, rules: dict[str, dict[str, Any]]) -> dict[str, FieldExtraction]:
    extracted: dict[str, FieldExtraction] = {}
    for key, rule in rules.items():
        value = None
        evidence = None
        used_pattern = None
        for pattern in rule["patterns"]:
            compiled = re.compile(r"(?im)" + pattern)
            match = compiled.search(text)
            if match:
                used_pattern = pattern
                value = (match.group(1) or match.group(0)).strip() if match.groups() else match.group(0).strip()
                evidence = match.group(0).strip()
                break
        if value:
            extracted[key] = FieldExtraction(key=key, value=value, evidence=evidence, matched_pattern=used_pattern)
    return extracted


def evaluate_compliance(raw_text: str, rules: dict[str, dict[str, Any]] | None = None) -> ComplianceReport:
    rules = rules or REGEX_RULES
    text = (raw_text or "").strip()

    extracted = _run_field_extraction(text, rules)
    results: list[RuleResult] = []

    for key, rule in rules.items():
        extraction = extracted.get(key)
        label = rule["label"]
        severity_if_missing = rule["severity_if_missing"]
        validator = FIELD_VALIDATORS.get(rule["field_type"])

        if extraction is None:
            results.append(
                RuleResult(
                    key=key,
                    label=label,
                    status=severity_if_missing,
                    message=f"'{label}' not found on label.",
                )
            )
            continue

        ok = validator(extraction.value) if validator else True
        if ok:
            results.append(
                RuleResult(
                    key=key,
                    label=label,
                    status=ScanSeverity.PASS,
                    message=f"'{label}' detected: {extraction.value}",
                    evidence=extraction.evidence,
                    regex_pattern=extraction.matched_pattern,
                    extracted_value=extraction.value,
                )
            )
        else:
            results.append(
                RuleResult(
                    key=key,
                    label=label,
                    status=ScanSeverity.MINOR,
                    message=f"'{label}' looks malformed: '{extraction.value}'",
                    evidence=extraction.evidence,
                    regex_pattern=extraction.matched_pattern,
                    extracted_value=extraction.value,
                )
            )

    failed = [r for r in results if r.status != ScanSeverity.PASS]
    if failed:
        weighted = sum(SEVERITY_WEIGHT[r.status] for r in failed)
        total_weight = sum(
            SEVERITY_WEIGHT[rules[k]["severity_if_missing"]] for k in rules
        )
        score = round(100.0 * (1 - weighted / total_weight), 2) if total_weight else 100.0
    else:
        score = 100.0

    # Verdict from strictest failing severity
    order = [ScanSeverity.CRITICAL, ScanSeverity.MAJOR, ScanSeverity.MINOR]
    verdict = ScanSeverity.PASS
    for sev in order:
        if any(r.status == sev for r in failed):
            verdict = sev
            break

    serializable_fields = {k: v.value for k, v in extracted.items()}
    return ComplianceReport(
        score=round(score, 2),
        verdict=verdict,
        results=results,
        extracted_fields=serializable_fields,
    )