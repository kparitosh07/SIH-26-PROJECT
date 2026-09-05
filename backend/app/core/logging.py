"""Centralized JSON logging with console + rotating file handlers."""
import logging
import sys
from logging.handlers import RotatingFileHandler
from pathlib import Path

from pythonjsonlogger.json import JsonFormatter

from app.core.config import settings


def _configure() -> logging.Logger:
    root = logging.getLogger()
    root.setLevel(settings.LOG_LEVEL.upper())
    root.handlers.clear()

    fmt = "%(asctime)s %(levelname)s %(name)s %(module)s %(funcName)s %(lineno)d %(message)s"
    formatter: logging.Formatter

    if settings.LOG_JSON:
        formatter = JsonFormatter(
            "%(asctime)s %(levelname)s %(name)s %(module)s %(funcName)s %(lineno)d %(message)s",
            rename_fields={"asctime": "timestamp", "levelname": "level"},
        )
    else:
        formatter = logging.Formatter(fmt)

    console = logging.StreamHandler(sys.stdout)
    console.setFormatter(formatter)
    root.addHandler(console)

    try:
        log_path = Path(settings.LOG_FILE)
        log_path.parent.mkdir(parents=True, exist_ok=True)
        file_handler = RotatingFileHandler(
            log_path, maxBytes=10 * 1024 * 1024, backupCount=5, encoding="utf-8"
        )
        file_handler.setFormatter(formatter)
        root.addHandler(file_handler)
    except OSError:
        # Logging to file is best-effort (may fail in read-only containers).
        pass

    # Quiet down noisy third-party loggers.
    for noisy in ("uvicorn.access", "watchfiles", "botocore", "s3transfer", "paddleocr"):
        logging.getLogger(noisy).setLevel(logging.WARNING)

    return root


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)


logger = _configure()