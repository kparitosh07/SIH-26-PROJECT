"""Field parsing and compliance rule engine.

Each rule detects a mandatory packaging-labelling field using regex, marks a
violation if the field is missing or malformed, and records machine-readable
evidence. Rules are configurable via REGEX_RULES.

Compliance scoring weights and severity thresholds are defined here so they can
be tuned without touching pipeline code.
"""
from __future__ import annotations

import math
import re
from dataclasses import dataclass, field
from typing import Any

from app.models.entities import ScanSeverity


# ---------------------------------------------------------------------------
# Context-aware checks (need the full label text, not just the field value)
# Rule 6(1)(e) + "retail sale price" definition: MRP must state that it is
# inclusive of all taxes.
# Rule 12(6): quantity declaration must not use misleading qualifiers such as
# "minimum", "not less than", "average", "about" or "approximately".
# Rule 5 + Second Schedule: commodities must be packed in standard quantities.
# ---------------------------------------------------------------------------
_INCLUSIVE_TAXES = re.compile(r"(?i)\bincl(?:usive)?\.?\s*(?:of\s+)?all\s+taxes")

_PROHIBITED_QTY_QUALIFIER = re.compile(
    r"(?i)\b(?:minimum|not\s+less\s+than|average|about|approximately|approx|at\s+least)\b"
    r"[\s:=.,-]{0,30}(\d[\d.,]*\s*(?:g|kg|ml|l|gm|litre?s?|grams?))"
)


def _parse_quantity(value: str) -> tuple[float, str] | None:
    """Extract (amount, 'g' | 'ml') from a raw net-quantity token, e.g. '500g', '1 L'."""
    m = re.fullmatch(
        r"\s*([\d.,]+)\s*(mg|g|kg|gm|grams?|kgs?|ml|l|litre|liter|litres|liters)?\s*",
        value,
        re.I,
    )
    if not m:
        return None
    try:
        num = float(m.group(1).replace(",", ""))
    except ValueError:
        return None
    unit = (m.group(2) or "").lower()
    if unit in ("g", "gm", "gram", "grams"):
        return num, "g"
    if unit in ("kg", "kgs"):
        return num * 1000.0, "g"
    if unit == "mg":
        return num / 1000.0, "g"
    if unit == "ml":
        return num, "ml"
    if unit in ("l", "litre", "liter", "litres", "liters"):
        return num * 1000.0, "ml"
    return None


