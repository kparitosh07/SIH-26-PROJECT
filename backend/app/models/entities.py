"""SQLAlchemy ORM models: users, scans, products, violations, reports, audit_logs."""
from datetime import datetime
from enum import Enum
from typing import Any

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Index,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class UserRole(str, Enum):
    ADMIN = "admin"
    INSPECTOR = "inspector"
    AUDITOR = "auditor"

    @classmethod
    def as_list(cls) -> list[str]:
        return [e.value for e in cls]


class ScanStatus(str, Enum):
    UPLOADED = "uploaded"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class ScanSeverity(str, Enum):
    PASS = "pass"
    MINOR = "minor"
    MAJOR = "major"
    CRITICAL = "critical"


class AuditableMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class User(Base, AuditableMixin):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    username: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(200), nullable=False)
    role: Mapped[UserRole] = mapped_column(SAEnum(UserRole, name="user_role", create_constraint=False), default=UserRole.INSPECTOR, index=True)
    department: Mapped[str | None] = mapped_column(String(120), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    two_fa_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    scans: Mapped[list["Scan"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    audit_logs: Mapped[list["AuditLog"]] = relationship(back_populates="user", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<User id={self.id} username={self.username} role={self.role.value}>"


class Product(Base, AuditableMixin):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str | None] = mapped_column(String(300), nullable=True, index=True)
    brand: Mapped[str | None] = mapped_column(String(200), nullable=True, index=True)
    category: Mapped[str | None] = mapped_column(String(120), nullable=True, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    normalized_name: Mapped[str | None] = mapped_column(String(300), nullable=True, index=True)

    scans: Mapped[list["Scan"]] = relationship(back_populates="product")

    def __repr__(self) -> str:
        return f"<Product id={self.id} name={self.name!r}>"


class Scan(Base, AuditableMixin):
    __tablename__ = "scans"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    product_id: Mapped[int | None] = mapped_column(ForeignKey("products.id", ondelete="SET NULL"), nullable=True, index=True)

    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)      # storage key / path
    file_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    file_size_bytes: Mapped[int] = mapped_column(nullable=False)
    content_type: Mapped[str] = mapped_column(String(80), nullable=False)

    status: Mapped[ScanStatus] = mapped_column(
        SAEnum(ScanStatus, name="scan_status", create_constraint=False), default=ScanStatus.UPLOADED, index=True
    )
    progress: Mapped[int] = mapped_column(default=0, nullable=False)  # 0..100

    raw_ocr_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    ocr_confidence: Mapped[float | None] = mapped_column(nullable=True)
    extracted_fields: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    ocr_engine: Mapped[str | None] = mapped_column(String(40), nullable=True)
    ocr_latency_ms: Mapped[int | None] = mapped_column(nullable=True)

    compliance_score: Mapped[float | None] = mapped_column(nullable=True)  # 0..100
    verdict: Mapped[ScanSeverity | None] = mapped_column(
        SAEnum(ScanSeverity, name="scan_severity", create_constraint=False), nullable=True, index=True
    )

    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped["User"] = relationship(back_populates="scans")
    product: Mapped["Product"] = relationship(back_populates="scans")
    violations: Mapped[list["Violation"]] = relationship(back_populates="scan", cascade="all, delete-orphan")
    report: Mapped["Report | None"] = relationship(back_populates="scan", uselist=False, cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_scans_user_created", "user_id", "created_at"),
        Index("ix_scans_status_created", "status", "created_at"),
    )

    def __repr__(self) -> str:
        return f"<Scan id={self.id} status={self.status.value}>"


class Violation(Base, AuditableMixin):
    """A single missing/incorrect compliance field detected on a scan."""
    __tablename__ = "violations"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    scan_id: Mapped[int] = mapped_column(ForeignKey("scans.id", ondelete="CASCADE"), index=True, nullable=False)

    field_key: Mapped[str] = mapped_column(String(40), index=True, nullable=False)   # e.g. mrp, net_quantity
    label: Mapped[str] = mapped_column(String(120), nullable=False)                  # human readable e.g. "MRP (Maximum Retail Price)"
    status: Mapped[ScanSeverity] = mapped_column(SAEnum(ScanSeverity, name="violation_severity", create_constraint=False), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    evidence: Mapped[str | None] = mapped_column(Text, nullable=True)                 # matched text snippet or OCR region
    regex_pattern: Mapped[str | None] = mapped_column(Text, nullable=True)
    extracted_value: Mapped[str | None] = mapped_column(String(500), nullable=True)

    scan: Mapped["Scan"] = relationship(back_populates="violations")

    __table_args__ = (Index("ix_violations_scan_field", "scan_id", "field_key"),)

    def __repr__(self) -> str:
        return f"<Violation id={self.id} field={self.field_key} status={self.status.value}>"


class Report(Base, AuditableMixin):
    __tablename__ = "reports"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    scan_id: Mapped[int] = mapped_column(ForeignKey("scans.id", ondelete="CASCADE"), unique=True, index=True, nullable=False)
    report_file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    report_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    generated_by: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    remarks: Mapped[str | None] = mapped_column(Text, nullable=True)
    meta: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)

    scan: Mapped["Scan"] = relationship(back_populates="report")

    def __repr__(self) -> str:
        return f"<Report id={self.id} scan_id={self.scan_id}>"


class AuditLog(Base, AuditableMixin):
    """Immutable action trail for traceability."""
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    action: Mapped[str] = mapped_column(String(60), index=True, nullable=False)
    resource: Mapped[str | None] = mapped_column(String(60), nullable=True)
    resource_id: Mapped[str | None] = mapped_column(String(60), nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(255), nullable=True)
    details: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)

    user: Mapped["User | None"] = relationship(back_populates="audit_logs")

    __table_args__ = (Index("ix_audit_created_action", "created_at", "action"),)

    def __repr__(self) -> str:
        return f"<AuditLog id={self.id} action={self.action}>"