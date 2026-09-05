"""FastAPI dependencies: current user resolution, role-based access control."""
from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import decode_token
from app.models.entities import User, UserRole


def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
) -> User:
    credentials_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    authorization = request.headers.get("Authorization", "")
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise credentials_exc

    payload = decode_token(token)
    if payload is None:
        raise credentials_exc
    if payload.get("type") not in (None, "access"):
        raise credentials_exc

    user_id = payload.get("sub")
    if not user_id:
        raise credentials_exc

    user = db.get(User, int(user_id))
    if user is None or not user.is_active:
        raise credentials_exc
    return user


def require_roles(*roles: UserRole):
    def role_checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required role(s): {', '.join(r.value for r in roles)}",
            )
        return user

    return role_checker


require_admin = require_roles(UserRole.ADMIN)
require_inspector = require_roles(UserRole.ADMIN, UserRole.INSPECTOR)
require_auditor = require_roles(UserRole.ADMIN, UserRole.AUDITOR)
require_staff = require_roles(UserRole.ADMIN, UserRole.INSPECTOR, UserRole.AUDITOR)


def get_current_user_optional(
    request: Request,
    db: Session = Depends(get_db),
) -> User | None:
    authorization = request.headers.get("Authorization", "")
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        return None
    payload = decode_token(token)
    if payload is None:
        return None
    user_id = payload.get("sub")
    if not user_id:
        return None
    user = db.get(User, int(user_id))
    return user if user and user.is_active else None