# Standard pack sizes per the Second Schedule (Rule 5). Amounts are in grams or
# millilitres. `step` permits "thereafter in multiples of <step>"; `max_val`
# caps the multiple-of series; `no_restriction_below` exempts tiny packs.
STANDARD_PACK_SIZES: dict[str, dict[str, Any]] = {
    "rice|flour|atta|rawa|suji": {
        "label": "Rice/Flour/Atta/Rawa/Suji",
        "allowed": [100, 200, 500, 1000, 2000, 5000],
        "step": 5000,
    },
    "cereals?|pulses?": {
        "label": "Cereals and Pulses",
        "allowed": [100, 200, 500, 1000, 2000, 5000],
        "step": 5000,
    },
    "salt": {
        "label": "Salt",
        "allowed": [50, 100, 200, 500, 750, 1000, 2000, 5000],
        "step": 5000,
        "no_restriction_below": 50,
    },
    "coffee": {
        "label": "Coffee",
        "allowed": [25, 50, 100, 200, 250, 500, 1000],
        "step": 1000,
    },
    "tea": {
        "label": "Tea",
        "allowed": [25, 50, 100, 125, 250, 500, 1000],
        "step": 1000,
    },
    "biscuits?": {
        "label": "Biscuits",
        "allowed": [25, 50, 75, 100, 150, 200, 250, 300],
        "step": 100,
        "max_val": 1000,
    },
    "bread": {
        "label": "Bread",
        "allowed": [100],
        "step": 100,
    },
    "butter|margarine": {
        "label": "Butter and Margarine",
        "allowed": [25, 50, 100, 200, 500, 1000, 2000, 5000],
        "step": 5000,
    },
    "milk\\s*powder": {
        "label": "Milk Powder",
        "allowed": [50, 100, 200, 500, 1000],
        "step": 500,
        "no_restriction_below": 50,
    },
    "detergents?": {
        "label": "Non-soapy Detergents (Powder)",
        "allowed": [50, 100, 200, 500, 700, 1000, 1500, 2000],
        "step": 1000,
        "no_restriction_below": 50,
    },
    "laundry\\s*soap": {
        "label": "Laundry Soap",
        "allowed": [50, 75, 100],
        "step": 50,
    },
    "toilet\\s*soap|bath\\s*soap|soaps?": {
        "label": "Toilet / Bath Soap",
        "allowed": [25, 50, 75, 100, 125, 150],
        "step": 50,
    },
    "edible\\s*oils?|vanaspati|ghee|cooking\\s*oil|mustard\\s*oil": {
        "label": "Edible Oil / Vanaspati / Ghee",
        "allowed": [50, 100, 200, 500, 1000, 2000, 3000, 5000],
        "step": 5000,
    },
    "soft\\s*drinks?|aerated\\s*water": {
        "label": "Aerated Soft Drinks",
        "allowed": [100, 150, 200, 250, 300, 500, 750, 1000, 1500, 2000, 3000, 4000, 5000],
    },
    "mineral\\s*water|drinking\\s*water": {
        "label": "Mineral / Drinking Water",
        "allowed": [100, 150, 200, 250, 300, 500, 750, 1000, 1500, 2000, 3000, 4000, 5000],
    },
    "cement": {
        "label": "Cement",
        "allowed": [1000, 2000, 5000, 10000, 20000, 25000, 50000],
        "units": ("g",),
    },
    "paint|varnish|enamels?": {
        "label": "Paint / Varnish / Enamels",
        "allowed": [50, 100, 200, 500, 1000, 2000, 3000, 4000, 5000],
        "step": 5000,
    },
}


def _standard_pack_size(value: str, text: str) -> bool:
    parsed = _parse_quantity(value)
    if not parsed:
        return True  # unparseable token -> do not double-penalise
    qty, unit = parsed
    for commodity, cfg in STANDARD_PACK_SIZES.items():
        if not re.search(commodity, text, re.I):
            continue
        if unit not in cfg.get("units", ("g", "ml")):
            return True
        if cfg.get("no_restriction_below") and qty < cfg["no_restriction_below"]:
            return True
        allowed = cfg["allowed"]
        if qty in allowed:
            return True
        step = cfg.get("step")
        if step and qty > allowed[-1]:
            if cfg.get("max_val") and qty > cfg["max_val"]:
                return False
            if (qty - allowed[-1]) % step == 0:
                return True
        return False
    return True  # commodity not identifiable -> standard-size check is not applicable


def _standard_pack_size_message(value: str, text: str) -> str:
    parsed = _parse_quantity(value)
    if parsed:
        for commodity, cfg in STANDARD_PACK_SIZES.items():
            if re.search(commodity, text, re.I):
                return (
                    f"'{cfg['label']}' is packed in a non-standard size '{value.strip()}'. "
                    f"Rule 5 / Second Schedule permits: "
                    f"{', '.join(str(s) for s in cfg['allowed'])}"
                    + (f" and thereafter in multiples of {cfg['step']}." if cfg.get("step") else ".")
                )
    return (
        "Net quantity appears not to be a standard pack size "
        "(Rule 5 and the Second Schedule, LMPC Rules 2011)."
    )


def _requires_inclusive_taxes(value: str, text: str) -> bool:
    return _INCLUSIVE_TAXES.search(text) is not None


