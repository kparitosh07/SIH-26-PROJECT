"""Product lookup endpoints."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_staff
from app.models.entities import Product
from app.schemas.schemas import ApiResponse, Paginated, ProductRead, ProductUpsert

router = APIRouter(prefix="/products", tags=["products"], dependencies=[Depends(require_staff)])


@router.get("", response_model=ApiResponse[Paginated[ProductRead]])
def list_products(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = Query(None),
    category: str | None = Query(None),
    db: Session = Depends(get_db),
):
    query = db.query(Product)
    if search:
        term = f"%{search}%"
        query = query.filter(Product.name.ilike(term) | Product.brand.ilike(term))
    if category:
        query = query.filter(Product.category == category)

    total = query.count()
    items = query.order_by(Product.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return ApiResponse(data=Paginated(
        items=[ProductRead.model_validate(p) for p in items],
        total=total, page=page, page_size=page_size,
        total_pages=(total + page_size - 1) // page_size
    ))


@router.post("", response_model=ApiResponse[ProductRead], status_code=201)
def upsert_product(payload: ProductUpsert, db: Session = Depends(get_db)):
    # Simple upsert by name+brand
    product = None
    if payload.name and payload.brand:
        product = db.query(Product).filter(Product.name == payload.name, Product.brand == payload.brand).first()
    if not product:
        product = Product()
        db.add(product)

    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(product, k, v)

    if payload.name:
        product.normalized_name = " ".join(payload.name.lower().split())

    db.commit()
    db.refresh(product)
    return ApiResponse(data=ProductRead.model_validate(product), message="Product saved")


@router.get("/stats/categories", response_model=ApiResponse[list[dict]])
def category_stats(db: Session = Depends(get_db)):
    rows = db.query(Product.category, func.count(Product.id)).group_by(Product.category).all()
    return ApiResponse(data=[{"category": r[0] or "Unknown", "count": r[1]} for r in rows])


@router.get("/{product_id}", response_model=ApiResponse[ProductRead])
def get_product(product_id: int, db: Session = Depends(get_db)):
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(404, "Product not found")
    return ApiResponse(data=ProductRead.model_validate(product))