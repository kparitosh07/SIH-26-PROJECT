"""API route modules registry."""
from app.api.routes import auth, audit_logs, dashboard, products, reports, scans, users, violations

__all__ = ["auth", "audit_logs", "dashboard", "products", "reports", "scans", "users", "violations"]