def _no_misleading_quantity_words(value: str, text: str) -> bool:
    return _PROHIBITED_QTY_QUALIFIER.search(text) is None


# Rule 13(2): quantities below one kg / one litre must use gram / millilitre.
# Rule 13(3): quantities of one kg / one litre or more must use kilogram / litre
# (with a proviso that the larger unit may still be expressed in sub-multiples).
_SUB_UNIT_VIOLATION = re.compile(
    r"^\s*([\d.,]+)\s*(kg|kgs?|litre|liter|litres|liters|l)\s*$", re.I
)


def check_si_quantity_units(value: str, text: str) -> bool:
    m = _SUB_UNIT_VIOLATION.match(value)
    if not m:
        return True
    try:
        amount = float(m.group(1).replace(",", ""))
    except ValueError:
        return True
    unit = m.group(2).lower()
    if unit.startswith("kg") and amount < 1.0:
        return False
    if unit.startswith(("l", "litre", "liter")) and amount < 1.0:
        return False
    return True


def si_quantity_units_message(value: str, text: str) -> str:
    m = _SUB_UNIT_VIOLATION.match(value)
    unit = m.group(2).lower() if m else ""
    if unit.startswith("kg"):
        return (
            f"Net quantity is below one kilogram but declared in kilograms "
            f"('{value.strip()}'); Rule 13(2)(a) requires the gram for quantities "
            f"less than 1 kg (LMPC Rules 2011)."
        )
    return (
        f"Net quantity is below one litre but declared in litres "
        f"('{value.strip()}'); Rule 13(2)(f) requires the millilitre for "
        f"quantities less than 1 litre (LMPC Rules 2011)."
    )


# Rule 11(4) + Third Schedule: the quantity of soaps, lotions and creams may be
# qualified by "when packed"; all other commodities must not use the qualifier.
def check_when_packed_qualified(value: str, text: str) -> bool:
    if not re.search(r"(?i)\bwhen\s+packed\b", text):
        return True
    if re.search(r"(?i)\b(soaps?|lotions?|creams?)\b", text):
        return True
    return False


WHEN_PACKED_VIOLATION = (
    "Quantity declaration is qualified by 'when packed'; this is only permitted "
    "for soaps, lotions and creams listed in the Third Schedule "
    "(Rule 11(4), LMPC Rules 2011)."
)


# ---------------------------------------------------------------------------
# Maximum permissible errors — First Schedule, Table I (Rule 2(e), 22)
# Table I (weight / volume):
#   <=50 g|ml      9%        |  <=100       4.5 g|ml
#   <=200          4.5%      |  <=300       9 g|ml
#   <=500          3%        |  <=1000      15 g|ml
#   <=10000        1.5%      |  <=15000     150 g|ml
#   >15000         1%
# Rule 2(e) note: percentage errors are rounded to the nearest 0.1 g/ml for
# declared <=1000 g/ml and to the next whole g/ml above 1000 g/ml.
# ---------------------------------------------------------------------------
def max_permissible_error(declared_qty_g_ml: float) -> float:
    """Maximum permissible error in g or ml for a declared weight/volume."""
    if declared_qty_g_ml <= 50:
        return _percent_error(declared_qty_g_ml, 9.0)
    if declared_qty_g_ml <= 100:
        return 4.5
    if declared_qty_g_ml <= 200:
        return _percent_error(declared_qty_g_ml, 4.5)
    if declared_qty_g_ml <= 300:
        return 9.0
    if declared_qty_g_ml <= 500:
        return _percent_error(declared_qty_g_ml, 3.0)
    if declared_qty_g_ml <= 1000:
        return 15.0
    if declared_qty_g_ml <= 10000:
        return _percent_error(declared_qty_g_ml, 1.5)
    if declared_qty_g_ml <= 15000:
        return 150.0
    return _percent_error(declared_qty_g_ml, 1.0)


