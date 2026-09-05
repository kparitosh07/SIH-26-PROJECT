"""Initial schema: users, products, scans, violations, reports, audit_logs.

Revision ID: 0001
Revises:
Create Date: 2026-01-01 00:00:00
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("username", sa.String(length=100), nullable=False),
        sa.Column("hashed_password", sa.String(length=255), nullable=False),
        sa.Column("full_name", sa.String(length=200), nullable=False),
        sa.Column("role", sa.String(length=20), nullable=True),
        sa.Column("department", sa.String(length=120), nullable=True),
        sa.Column("phone", sa.String(length=20), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("two_fa_enabled", sa.Boolean(), nullable=False),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)
    op.create_index("ix_users_username", "users", ["username"], unique=True)
    op.create_index("ix_users_role", "users", ["role"])

    op.create_table(
        "products",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=300), nullable=True),
        sa.Column("brand", sa.String(length=200), nullable=True),
        sa.Column("category", sa.String(length=120), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("normalized_name", sa.String(length=300), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_products_name", "products", ["name"])
    op.create_index("ix_products_brand", "products", ["brand"])
    op.create_index("ix_products_category", "products", ["category"])
    op.create_index("ix_products_normalized_name", "products", ["normalized_name"])

    op.create_table(
        "scans",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("product_id", sa.Integer(), nullable=True),
        sa.Column("original_filename", sa.String(length=255), nullable=False),
        sa.Column("file_path", sa.String(length=500), nullable=False),
        sa.Column("file_hash", sa.String(length=64), nullable=False),
        sa.Column("file_size_bytes", sa.Integer(), nullable=False),
        sa.Column("content_type", sa.String(length=80), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=True),
        sa.Column("progress", sa.Integer(), nullable=False),
        sa.Column("raw_ocr_text", sa.Text(), nullable=True),
        sa.Column("ocr_confidence", sa.Float(), nullable=True),
        sa.Column("extracted_fields", JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("ocr_engine", sa.String(length=40), nullable=True),
        sa.Column("ocr_latency_ms", sa.Integer(), nullable=True),
        sa.Column("compliance_score", sa.Float(), nullable=True),
        sa.Column("verdict", sa.String(length=20), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_scans_user_id", "scans", ["user_id"])
    op.create_index("ix_scans_product_id", "scans", ["product_id"])
    op.create_index("ix_scans_file_hash", "scans", ["file_hash"])
    op.create_index("ix_scans_status", "scans", ["status"])
    op.create_index("ix_scans_verdict", "scans", ["verdict"])
    op.create_index("ix_scans_user_created", "scans", ["user_id", "created_at"])
    op.create_index("ix_scans_status_created", "scans", ["status", "created_at"])

    op.create_table(
        "violations",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("scan_id", sa.Integer(), nullable=False),
        sa.Column("field_key", sa.String(length=40), nullable=False),
        sa.Column("label", sa.String(length=120), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("evidence", sa.Text(), nullable=True),
        sa.Column("regex_pattern", sa.Text(), nullable=True),
        sa.Column("extracted_value", sa.String(length=500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["scan_id"], ["scans.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_violations_scan_id", "violations", ["scan_id"])
    op.create_index("ix_violations_field_key", "violations", ["field_key"])
    op.create_index("ix_violations_scan_field", "violations", ["scan_id", "field_key"])

    op.create_table(
        "reports",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("scan_id", sa.Integer(), nullable=False),
        sa.Column("report_file_path", sa.String(length=500), nullable=False),
        sa.Column("report_hash", sa.String(length=64), nullable=False),
        sa.Column("generated_by", sa.Integer(), nullable=True),
        sa.Column("remarks", sa.Text(), nullable=True),
        sa.Column("meta", JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["generated_by"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["scan_id"], ["scans.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_reports_scan_id", "reports", ["scan_id"], unique=True)

    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("action", sa.String(length=60), nullable=False),
        sa.Column("resource", sa.String(length=60), nullable=True),
        sa.Column("resource_id", sa.String(length=60), nullable=True),
        sa.Column("ip_address", sa.String(length=45), nullable=True),
        sa.Column("user_agent", sa.String(length=255), nullable=True),
        sa.Column("details", JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_audit_logs_user_id", "audit_logs", ["user_id"])
    op.create_index("ix_audit_logs_action", "audit_logs", ["action"])
    op.create_index("ix_audit_created_action", "audit_logs", ["created_at", "action"])


def downgrade() -> None:
    op.drop_table("audit_logs")
    op.drop_table("reports")
    op.drop_table("violations")
    op.drop_table("scans")
    op.drop_table("products")
    op.drop_table("users")