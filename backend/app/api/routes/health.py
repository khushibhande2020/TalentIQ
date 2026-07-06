"""
Health check endpoints.
  GET /health              — liveness (always 200 if process running)
  GET /health/ready        — readiness (DB must be up)
  GET /health/database     — DB connectivity
  GET /health/gemini       — Gemini reachability
  GET /health/bigquery     — BigQuery connectivity
  GET /health/gpu          — CUDA/cuDF availability
  GET /health/metrics      — in-process performance metrics
  GET /health/services     — all feature flags + env summary
"""
from __future__ import annotations
import time
from fastapi import APIRouter
from sqlalchemy import text

from app.core.cache import cached
from app.core.config import get_settings
from app.core.logging import get_logger
from app.core.metrics import get_metrics
from app.db.session import engine

logger = get_logger(__name__)
settings = get_settings()
router = APIRouter(prefix="/health", tags=["health"])


def _check_database() -> dict:
    start = time.perf_counter()
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        from sqlalchemy import inspect
        tables = inspect(engine).get_table_names()
        return {
            "status": "ok",
            "engine": "SQLite" if settings.is_sqlite else "PostgreSQL",
            "tables": tables,
            "latency_ms": round((time.perf_counter() - start) * 1000, 2),
        }
    except Exception as e:
        return {"status": "error", "detail": str(e)}


def _check_gemini() -> dict:
    if not settings.ENABLE_GEMINI:
        return {"status": "disabled", "detail": "Set ENABLE_GEMINI=true in .env"}
    if not settings.GEMINI_API_KEY:
        return {
            "status": "not_configured",
            "detail": "GEMINI_API_KEY not set. Add it to backend/.env",
        }
    start = time.perf_counter()
    try:
        import google.generativeai as genai  # type: ignore
        genai.configure(api_key=settings.GEMINI_API_KEY)
        m = genai.GenerativeModel(settings.GEMINI_MODEL)
        m.generate_content(
            "ping",
            generation_config={"candidate_count": 1, "max_output_tokens": 5},
            request_options={"timeout": 10},
        )
        return {
            "status": "ok",
            "model": settings.GEMINI_MODEL,
            "latency_ms": round((time.perf_counter() - start) * 1000, 2),
        }
    except ImportError:
        return {"status": "not_installed", "detail": "pip install google-generativeai"}
    except Exception as e:
        return {"status": "error", "detail": str(e)[:200]}


def _check_bigquery() -> dict:
    if not settings.ENABLE_BIGQUERY:
        return {"status": "disabled", "detail": "Set ENABLE_BIGQUERY=true in .env"}
    if not settings.GOOGLE_CLOUD_PROJECT:
        return {"status": "not_configured", "detail": "GOOGLE_CLOUD_PROJECT not set"}
    start = time.perf_counter()
    try:
        from google.cloud import bigquery  # type: ignore
        client = bigquery.Client(project=settings.GOOGLE_CLOUD_PROJECT)
        client.query("SELECT 1").result()
        return {
            "status": "ok",
            "project": settings.GOOGLE_CLOUD_PROJECT,
            "dataset": settings.BIGQUERY_DATASET,
            "latency_ms": round((time.perf_counter() - start) * 1000, 2),
        }
    except ImportError:
        return {"status": "not_installed", "detail": "pip install google-cloud-bigquery"}
    except Exception as e:
        return {"status": "error", "detail": str(e)[:200]}


def _check_gpu() -> dict:
    if not settings.ENABLE_GPU_ACCELERATION:
        return {
            "status": "disabled",
            "detail": "Set ENABLE_GPU_ACCELERATION=true + install NVIDIA RAPIDS cuDF",
        }
    try:
        import cudf    # type: ignore
        import cupy as cp  # type: ignore
        device = cp.cuda.Device(0)
        return {
            "status": "ok",
            "cudf_version": cudf.__version__,
            "device_id": int(device),
        }
    except ImportError:
        return {
            "status": "not_available",
            "detail": "cuDF/cuPy not installed — using pandas CPU fallback (this is fine)",
        }
    except Exception as e:
        return {"status": "error", "detail": str(e)[:200]}


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("")
def liveness():
    """Liveness probe — always 200."""
    return {"status": "ok", "version": settings.APP_VERSION, "env": settings.ENVIRONMENT}


@router.get("/ready")
def readiness():
    """Readiness probe — checks DB."""
    db_status = _check_database()
    return {
        "status": "ready" if db_status.get("status") == "ok" else "not_ready",
        "database": db_status,
    }


@router.get("/database")
def database_health():
    return cached("health:database", settings.HEALTH_CACHE_TTL_SECONDS, _check_database)


@router.get("/gemini")
def gemini_health():
    return cached("health:gemini", settings.HEALTH_CACHE_TTL_SECONDS, _check_gemini)


@router.get("/bigquery")
def bigquery_health():
    return cached("health:bigquery", settings.HEALTH_CACHE_TTL_SECONDS, _check_bigquery)


@router.get("/gpu")
def gpu_health():
    return cached("health:gpu", settings.HEALTH_CACHE_TTL_SECONDS, _check_gpu)


@router.get("/metrics")
def metrics():
    return get_metrics()


@router.get("/services")
def services():
    """All feature flags + key environment info."""
    return {
        # Feature flags
        "gemini": settings.ENABLE_GEMINI,
        "gemini_key_set": bool(settings.GEMINI_API_KEY),
        "gemini_ready": settings.gemini_enabled,
        "bigquery": settings.ENABLE_BIGQUERY,
        "bigquery_project_set": bool(settings.GOOGLE_CLOUD_PROJECT),
        "gpu_acceleration": settings.ENABLE_GPU_ACCELERATION,
        "multi_agent": settings.ENABLE_MULTI_AGENT,
        "analytics": settings.ENABLE_ANALYTICS,
        "reports": settings.ENABLE_REPORTS,
        "executive_reports": settings.ENABLE_EXECUTIVE_REPORTS,
        "ai_copilot": settings.ENABLE_AI_COPILOT,
        "strategy_simulator": settings.ENABLE_STRATEGY_SIMULATOR,
        "evaluation": settings.ENABLE_EVALUATION,
        "rate_limiting": settings.ENABLE_RATE_LIMITING,
        # Environment
        "environment": settings.ENVIRONMENT,
        "database_engine": "SQLite" if settings.is_sqlite else "PostgreSQL",
        "embedding_model": settings.SENTENCE_TRANSFORMER_MODEL,
        "gemini_model": settings.GEMINI_MODEL,
    }