def _percent_error(declared: float, percent: float) -> float:
    error = declared * percent / 100.0
    if declared <= 1000:
        return round(error, 1)
    return math.ceil(error)


TABLE_II_MPE = [
    {
        "basis": "Length",
        "max_permissible_error": "2% of declared quantity up to 10 m; 1% thereafter",
    },
    {
        "basis": "Area",
        "max_permissible_error": "4% of declared quantity up to 10 m2; 1% thereafter",
    },
    {
        "basis": "Number",
        "max_permissible_error": "2% of declared quantity",
    },
]


def compute_mpe_report(net_quantity_value: str | None) -> list[dict[str, Any]] | None:
    """Build a human/machine readable MPE reference for an extracted net quantity.

    Returns Table-I figures when the quantity is declared by weight/volume and
    Table-II reference rows otherwise (length/area/number packaged goods).
    """
    if not net_quantity_value:
        return None
    parsed = _parse_quantity(net_quantity_value)
    if parsed is None:
        return list(TABLE_II_MPE)
    amount, unit = parsed
    mpe = max_permissible_error(amount)
    return [
        {
            "basis": "Weight/Volume",
            "declared_quantity": f"{amount:g} {unit}",
            "max_permissible_error": mpe,
            "unit": unit,
            "note": "Error in excess or in deficiency (First Schedule, Table I).",
        }
    ]


