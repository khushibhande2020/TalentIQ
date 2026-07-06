"""
TalentIQ AI — FastAPI application factory.
Production-grade: request logging, correlation IDs, timing, error handling.
"""
from __future__ import annotations
import time
import uuid

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse

from app.api import api_router
from app.api.routes.health import router as health_router
from app.core.config import get_settings
from app.core.exceptions import register_exception_handlers
from app.core.logging import setup_logging, get_logger, request_id_var
from app.core.metrics import increment, record_latency
from app.db.session import init_db

settings = get_settings()
setup_logging(settings.LOG_LEVEL)
logger = get_logger(__name__)


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        description=(
            "TalentIQ AI — Workforce Decision Intelligence Platform. "
            "Powered by Gemini, BigQuery, and Semantic AI."
        ),
        docs_url="/docs" if not settings.is_production else None,
        redoc_url="/redoc" if not settings.is_production else None,
    )

    # ── Middleware ─────────────────────────────────────────────────────────────

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=settings.CORS_ALLOW_CREDENTIALS,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Compress responses > 1KB
    app.add_middleware(GZipMiddleware, minimum_size=1024)

    @app.middleware("http")
    async def request_middleware(request: Request, call_next):
        # Attach correlation ID to every request
        rid = request.headers.get("X-Request-ID", uuid.uuid4().hex[:12])
        token = request_id_var.set(rid)
        start = time.perf_counter()

        response = None
        try:
            response = await call_next(request)
        except Exception as exc:
            logger.exception("Unhandled exception in middleware")
            response = JSONResponse(status_code=500, content={"error": "Internal server error"})
        finally:
            elapsed_ms = (time.perf_counter() - start) * 1000
            path = request.url.path
            method = request.method
            status = getattr(response, "status_code", 0)

            # Metrics
            record_latency(f"http.{method.lower()}", elapsed_ms)
            increment(f"http.{status // 100}xx")

            # Log slow requests
            if settings.ENABLE_REQUEST_LOGGING:
                log = logger.warning if elapsed_ms > settings.SLOW_REQUEST_THRESHOLD_MS else logger.debug
                log("%s %s → %d (%.0f ms)", method, path, status, elapsed_ms)

            if response is not None:
                response.headers["X-Request-ID"] = rid
                response.headers["X-Response-Time-Ms"] = str(round(elapsed_ms, 1))
            request_id_var.reset(token)

        return response

    # ── Routers ────────────────────────────────────────────────────────────────
    app.include_router(health_router)         # /health/* — no prefix
    app.include_router(api_router)            # /api/v1/*

    # ── Exception handlers ─────────────────────────────────────────────────────
    register_exception_handlers(app)

    # ── Lifecycle ──────────────────────────────────────────────────────────────
    @app.on_event("startup")
    async def startup():
        logger.info("=" * 60)
        logger.info("TalentIQ AI v%s starting (%s)", settings.APP_VERSION, settings.ENVIRONMENT)
        logger.info("Database: %s", settings.DATABASE_URL.split("///")[-1])
        logger.info("Gemini: %s", "enabled" if settings.ENABLE_GEMINI else "disabled")
        logger.info("BigQuery: %s", "enabled" if settings.ENABLE_BIGQUERY else "disabled")
        logger.info("GPU: %s", "enabled" if settings.ENABLE_GPU_ACCELERATION else "disabled")
        init_db()
        logger.info("TalentIQ AI ready")
        logger.info("=" * 60)

    @app.on_event("shutdown")
    async def shutdown():
        logger.info("TalentIQ AI shutting down")

    # Keep the old /health for backwards compatibility
    @app.get("/health", include_in_schema=False)
    def legacy_health():
        return {"status": "ok", "version": settings.APP_VERSION}

    return app


app = create_app()
