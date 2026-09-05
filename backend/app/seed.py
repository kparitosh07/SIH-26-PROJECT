"""Seed script: create admin & demo users, sample products.

Usage:
    python -m app.seed
Creates users only if they do not already exist (idempotent).
"""
from __future__ import annotations

import os

from sqlalchemy.orm import Session

from app.core.database import SessionLocal, Base, engine
from app.core.security import get_password_hash
from app.models.entities import Product, User, UserRole

DEFAULT_ADMIN_PASSWORD = os.getenv("INIT_ADMIN_PASSWORD", "Admin@12345")


def seed_users(db: Session) -> None:
    admin = db.query(User).filter(User.username == "admin").first()
    if not admin:
        db.add(User(
            username="admin",
            email="admin@labelcheck.local",
            hashed_password=get_password_hash(DEFAULT_ADMIN_PASSWORD),
            full_name="System Administrator",
            role=UserRole.ADMIN,
            department="IT Administration",
            is_active=True,
        ))
        print(f"[seed] Created admin user (username=admin, password set from INIT_ADMIN_PASSWORD)")
    else:
        print("[seed] Admin user already exists")

    inspector = db.query(User).filter(User.username == "inspector").first()
    if not inspector:
        db.add(User(
            username="inspector",
            email="inspector@labelcheck.local",
            hashed_password=get_password_hash("Inspector@12345"),
            full_name="Ravi Inspector",
            role=UserRole.INSPECTOR,
            department="Food Safety Division",
            is_active=True,
        ))
        print("[seed] Created inspector user (username=inspector / Inspector@12345)")

    auditor = db.query(User).filter(User.username == "auditor").first()
    if not auditor:
        db.add(User(
            username="auditor",
            email="auditor@labelcheck.local",
            hashed_password=get_password_hash("Auditor@12345"),
            full_name="Meera Auditor",
            role=UserRole.AUDITOR,
            department="Quality Control",
            is_active=True,
        ))
        print("[seed] Created auditor user (username=auditor / Auditor@12345)")


def seed_products(db: Session) -> None:
    sample = [
        {"name": "Sunflower Cooking Oil", "brand": "Fortune", "category": "FMCG / Food"},
        {"name": "Basmati Rice 1kg", "brand": "India Gate", "category": "FMCG / Food"},
        {"name": "Antiseptic Liquid", "brand": "Dettol", "category": "Pharma / Hygiene"},
        {"name": "Moisturizing Cream", "brand": "Nivea", "category": "Cosmetics"},
        {"name": "Instant Coffee", "brand": "Nescafe", "category": "FMCG / Food"},
    ]
    count = 0
    for item in sample:
        existing = db.query(Product).filter(
            Product.name == item["name"], Product.brand == item["brand"]
        ).first()
        if not existing:
            product = Product(**item, normalized_name=" ".join(item["name"].lower().split()))
            db.add(product)
            count += 1
    if count:
        print(f"[seed] Created {count} sample products")
    else:
        print("[seed] Products already present")


def main() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_users(db)
        seed_products(db)
        db.commit()
        print("[seed] Completed")
    finally:
        db.close()


if __name__ == "__main__":
    main()