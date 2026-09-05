"""OCR pipeline: image preprocessing -> text recognition -> post-processing.

Two engines are supported:
- PaddleOCR (default, best accuracy on packaging labels, free)
- Tesseract (lightweight fallback)

The pipeline is designed to degrade gracefully:
if a heavyweight engine is unavailable, the lightweight one is used.
"""
from __future__ import annotations

import re
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Protocol

import numpy as np
from PIL import Image


# ---------------------------------------------------------------------------
# Types
# ---------------------------------------------------------------------------
@dataclass
class OCRWord:
    text: str
    confidence: float
    box: list[list[float]] | None = None
    line_index: int | None = None


@dataclass
class OCRResult:
    raw_text: str
    words: list[OCRWord] = field(default_factory=list)
    engine: str = ""
    confidence: float = 0.0
    latency_ms: int = 0
    page_count: int = 1


class OCRBackend(Protocol):
    name: str

    def recognize(self, image: Image.Image) -> tuple[list[OCRWord], float]: ...


# ---------------------------------------------------------------------------
# Engine specific backends
# ---------------------------------------------------------------------------
class PaddleOCREngine(OCRBackend):
    name = "paddleocr"

    def __init__(self, lang: str = "en") -> None:
        from paddleocr import PaddleOCR  # lazy import (heavy)

        self._ocr = PaddleOCR(
            use_angle_cls=True,
            lang="en",
            show_log=False,
            use_gpu=False,
            use_mp=False,
        )

    def recognize(self, image: Image.Image) -> tuple[list[OCRWord], float]:
        import cv2

        img = cv2.cvtColor(np.array(image.convert("RGB")), cv2.COLOR_RGB2BGR)
        result = self._ocr.ocr(img, cls=True)
        words: list[OCRWord] = []
        confs: list[float] = []
        for page_lines in result or []:
            for line in page_lines or []:
                # PaddleOCR 2.9 returns: [ [box], (text, confidence) ]
                box, (text, confidence) = line[0], line[1]
                if text and confidence:
                    words.append(
                        OCRWord(text=str(text).strip(), confidence=float(confidence), box=box)
                    )
                    confs.append(float(confidence))
        avg_conf = float(np.mean(confs)) if confs else 0.0
        return words, avg_conf


class TesseractEngine(OCRBackend):
    name = "tesseract"

    def __init__(self, lang: str = "eng") -> None:
        import pytesseract  # lazy import

        self._tesseract = pytesseract
        self._lang = lang

    def recognize(self, image: Image.Image) -> tuple[list[OCRWord], float]:
        data = self._tesseract.image_to_data(image, lang=self._lang, output_type=self._tesseract.Output.DICT)
        words: list[OCRWord] = []
        confs: list[float] = []
        for i, text in enumerate(data["text"]):
            text = text.strip()
            conf = float(data["conf"][i]) / 100.0
            if not text or conf < 0.05:
                continue
            x, y, w, h = data["left"][i], data["top"][i], data["width"][i], data["height"][i]
            words.append(
                OCRWord(
                    text=text,
                    confidence=max(conf, 0.0),
                    box=[[x, y], [x + w, y], [x + w, y + h], [x, y + h]],
                )
            )
            confs.append(max(conf, 0.0))
        avg_conf = float(np.mean(confs)) if confs else 0.0
        return words, avg_conf


def _pick_backend() -> OCRBackend:
    from app.core.config import settings

    chosen = settings.OCR_ENGINE
    if chosen == "tesseract":
        return TesseractEngine(settings.OCR_LANG)
    try:
        return PaddleOCREngine(settings.OCR_LANG)
    except Exception:
        try:
            return TesseractEngine("eng")
        except Exception:
            raise RuntimeError("No OCR engine available. Install paddleocr or tesseract.")


# ---------------------------------------------------------------------------
# Image preprocessing (OpenCV / Pillow)
# ---------------------------------------------------------------------------
def preprocess_image(image: Image.Image, target_dpi: int = 300) -> Image.Image:
    import cv2

    # 1. Normalize orientation via EXIF
    image = ImageOpsExif.apply(image)

    # 2. Resize so the longest edge is ~2400px (enough detail for OCR, bounded cost)
    image = _resize_longest_edge(image, 2400)

    img = np.array(image.convert("RGB"))
    bgr = cv2.cvtColor(img, cv2.COLOR_RGB2BGR)
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)

    # 3. Bilateral denoise -- preserves edges while removing sensor noise
    gray = cv2.bilateralFilter(gray, d=9, sigmaColor=75, sigmaSpace=75)

    # 4. Contrast normalization (CLAHE on L channel via LAB)
    lab = cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    gray_clahe = clahe.apply(gray)

    # 5. Sharpen
    kernel = np.array([[0, -1, 0], [-1, 5, -1], [0, -1, 0]], dtype=np.float32)
    sharpened = cv2.filter2D(gray_clahe, -1, kernel)

    # 6. Optional binarization: keep adaptive threshold only for heavily noisy pages
    #    (turned off by default; engines already handle contrast internally)
    return Image.fromarray(sharpened)


