"""Tests for the OCR pipeline pre/post processing (no heavy engine dependency)."""
import numpy as np
import pytest
from PIL import Image

from app.services.ocr_pipeline import assemble_lines, postprocess_lines, preprocess_image, OCRWord


def make_word(text: str, x: int, y: int) -> OCRWord:
    return OCRWord(
        text=text,
        confidence=0.9,
        box=[[x, y], [x + 10, y], [x + 10, y + 10], [x, y + 10]],
    )


class TestLineAssembly:
    def test_groups_by_row(self):
        words = [
            make_word("MRP", 0, 0), make_word("Rs.", 20, 2), make_word("100", 40, 1),
            make_word("NET", 0, 60), make_word("WT", 12, 61), make_word("500g", 30, 60),
        ]
        lines = assemble_lines(words)
        assert len(lines) == 2
        assert lines[0] == "MRP Rs. 100"
        assert lines[1] == "NET WT 500g"

    def test_sorting_works_without_boxes(self):
        words = [OCRWord(text="single", confidence=0.8, box=None)]
        lines = assemble_lines(words)
        assert lines == ["single"]


class TestPostProcess:
    def test_collapses_whitespace(self):
        out = postprocess_lines(["MRP   Rs.   100   "])
        assert out == "MRP Rs. 100"

    def test_removes_empty_lines(self):
        out = postprocess_lines(["hello", "", "   ", "world"])
        assert out == "hello\nworld"


@pytest.mark.skipif(not __import__("importlib").util.find_spec("cv2"), reason="OpenCV not installed")
class TestPreprocess:
    def test_preserves_dimensions_after_resize(self):
        img = Image.new("RGB", (2000, 1000), color="white")
        out = preprocess_image(img)
        # Longest edge cap at 2400 -> 2000x1000 stays
        assert out.size[0] <= 2400
        assert out.size[1] <= 2400

    def test_handles_grayscale(self):
        img = Image.new("L", (500, 300), color=128)
        out = preprocess_image(img)
        assert out.size == (500, 300)