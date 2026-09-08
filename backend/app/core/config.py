# ============================================================
# App Core Configuration
# All settings are loaded from environment variables with safe
# defaults for local development. Production must override these.
# ============================================================

from functools import lru_cache
from typing import List, Literal

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", case_sensitive=True, extra="allow"
    )

    # --- App ---
    APP_NAME: str = "Label Compliance Checker"
    APP_ENV: Literal["development", "staging", "production"] = "development"
    DEBUG: bool = True
    API_V1_PREFIX: str = "/api/v1"
    BASE_URL: str = "http://localhost:8000"

    # --- Security ---
    SECRET_KEY: str = "change-me-in-production-9f8f7e6d"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 12  # 12 hours
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    BCRYPT_ROUNDS: int = 12

    # --- Database ---
    DATABASE_URL: str = (
        "postgresql+psycopg2://label_user:label_pass@localhost:5432/label_compliance"
    )
    DB_ECHO: bool = False

    # --- Redis / Celery ---
    REDIS_URL: str = "redis://localhost:6379/0"
    CELERY_BROKER_URL: str = "redis://localhost:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/2"

    # --- Storage (S3-compatible) ---
    STORAGE_BACKEND: Literal["local", "s3"] = "local"
    LOCAL_UPLOAD_DIR: str = "./uploads"
    S3_BUCKET: str = "label-compliance-uploads"
    S3_REGION: str = "ap-south-1"
    AWS_ACCESS_KEY_ID: str | None = None
    AWS_SECRET_ACCESS_KEY: str | None = None
    MAX_UPLOAD_SIZE_MB: int = 20
    ALLOWED_FILE_TYPES: List[str] = [".png", ".jpg", ".jpeg", ".pdf", ".webp", ".bmp"]

    # --- CORS ---
    CORS_ORIGINS: List[str] | str = ["http://localhost:3000", "http://localhost:5173"]

    # --- OCR ---
    OCR_ENGINE: Literal["paddleocr", "tesseract"] = "paddleocr"
    OCR_LANG: str = "en"
    PADDLE_DEVICE: Literal["cpu", "gpu"] = "cpu"
    OCR_DPI: int = 300
    OCR_CONFIDENCE_THRESHOLD: float = 0.45

    # --- Rate limiting ---
    RATE_LIMIT_UPLOAD: str = "60/minute"
    RATE_LIMIT_GENERAL: str = "120/minute"

    # --- Logging ---
    LOG_LEVEL: str = "INFO"
    LOG_JSON: bool = True
    LOG_FILE: str = "./logs/app.log"

    # --- Report ---
    REPORT_DIR: str = "./reports"
    PDF_LICENSE_HEADER: str = (
        "Compliance assessment performed by AI-based Label Compliance Checker. "
        "This report is a machine-generated draft and does not substitute "
        "certified laboratory or legal verification."
    )

    # --- Pagination ---
    DEFAULT_PAGE_SIZE: int = 20
    MAX_PAGE_SIZE: int = 100

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def split_origins(cls, v):
        if isinstance(v, str):
            # Clean brackets or outer quotes if provided as JSON-like list string
            v = v.strip().lstrip("[").rstrip("]")
            origins = []
            for o in v.split(","):
                cleaned = o.strip().strip('"').strip("'")
                if cleaned:
                    origins.append(cleaned)
            return origins
        return v

    @field_validator("ALLOWED_FILE_TYPES", mode="before")
    @classmethod
    def split_extensions(cls, v):
        if isinstance(v, str):
            return [e.strip().lower() for e in v.split(",") if e.strip()]
        return v


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()