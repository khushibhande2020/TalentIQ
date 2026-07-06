"""
Centralized configuration.
Environment variable loading precedence (highest → lowest):
  1. Actual OS environment variables  (Cloud Run, Docker --env-flag)
  2. .env file in working directory   (local dev)
  3. Defaults defined in this class

IMPORTANT: Call get_settings() after process start — never at module import time.
The lru_cache is intentionally kept so the same object is reused across the app,
but it can be cleared in tests via get_settings.cache_clear().
"""
from __future__ import annotations
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        # OS env vars always win over .env values
        env_nested_delimiter="__",
        # Don't crash on extra keys in .env
        extra="ignore",
        # Case-insensitive matching (ENABLE_GEMINI = enable_gemini = Enable_Gemini)
        case_sensitive=False,
    )

    # ── Application ───────────────────────────────────────────────────────────
    APP_NAME: str = "TalentIQ AI"
    APP_VERSION: str = "2.0.0"
    ENVIRONMENT: str = "development"
    LOG_LEVEL: str = "INFO"
    ENABLE_DEBUG_MODE: bool = False
    ENABLE_REQUEST_LOGGING: bool = True
    SLOW_REQUEST_THRESHOLD_MS: float = 2000.0

    # ── Database ──────────────────────────────────────────────────────────────
    DATABASE_URL: str = "sqlite:///./talentiq.db"
    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 20
    DB_POOL_TIMEOUT: int = 30
    DB_POOL_RECYCLE: int = 1800

    # ── Feature Flags ─────────────────────────────────────────────────────────
    ENABLE_GEMINI: bool = False
    ENABLE_BIGQUERY: bool = False
    ENABLE_GPU_ACCELERATION: bool = False
    ENABLE_MULTI_AGENT: bool = False
    ENABLE_ANALYTICS: bool = True
    ENABLE_REPORTS: bool = True
    ENABLE_EXECUTIVE_REPORTS: bool = True
    ENABLE_AI_COPILOT: bool = True
    ENABLE_STRATEGY_SIMULATOR: bool = True
    ENABLE_BENCHMARKS: bool = True
    ENABLE_RATE_LIMITING: bool = False
    ENABLE_EVALUATION: bool = True

    # ── Google Gemini ─────────────────────────────────────────────────────────
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-1.5-flash"
    GEMINI_PRO_MODEL: str = "gemini-1.5-pro"
    GEMINI_TIMEOUT_SECONDS: int = 60
    GEMINI_MAX_RETRIES: int = 2

    # ── Google BigQuery ───────────────────────────────────────────────────────
    GOOGLE_CLOUD_PROJECT: str = ""
    BIGQUERY_DATASET: str = "talentiq"
    GOOGLE_APPLICATION_CREDENTIALS: str = ""

    # ── AI / ML (notebook-preserved) ──────────────────────────────────────────
    SENTENCE_TRANSFORMER_MODEL: str = "all-MiniLM-L6-v2"
    SPACY_MODEL: str = "en_core_web_sm"
    EMBEDDING_BATCH_SIZE: int = 64
    TFIDF_MAX_FEATURES: int = 5000
    TOP_K_CANDIDATES: int = 200

    # ── Agent settings ────────────────────────────────────────────────────────
    AGENT_MAX_RETRIES: int = 2
    AGENT_TIMEOUT_SECONDS: int = 60

    # ── Caching ───────────────────────────────────────────────────────────────
    ANALYTICS_CACHE_TTL_SECONDS: int = 300
    HEALTH_CACHE_TTL_SECONDS: int = 30

    # ── File uploads ──────────────────────────────────────────────────────────
    MAX_UPLOAD_SIZE_MB: int = 50

    # ── Security ──────────────────────────────────────────────────────────────
    SECRET_KEY: str = "change-me-in-production"
    REQUIRE_API_KEY: bool = False

    # ── CORS ──────────────────────────────────────────────────────────────────
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:3000", "*"]
    CORS_ALLOW_CREDENTIALS: bool = True

    # ── Rate limiting ─────────────────────────────────────────────────────────
    RATE_LIMIT_AI_RPM: int = 20
    RATE_LIMIT_MATCH_RPM: int = 10
    RATE_LIMIT_UPLOAD_RPM: int = 5

    # ── Computed properties ───────────────────────────────────────────────────
    @property
    def is_sqlite(self) -> bool:
        return self.DATABASE_URL.startswith("sqlite")

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"

    @property
    def gemini_enabled(self) -> bool:
        """True only when both flag and key are present."""
        return self.ENABLE_GEMINI and bool(self.GEMINI_API_KEY)


@lru_cache()
def get_settings() -> Settings:
    return Settings()