def _resize_longest_edge(image: Image.Image, target: int) -> Image.Image:
    w, h = image.size
    longest = max(w, h)
    if longest <= target:
        return image
    scale = target / longest
    return image.resize((int(w * scale), int(h * scale)), Image.LANCZOS)


class ImageOpsExif:
    @staticmethod
    def apply(image: Image.Image) -> Image.Image:
        try:
            return ImageOpsExif._via_pil(image)
        except Exception:
            return image

    @staticmethod
    def _via_pil(image: Image.Image) -> Image.Image:
        try:
            from PIL import ImageOps

            return ImageOps.exif_transpose(image)
        except Exception:
            return image


# ---------------------------------------------------------------------------
# Post-processing: merge fragmented lines, normalise spacing
# ---------------------------------------------------------------------------
LINE_BREAKERS = re.compile(r"(?<![A-Za-z])([.])?\s*(-|–){1,2}\s*(?=[a-z])")  # hyphen joins
WHITESPACE = re.compile(r"\s{2,}")

# Keys that usually contain values broken across lines
MERGE_KEYS = {"mrp", "net_quantity", "customer_care", "email", "website"}


def assemble_lines(words: list[OCRWord], merge_distance: int = 28) -> list[str]:
    """Group OCR words into reading-order lines using geometric gaps.

    Words are sorted by vertical position (then left-to-right) and split into
    new lines whenever the vertical gap between successive words exceeds
    ``merge_distance`` px (approx. a word height).
    """
    words = [w for w in words if w.text.strip()]
    if not words:
        return []

    words = sorted(words, key=lambda w: (w.box[0][1] if w.box else 0, w.box[0][0] if w.box else 0))

    lines: list[list[OCRWord]] = []
    current: list[OCRWord] = []
    prev_y: float | None = None

    for word in words:
        y = (word.box[0][1] + word.box[2][1]) / 2 if word.box else (prev_y or 0.0)
        if prev_y is not None and y - prev_y > merge_distance and current:
            lines.append(current)
            current = []
        current.append(word)
        prev_y = y
    if current:
        lines.append(current)

    rendered = []
    for cluster in lines:
        cluster = sorted(cluster, key=lambda w: w.box[0][0] if w.box else 0)
        rendered.append(" ".join(w.text for w in cluster))
    return rendered


def merge_fragments(token: str) -> str:
    """Join hyphen-split pieces produced by OCR, e.g. 'MR', 'P 12' -> help cleanup."""
    return token


def postprocess_lines(lines: list[str]) -> str:
    """Clean OCR noise: collapse spaces, fix hyphen-line-breaks, drop junk."""
    cleaned: list[str] = []
    for line in lines:
        line = WHITESPACE.sub(" ", line).strip()
        if not line:
            continue
        line = LINE_BREAKERS.sub("-", line)
        cleaned.append(line)
    return "\n".join(cleaned)


# ---------------------------------------------------------------------------
# PDF handling
# ---------------------------------------------------------------------------
def pdf_to_images(pdf_path: Path, dpi: int = 300) -> list[Image.Image]:
    """Rasterize every page of a PDF to PIL images (pdf2image needs poppler)."""
    from pdf2image import convert_from_path

    images = convert_from_path(str(pdf_path), dpi=dpi)
    return list(images)


# ---------------------------------------------------------------------------
# Main pipeline
# ---------------------------------------------------------------------------
def run_ocr(file_path: Path, engine: str | None = None) -> OCRResult:
    """Execute the complete OCR pipeline on an uploaded file.

    Returns raw text, word metadata, average confidence and timing.
    """
    start = time.perf_counter()
    backend = _pick_backend() if engine is None else (
        TesseractEngine("eng") if engine == "tesseract" else PaddleOCREngine()
    )

    page_images: list[Image.Image]
    if str(file_path).lower().endswith(".pdf"):
        page_images = pdf_to_images(file_path, dpi=300)
    else:
        with Image.open(file_path) as im:
            page_images = [im.copy()]

    all_words: list[OCRWord] = []
    confs: list[float] = []
    for idx, page in enumerate(page_images):
        processed = preprocess_image(page)
        words, page_conf = backend.recognize(processed)
        for w in words:
            w.line_index = idx
        all_words.extend(words)
        confs.append(page_conf)

    lines = assemble_lines(all_words)
    raw_text = postprocess_lines(lines)

    latency_ms = int((time.perf_counter() - start) * 1000)
    avg_conf = float(np.mean([c for c in confs if c > 0])) if confs else 0.0

    return OCRResult(
        raw_text=raw_text,
        words=all_words,
        engine=backend.name,
        confidence=avg_conf,
        latency_ms=latency_ms,
        page_count=len(page_images),
    )