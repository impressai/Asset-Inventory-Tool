"""
Asset Inventory Tool — FastAPI Application Entry Point
"""

from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.scheduler import start_scheduler, stop_scheduler
from app.db.session import engine
from app.db.base import Base

log = structlog.get_logger()

# ─── Lifespan (startup / shutdown) ───────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("Starting Asset Inventory API", version=settings.APP_VERSION, env=settings.APP_ENV)
    if settings.APP_ENV == "development":
        Base.metadata.create_all(bind=engine)
    start_scheduler()
    yield
    stop_scheduler()
    log.info("Shutting down Asset Inventory API")


# ─── Rate Limiter ─────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address)


# ─── App Factory ─────────────────────────────────────────────
def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        description="Asset Inventory Management System API",
        docs_url="/docs" if settings.APP_ENV != "production" else None,
        redoc_url="/redoc" if settings.APP_ENV != "production" else None,
        openapi_url="/openapi.json" if settings.APP_ENV != "production" else None,
        lifespan=lifespan,
    )

    # ── Rate limiting ─────────────────────────────────────────
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    # ── CORS ──────────────────────────────────────────────────
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ── Trusted Hosts (production hardening) ──────────────────
    if settings.APP_ENV == "production":
        app.add_middleware(
            TrustedHostMiddleware,
            allowed_hosts=settings.ALLOWED_HOSTS,
        )

    # ── Routes ────────────────────────────────────────────────
    app.include_router(api_router, prefix="/api/v1")

    # ── Health check (ECS / ALB target) ──────────────────────
    @app.get("/health", tags=["health"])
    async def health_check():
        return {"status": "healthy", "version": settings.APP_VERSION}

    return app


app = create_app()
