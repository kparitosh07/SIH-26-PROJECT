from pathlib import Path

from paddleocr import PaddleOCR


IMAGE_PATH = Path("test_label.jpg")


def main():
    if not IMAGE_PATH.exists():
        raise FileNotFoundError(
            f"Test image not found: {IMAGE_PATH.resolve()}"
        )

    ocr = PaddleOCR(
        use_angle_cls=True,
        lang="en",
        use_gpu=False,
        show_log=False,
    )

    result = ocr.ocr(str(IMAGE_PATH), cls=True)

    if not result:
        print("No OCR result.")
        return

    for page in result:
        if not page:
            continue

        for line in page:
            box, (text, confidence) = line
            print(f"{confidence:.3f}  {text}")


if __name__ == "__main__":
    main()