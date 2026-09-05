"""Main FastAPI application factory."""
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.core.config import settings
from app.core.database import engine
from app.core.logging import get_logger, logger
from app.core.rate_limit import limiter
from app.models.entities import Base
from app.api.routes import auth, scans, users, dashboard, reports, products, audit_logs, violations


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting %s in %s mode", settings.APP_NAME, settings.APP_ENV)
    Base.metadata.create_all(bind=engine)
    yield
    # Shutdown
    logger.info("Shutting down")


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.APP_NAME,
        version="1.0.0",
        docs_url="/docs" if settings.DEBUG else None,
        redoc_url="/redoc" if settings.DEBUG else None,
        lifespan=lifespan,
    )

    # Rate limiting
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Request logging middleware
    @app.middleware("http")
    async def log_requests(request: Request, call_next):
        start = __import__("time").perf_counter()
        response = await call_next(request)
        duration = (__import__("time").perf_counter() - start) * 1000
        logger.info(
            "%s %s %d %.1fms",
            request.method,
            request.url.path,
            response.status_code,
            duration,
        )
        return response

    # Routers
    app.include_router(auth.router, prefix=settings.API_V1_PREFIX)
    app.include_router(users.router, prefix=settings.API_V1_PREFIX)
    app.include_router(scans.router, prefix=settings.API_V1_PREFIX)
    app.include_router(violations.router, prefix=settings.API_V1_PREFIX)
    app.include_router(reports.router, prefix=settings.API_V1_PREFIX)
    app.include_router(products.router, prefix=settings.API_V1_PREFIX)
    app.include_router(dashboard.router, prefix=settings.API_V1_PREFIX)
    app.include_router(audit_logs.router, prefix=settings.API_V1_PREFIX)

    # Health check
    @app.get("/health")
    async def health():
        return {"status": "ok", "version": "1.0.0", "env": settings.APP_ENV}

    # Static file serving for local uploads (dev only)
    if settings.STORAGE_BACKEND == "local" and settings.DEBUG:
        from fastapi.staticfiles import StaticFiles
        import os

        upload_dir = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            "uploads"
        )

        os.makedirs(upload_dir, exist_ok=True)
        app.mount("/static", StaticFiles(directory=upload_dir), name="static")

    return app


app = create_app()