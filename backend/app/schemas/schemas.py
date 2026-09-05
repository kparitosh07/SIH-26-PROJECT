"""Pydantic v2 schemas for all API contracts."""
from datetime import datetime
from typing import Any, Generic, Literal, TypeVar

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.models.entities import ScanSeverity, ScanStatus

T = TypeVar("T")


# ---------------------------------------------------------------------------
# Generic response envelope
# ---------------------------------------------------------------------------
class ApiResponse(BaseModel, Generic[T]):
    success: bool = True
    data: T | None = None
    message: str | None = None


class Paginated(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int
    total_pages: int


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------
class TokenPayload(BaseModel):
    sub: str
    exp: datetime
    role: str
    type: str = "access"


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    refresh_expires_in: int


class RefreshRequest(BaseModel):
    refresh_token: str


class LoginRequest(BaseModel):
    username_or_email: str
    password: str = Field(min_length=6)


class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=1, max_length=200)
    department: str | None = None
    phone: str | None = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------
class UserBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    email: EmailStr
    username: str
    full_name: str
    role: str
    department: str | None = None
    phone: str | None = None
    is_active: bool = True


class UserRead(UserBase):
    id: int
    last_login_at: datetime | None = None
    created_at: datetime


class UserUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=200)
    department: str | None = None
    phone: str | None = None
    role: str | None = None
    is_active: bool | None = None


class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=1, max_length=200)
    role: str = "inspector"
    department: str | None = None
    phone: str | None = None


# ---------------------------------------------------------------------------
# Products
# ---------------------------------------------------------------------------
class ProductRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str | None = None
    brand: str | None = None
    category: str | None = None
    description: str | None = None


class ProductUpsert(BaseModel):
    name: str | None = None
    brand: str | None = None
    category: str | None = None
    description: str | None = None


# ---------------------------------------------------------------------------
# Scans / Upload
# ---------------------------------------------------------------------------
class ScanCreate(BaseModel):
    original_filename: str
    content_type: str
    file_size_bytes: int
    product_id: int | None = None


class ScanStatusUpdate(BaseModel):
    status: ScanStatus
    progress: int = Field(ge=0, le=100)
    error_message: str | None = None


class ScanRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    original_filename: str
    content_type: str
    file_size_bytes: int
    status: ScanStatus
    progress: int
    ocr_confidence: float | None = None
    compliance_score: float | None = None
    verdict: ScanSeverity | None = None
    error_message: str | None = None
    completed_at: datetime | None = None
    created_at: datetime
    product: ProductRead | None = None


class ScanDetail(ScanRead):
    raw_ocr_text: str | None = None
    extracted_fields: dict[str, Any] | None = None
    ocr_engine: str | None = None
    ocr_latency_ms: int | None = None
    violations: list["ViolationRead"] = []
    report: "ReportRead | None" = None


class ScanActionRequest(BaseModel):
    action: Literal["retry", "reprocess"]


class CompatStatusRequest(BaseModel):
    status: Literal["pass", "review", "reject"]
    remarks: str | None = Field(default=None, max_length=2000)


# ---------------------------------------------------------------------------
# Violations
# ---------------------------------------------------------------------------
class ViolationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    field_key: str
    label: str
    status: ScanSeverity
    message: str
    evidence: str | None = None
    regex_pattern: str | None = None
    extracted_value: str | None = None


# ---------------------------------------------------------------------------
# Reports
# ---------------------------------------------------------------------------
class ReportRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    scan_id: int
    report_file_path: str
    generated_by: int | None = None
    remarks: str | None = None
    meta: dict[str, Any] | None = None
    created_at: datetime


class ReportGenerateRequest(BaseModel):
    remarks: str | None = Field(default=None, max_length=2000)


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------
class DashboardOverview(BaseModel):
    total_scans: int
    completed_scans: int
    fail_scans: int
    pass_rate: float
    avg_ocr_confidence: float | None = None
    avg_compliance_score: float | None = None
    last_24h_scans: int
    active_users: int


class StatusTrendPoint(BaseModel):
    date: str
    total: int
    failed: int
    passed: int


class CategoryPoint(BaseModel):
    label: str
    value: float


class ViolationPoint(BaseModel):
    field_key: str
    label: str
    count: int


class RecentScan(BaseModel):
    id: int
    original_filename: str
    status: ScanStatus
    verdict: ScanSeverity | None
    compliance_score: float | None
    created_at: datetime
    user: UserRead | None = None


class DashboardResponse(BaseModel):
    overview: DashboardOverview
    status_trend: list[StatusTrendPoint]
    category_distribution: list[CategoryPoint]
    top_violations: list[ViolationPoint]
    recent_scans: list[RecentScan]


# ---------------------------------------------------------------------------
# Audit logs
# ---------------------------------------------------------------------------
class AuditLogRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int | None = None
    action: str
    resource: str | None = None
    resource_id: str | None = None
    ip_address: str | None = None
    user_agent: str | None = None
    details: dict[str, Any] | None = None
    created_at: datetime


class AuditLogDetail(AuditLogRead):
    user: UserRead | None = None


class StatsSummary(BaseModel):
    total_users: int
    total_scans: int
    total_violations: int
    total_reports: int
    admin_count: int


# Ensure ScanDetail definition completes after ViolationRead/ReportRead
ScanDetail.model_rebuild()