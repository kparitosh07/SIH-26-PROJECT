"""Feedback endpoints for app ratings and user suggestions."""
from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user_optional, require_admin
from app.models.entities import Feedback, User
from app.schemas.schemas import ApiResponse, FeedbackCreate, FeedbackRead, Paginated
from app.services.audit import log_action

router = APIRouter(prefix="/feedback", tags=["feedback"])


@router.post("", response_model=ApiResponse[FeedbackRead], status_code=status.HTTP_201_CREATED)
def submit_feedback(
    body: FeedbackCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: User | None = Depends(get_current_user_optional),
):
    feedback = Feedback(
        user_id=user.id if user else None,
        rating=body.rating,
        category=body.category,
        comments=body.comments,
    )
    db.add(feedback)
    db.commit()
    db.refresh(feedback)

    log_action(
        db,
        user,
        "feedback.submitted",
        "feedback",
        feedback.id,
        {"rating": body.rating, "category": body.category},
        request,
    )
    return ApiResponse(
        data=FeedbackRead.model_validate(feedback),
        message="Thank you for your feedback!",
    )


@router.get("", response_model=ApiResponse[Paginated[FeedbackRead]])
def list_feedback(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    query = db.query(Feedback).order_by(Feedback.created_at.desc())
    total = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()

    return ApiResponse(
        data=Paginated(
            items=[FeedbackRead.model_validate(f) for f in items],
            total=total,
            page=page,
            page_size=page_size,
            total_pages=(total + page_size - 1) // page_size,
        )
    )
