# Database session management
from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import settings

def _create_database_engine():
    db_url = settings.DATABASE_URL
    connect_args = {}

    if db_url.startswith("sqlite"):
        connect_args["check_same_thread"] = False
        return create_engine(db_url, connect_args=connect_args, echo=settings.DB_ECHO, future=True)

    eng = create_engine(
        db_url,
        connect_args={"connect_timeout": 2},
        echo=settings.DB_ECHO,
        pool_pre_ping=True,
        pool_size=10,
        max_overflow=20,
        future=True,
    )

    # In development mode, check if PostgreSQL is reachable.
    # If not reachable, fallback to SQLite so local development works without requiring a local Postgres server.
    if settings.DEBUG or settings.APP_ENV == "development":
        try:
            with eng.connect():
                pass
        except Exception:
            from app.core.logging import logger
            logger.warning(
                "PostgreSQL connection to %s failed. Falling back to local SQLite database (label_compliance.db) for development.",
                db_url,
            )
            fallback_url = "sqlite:///./label_compliance.db"
            return create_engine(
                fallback_url,
                connect_args={"check_same_thread": False},
                echo=settings.DB_ECHO,
                future=True,
            )

    return eng


engine = _create_database_engine()

SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    """Base model class. """


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency that yields a database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()