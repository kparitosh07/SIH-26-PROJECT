"""Celery app and shared configuration."""
from celery import Celery
from celery.signals import task_failure, worker_process_init

from app.core.config import settings


celery_app = Celery(
    "label_compliance",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=["app.tasks.scan_tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    worker_prefetch_multiplier=1,
    task_routes={
        "app.tasks.scan_tasks.process_scan_task": {"queue": "ocr"},
    },
    beat_schedule={},
)


@worker_process_init.connect
def fix_paddleocr_multiprocessing(**kwargs):
    """PaddleOCR uses multiprocessing; ensure fork safety."""
    import multiprocessing
    try:
        multiprocessing.set_start_method("spawn", force=True)
    except RuntimeError:
        pass


@task_failure.connect
def log_task_failure(sender=None, exception=None, **kwargs):
    from app.core.logging import get_logger
    get_logger("celery").error("Task %s failed: %s", sender.name if sender else "unknown", exception)