# ---------------------------------------------------------------------------
# Regex catalog
# ---------------------------------------------------------------------------
# Each rule: key -> {label, type, severity_if_missing, patterns}
# The `type` drives lightweight semantic validation once text is extracted.
# Optional `context_checks`: list of (check(value, text) -> bool, message)
# where `message` may be a str or a callable (value, text) -> str. A check
# runs against the full label when the basic validator passes; a failure
# downgrades the field to a MINOR violation citing the relevant rule.
REGEX_RULES: dict[str, dict[str, Any]] = {
    "mrp": {
        "label": "MRP (Maximum Retail Price)",
        "field_type": "money",
        "severity_if_missing": ScanSeverity.CRITICAL,
        "context_checks": [
            (
                _requires_inclusive_taxes,
                "MRP detected but does not state it is 'inclusive of all taxes' "
                "(Rule 6(1)(e) and the 'retail sale price' definition, LMPC Rules 2011).",
            ),
        ],
        "patterns": [
            r"MRP\s*(?:\(.*?\))?\s*[:.]?\s*(?:Rs\.?|INR|₹)?\s*(\d{1,5}(?:[.,]\d{1,2})?)",
            r"(?:\bRs\.?|\bINR|₹)\s*(\d{1,5}(?:[.,]\d{1,2})?)",
            r"MAX(?:IMUM)?\s+RET(?:AIL)?\s+PRICE\s*(?:Rs\.?|INR|₹)?\s*(\d{1,5}(?:[.,]\d{1,2})?)",
            r"\b(\d{1,4}\.\d{2})\b",
        ],
    },
    "net_quantity": {
        "label": "Net Quantity / Net Weight",
        "field_type": "quantity",
        "severity_if_missing": ScanSeverity.CRITICAL,
        "context_checks": [
            (
                _no_misleading_quantity_words,
                "Net quantity declaration uses a prohibited qualifier such as "
                "'minimum', 'not less than', 'average', 'about' or 'approximately' "
                "(Rule 12(6), LMPC Rules 2011).",
            ),
            (_standard_pack_size, _standard_pack_size_message),
            (check_si_quantity_units, si_quantity_units_message),
            (check_when_packed_qualified, WHEN_PACKED_VIOLATION),
        ],
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
            r"([A-Z][A-Za-z0-9&'.,\- ]{2,}?)\s*(?:PRIVATE\s*LIMITED|PVT\.?\s*LTD|P\s*LTD|LIMITED|LLP|INC\.?)",
        ],
    },
    "dates": {
        "label": "Best Before / Expiry Date",
        "field_type": "date",
        "required_for": "food",
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
        "required_for": "food",
        "severity_if_missing": ScanSeverity.MINOR,
        "patterns": [
            r"\bLIC(?:ENSE)?\.?\s+NO\.?\s*[=:]?\s*(\d{14})",
            r"\bFSSAI\s*(?:LICENSE\s+NO\.?)?\s*[=:]?\s*(\d{14})",
            r"\b(\d{14})\b",
        ],
    },
    "batch_number": {
        "label": "Batch / Lot Number",
        "field_type": "batch",
        "severity_if_missing": ScanSeverity.MINOR,
        "patterns": [
            r"\b(?:BATCH|LOT|B\.NO|L\.NO)\s*(?:NO\.?|NUMBER)?\s*[=:.]?\s*([A-Z0-9][A-Z0-9/-]{2,})",
            r"\b(?=[A-Z0-9]*\d)[A-Z0-9]{6,12}\b",
        ],
    },
    "commodity_name": {
        "label": "Common / Generic Commodity Name",
        "field_type": "text_keyword",
        "severity_if_missing": ScanSeverity.MAJOR,
        "patterns": [
            r"\b(baby\s*food|weaning\s*food|biscuits?|bread|buns?|butter|margarine|cereals?|pulses?|coffee|tea|edible\s*oils?|vanaspati|ghee|milk\s*powder|rice|flour|atta|rawa|suji|salt|det?ergent|laundry|fabric\s*(?:softener|conditioner)|shampoo|conditioner|hand\s*wash|handwash|dish\s*wash|dishwash|body\s*wash|bodywash|face\s*wash|facewash|soaps?|liquid\s*soap|cleansers?|moisturis?ers?|sunscreen|sun\s*screen|deodorants?|lotions?|creams?|gels?|ointment|toothpaste|tooth\s*paste|soft\s*drinks?|aerated\s*water|mineral\s*water|drinking\s*water|cooking\s*oil|mustard\s*oil|sauces?|pickles?|jam|tomato\s*ketchup|honey|curd|sugar|noodles|pasta|chocolates?|ice\s*cream|syrup|juice|disinfectants?|bleach|sanitizers?|sprays?|paint|enamel|primer|varnish|cement|lubricants?|grease|motor\s*oil|inks?|adhesives?|glue|insecticides?|pesticides?|repellents?|batteries?|tyres?|tires?|sanitary\s*napkins?)\b",
        ],
    },
    "mfg_date": {
        "label": "Manufactured / Pre-packed Month & Year",
        "field_type": "month_year",
        "severity_if_missing": ScanSeverity.MAJOR,
        "patterns": [
            r"(?:MFG|M(?:ANUFACTUR)?|PROD|PKD|PACKED|PRE-?PACKED|PACKING|MANUFACTURING|IMPORTED)\s*(?:DATE|DT|ON)?\s*[:.]?\s*(\d{1,2}[/-]\d{4}|\d{2}[/-]\d{2}[/-]\d{2,4})",
            r"(?:MFG|M(?:ANUFACTUR)?|PKD|PACKED)\s*(?:DATE|ON)?\s*[:.]?\s*([A-Z]{3,}[\s-]?\d{4}|\d{1,2}\s?[A-Z]{3,}\s?\d{4})",
            r"(?:month|year)\s+of\s+(?:manufacture|pre-?packing|packing|import)\s*[:.]?\s*(\d{1,2}[/-]\d{4}|[A-Z]{3,}[\s-]?\d{4})",
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
# Food vs non-food classification.
# Best-before and FSSAI declarations apply only to food articles (they flow
# in via the FSS Act / FSSAI rules under proviso to Rule 6, LMPC Rules 2011).
# ---------------------------------------------------------------------------
_FOOD_WORDS = re.compile(
    r"(?i)\b(?:rice|wheat|flour|atta|maida|besan|rawa|suji|pulses?|dals?|grains?|sugar|salts?|tea|coffee|cereal|biscuit|cookies?|chocolates?|candy|toffees?|bread|buns?|pasta|noodles?|spices?|masalas?|oil|ghee|butter|cheese|milk|curd|yogurt|paneer|ice\s*cream|honey|jams?|sauces?|ketchup|pickles?|juice|drinks?|beverages?|water|soups?|syrup|vinegar|eggs?|meat|chicken|fish|fruits?|vegetables?|mangoes?|apples?|coconuts?|groundnuts?|peanuts?|corn|popcorn|wafers?|chips?|crisps?|papad|vermicelli|snacks?|namkeen|foods?|edible)\b"
)

_NON_FOOD_WORDS = re.compile(
    r"(?i)\b(?:detergents?|laundry|soaps?|shampoo|conditioner|cleansers?|creams?|lotions?|ointment|balm|gels?|moisturis?ers?|sunscreen|sanitizers?|disinfectants?|bleach|hand\s*wash|dish\s*wash|body\s*wash|face\s*wash|toothpaste|deodorants?|cosmetics?|paints?|enamel|primer|varnish|cement|lubricants?|grease|insecticides?|pesticides?|repellents?|adhesives?|glue|ink|batteries?|tyres?|tires?|synthetic|fabric\s*(?:softener|conditioner)|sprays?)\b"
)


def _commodity_kind(text: str) -> str:
    """'food' | 'non_food' | 'unknown'. Best-effort keyword classification."""
    if _FOOD_WORDS.search(text):
        return "food"
    if _NON_FOOD_WORDS.search(text):
        return "non_food"
    return "unknown"


_NOT_APPLICABLE_MESSAGE = (
    "'{label}' not applicable - this package is not a food article; "
    "best-before / FSSAI declarations are required only on food packages."
)


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


def _validate_month_year(value: str) -> bool:
    """Month & year of manufacture/pre-packing, e.g. 05/2026, 05-2026, MAY 2026."""
    norm = "".join(value.upper().split())
    return bool(
        re.fullmatch(
            r"(?:\d{1,2}[/-]\d{4}"                     # 05/2026, 5-2026
            r"|\d{2}[/-]\d{2}[/-]\d{2,4}"             # 25/12/2026
            r"|[A-Z]{3,}[\s-]?\d{4}"                  # MAY2026, MAY-2026
            r"|\d{1,2}[A-Z]{3,}\d{4})",               # 05MAY2026
            norm,
        )
    )


def _validate_batch_number(value: str) -> bool:
    """Reject OCR-noise terms picked up by the bare alnum batch pattern.

    A plausible batch/lot token must contain at least one digit and must not be a
    lowercase-only word (e.g. 'eysrinshorgh' mis-read from first-aid text).
    """
    v = value.strip()
    if not any(ch.isdigit() for ch in v):
        return False
    letters = [ch for ch in v if ch.isalpha()]
    if len(v) >= 6 and letters and all(ch.islower() for ch in letters):
        return False
    return True


FIELD_VALIDATORS = {
    "money": _validate_money,
    "quantity": _validate_quantity,
    "date": _validate_date,
    "contact": _validate_contact,
    "fssai": _validate_fssai,
    "month_year": _validate_month_year,
    "batch": _validate_batch_number,
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
            if rule.get("required_for") == "food" and _commodity_kind(text) == "non_food":
                results.append(
                    RuleResult(
                        key=key,
                        label=label,
                        status=ScanSeverity.PASS,
                        message=_NOT_APPLICABLE_MESSAGE.format(label=label),
                    )
                )
                continue
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
        context_message = None
        if ok:
            for check, message in rule.get("context_checks", []):
                if not check(extraction.value, text):
                    ok = False
                    context_message = message(extraction.value, text) if callable(message) else message
                    break
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
                    message=context_message or f"'{label}' looks malformed: '{extraction.value}'",
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