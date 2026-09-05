"""Heuristic product identity match from OCR text.

Scans brand/name tokens of each line against a fuzzy token-overlap score,
nudging the most likely product from an existing product lookup.
"""
from __future__ import annotations

import unicodedata

from fuzzywuzzy import fuzz, process  # type: ignore

from app.models.entities import Product


def _normalise(text: str) -> str:
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    return " ".join(text.lower().split())


def match_product(ocr_text: str, candidates: list[Product]) -> Product | None:
    """Best-effort fuzzy match of OCR text against known products.

    Returns None if nothing clears the similarity threshold.
    """
    if not candidates or not ocr_text:
        return None
    text = _normalise(ocr_text)
    choices = [(p, _normalise(p.name or "") + " " + _normalise(p.brand or "")) for p in candidates]
    best: tuple[Product, int] | None = None
    for p, choice in choices:
        if not choice:
            continue
        score = fuzz.token_set_ratio(text, choice)
        # Whole-line term bonus for strong brand tokens
        for token in choice.split():
            if len(token) > 3 and token in text:
                score += 4
        if best is None or score > best[1]:
            best = (p, score)
    if best and best[1] >= 55:
        return best[0]
    return None