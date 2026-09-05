"""Audit trail service — every security-relevant action is logged."""
from typing import Any

from fastapi import Request
from sqlalchemy.orm import Session

from app.models.entities import AuditLog, User


def _client_meta(request: Request | None) -> dict[str, str | None]:
    if request is None:
        return {"ip_address": None, "user_agent": None}
    return {
        "ip_address": request.client.host if request.client else None,
        "user_agent": request.headers.get("user-agent"),
    }


def log_action(
    db: Session,
    user: User | None,
    action: str,
    resource: str | None = None,
    resource_id: str | int | None = None,
    details: dict[str, Any] | None = None,
    request: Request | None = None,
) -> AuditLog:
    meta = _client_meta(request)
    entry = AuditLog(
        user_id=user.id if user else None,
        action=action,
        resource=resource,
        resource_id=str(resource_id) if resource_id is not None else None,
        ip_address=meta["ip_address"],
        user_agent=meta["user_agent"],
        details=details,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry