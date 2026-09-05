"""Authentication endpoints: login, register, refresh, me."""
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_user, get_current_user_optional
from app.core.logging import get_logger
from app.core.rate_limit import limiter
from app.core.security import create_access_token, create_refresh_token, decode_token, get_password_hash, verify_password
from app.models.entities import User
from app.schemas.schemas import (
    ApiResponse,
    LoginRequest,
    RegisterRequest,
    RefreshRequest,
    TokenResponse,
    UserRead,
)
from app.services.audit import log_action

logger = get_logger("auth")
router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=ApiResponse[UserRead], status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute")
def register(
    request: Request,
    payload: RegisterRequest,
    db: Session = Depends(get_db),
):
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=409, detail="Email already registered")
    if db.query(User).filter(User.username == payload.username).first():
        raise HTTPException(status_code=409, detail="Username taken")

    user = User(
        email=payload.email,
        username=payload.username,
        hashed_password=get_password_hash(payload.password),
        full_name=payload.full_name,
        department=payload.department,
        phone=payload.phone,
        role="inspector",  # default; admin upgrades later
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    log_action(db, user, "user.registered", resource="users", resource_id=user.id, request=request)
    logger.info("New user registered: %s", user.username)
    return ApiResponse(data=UserRead.model_validate(user), message="Registration successful")


@router.post("/login", response_model=ApiResponse[TokenResponse])
@limiter.limit(settings.RATE_LIMIT_GENERAL)
def login(
    request: Request,
    payload: LoginRequest,
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(
        (User.username == payload.username_or_email) | (User.email == payload.username_or_email)
    ).first()

    if not user or not verify_password(payload.password, user.hashed_password):
        log_action(db, None, "auth.login_failed", details={"identifier": payload.username_or_email}, request=request)
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account disabled")

    user.last_login_at = datetime.now(timezone.utc)
    db.commit()

    access, access_exp = create_access_token(user.id, extra={"role": user.role.value})
    refresh, refresh_exp = create_refresh_token(user.id)

    log_action(db, user, "auth.login", resource="users", resource_id=user.id, request=request)
    logger.info("User logged in: %s", user.username)

    return ApiResponse(
        data=TokenResponse(
            access_token=access,
            refresh_token=refresh,
            expires_in=int((access_exp - datetime.now(timezone.utc)).total_seconds()),
            refresh_expires_in=int((refresh_exp - datetime.now(timezone.utc)).total_seconds()),
        ),
        message="Login successful",
    )


@router.post("/refresh", response_model=ApiResponse[TokenResponse])
@limiter.limit("60/minute")
def refresh(
    request: Request,
    payload: RefreshRequest,
    db: Session = Depends(get_db),
):
    decoded = decode_token(payload.refresh_token)
    if not decoded or decoded.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    user_id = int(decoded["sub"])
    user = db.get(User, user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")

    access, access_exp = create_access_token(user.id, extra={"role": user.role.value})
    refresh, refresh_exp = create_refresh_token(user.id)

    log_action(db, user, "auth.token_refreshed", resource="users", resource_id=user.id, request=request)
    return ApiResponse(
        data=TokenResponse(
            access_token=access,
            refresh_token=refresh,
            expires_in=int((access_exp - datetime.now(timezone.utc)).total_seconds()),
            refresh_expires_in=int((refresh_exp - datetime.now(timezone.utc)).total_seconds()),
        )
    )


@router.get("/me", response_model=ApiResponse[UserRead])
def me(user: User = Depends(get_current_user)):
    return ApiResponse(data=UserRead.model_validate(user))


@router.post("/logout", response_model=ApiResponse[None])
def logout(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    request: Request = None,
):
    log_action(db=db, user=user, action="auth.logout", resource="users", resource_id=user.id, request=request)
    return ApiResponse(message="Logged out")


@router.get("/verify", response_model=ApiResponse[dict[str, Any]])
def verify_token(user: User = Depends(get_current_user_optional)):
    if not user:
        return ApiResponse(success=False, data={"valid": False})
    return ApiResponse(data={"valid": True, "user_id": user.id, "role": user.role.value})