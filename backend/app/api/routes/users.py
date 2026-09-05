"""User management endpoints (admin only)."""
from fastapi import APIRouter, Depends, HTTPException, Request, status, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_admin
from app.core.logging import get_logger
from app.core.security import get_password_hash
from app.models.entities import User, UserRole
from app.schemas.schemas import ApiResponse, Paginated, UserCreate, UserRead, UserUpdate
from app.services.audit import log_action

logger = get_logger("users")
router = APIRouter(prefix="/users", tags=["users"], dependencies=[Depends(require_admin)])


@router.get("", response_model=ApiResponse[Paginated[UserRead]])
def list_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = Query(None),
    role: UserRole | None = Query(None),
    is_active: bool | None = Query(None),
    db: Session = Depends(get_db),
    request: Request = None,
):
    query = db.query(User)
    if search:
        term = f"%{search}%"
        query = query.filter(User.username.ilike(term) | User.email.ilike(term) | User.full_name.ilike(term))
    if role:
        query = query.filter(User.role == role)
    if is_active is not None:
        query = query.filter(User.is_active == is_active)

    total = query.count()
    items = query.order_by(User.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return ApiResponse(data=Paginated(
        items=[UserRead.model_validate(u) for u in items],
        total=total, page=page, page_size=page_size,
        total_pages=(total + page_size - 1) // page_size
    ))


@router.post("", response_model=ApiResponse[UserRead], status_code=status.HTTP_201_CREATED)
def create_user(payload: UserCreate, db: Session = Depends(get_db), request: Request = None):
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(409, "Email already exists")
    if db.query(User).filter(User.username == payload.username).first():
        raise HTTPException(409, "Username taken")

    user = User(
        email=payload.email,
        username=payload.username,
        hashed_password=get_password_hash(payload.password),
        full_name=payload.full_name,
        role=payload.role,
        department=payload.department,
        phone=payload.phone,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    log_action(db, None, "user.created", "users", user.id, {"by_admin": True}, request)
    return ApiResponse(data=UserRead.model_validate(user), message="User created")


@router.get("/stats/summary", response_model=ApiResponse[dict])
def stats_summary(db: Session = Depends(get_db)):
    total = db.query(func.count(User.id)).scalar()
    admins = db.query(func.count(User.id)).filter(User.role == UserRole.ADMIN).scalar()
    active = db.query(func.count(User.id)).filter(User.is_active.is_(True)).scalar()
    return ApiResponse(data={"total_users": total, "admin_count": admins, "active_users": active})


@router.get("/{user_id}", response_model=ApiResponse[UserRead])
def get_user(user_id: int, db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(404, "User not found")
    return ApiResponse(data=UserRead.model_validate(user))


@router.patch("/{user_id}", response_model=ApiResponse[UserRead])
def update_user(user_id: int, payload: UserUpdate, db: Session = Depends(get_db), request: Request = None):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(404, "User not found")

    data = payload.model_dump(exclude_unset=True)
    if "password" in data:
        data["hashed_password"] = get_password_hash(data.pop("password"))
    for k, v in data.items():
        setattr(user, k, v)
    db.commit()
    db.refresh(user)
    log_action(db, None, "user.updated", "users", user.id, {"changes": list(data.keys())}, request)
    return ApiResponse(data=UserRead.model_validate(user), message="User updated")


@router.delete("/{user_id}", response_model=ApiResponse[None], status_code=status.HTTP_200_OK)
def delete_user(user_id: int, db: Session = Depends(get_db), request: Request = None):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(404, "User not found")
    if user.role == "admin":
        raise HTTPException(403, "Cannot delete admin users via API")
    db.delete(user)
    db.commit()
    log_action(db, None, "user.deleted", "users", user_id, request=request)
    return ApiResponse(message="User deleted")