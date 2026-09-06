"""PaddleOCR engine for packaging label text extraction."""

from __future__ import annotations

from pathlib import Path
from threading import Lock
from typing import Any

from app.core.config import settings


class PaddleOCREngine:
    """Lazy-loaded PaddleOCR wrapper."""

    _instance: "PaddleOCREngine | None" = None
    _lock = Lock()

    def __new__(cls) -> "PaddleOCREngine":
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._ocr = None
        return cls._instance

    def _load(self) -> None:
        if self._ocr is not None:
            return

        from paddleocr import PaddleOCR

        self._ocr = PaddleOCR(
            use_angle_cls=True,
            lang=settings.OCR_LANG,
            use_gpu=False,
            show_log=False,
        )

    def process(self, image_path: str | Path) -> dict[str, Any]:
        """Run PaddleOCR on one image."""
        path = Path(image_path)

        if not path.exists():
            raise FileNotFoundError(f"Image not found: {path}")

        self._load()

        result = self._ocr.ocr(
            str(path),
            cls=True,
        )

        lines: list[dict[str, Any]] = []

        for page in result or []:
            if not page:
                continue

            for item in page:
                if not item or len(item) < 2:
                    continue

                box = item[0]
                text, confidence = item[1]

                confidence = float(confidence)

                if confidence < settings.OCR_CONFIDENCE_THRESHOLD:
                    continue

                lines.append(
                    {
                        "text": text.strip(),
                        "confidence": confidence,
                        "box": box,
                    }
                )

        text = "\n".join(item["text"] for item in lines)

        avg_confidence = (
            sum(item["confidence"] for item in lines) / len(lines)
            if lines
            else 0.0
        )

        return {
            "text": text,
            "lines": lines,
            "confidence": avg_confidence,
            "line_count": len(lines),
            "engine": "paddleocr",
        }


paddle_ocr = PaddleOCREngine()