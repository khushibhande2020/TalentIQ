"""
Database session management.
- SQLite: WAL mode enabled, check_same_thread disabled
- PostgreSQL: connection pool with configurable size, recycle, overflow
"""
from __future__ import annotations
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from app.core.config import get_settings
from app.core.logging import get_logger

logger = get_logger(__name__)
settings = get_settings()


def _build_engine():
    url = settings.DATABASE_URL
    if settings.is_sqlite:
        engine = create_engine(
            url,
            connect_args={"check_same_thread": False},
            echo=settings.ENABLE_DEBUG_MODE,
        )
        # Enable WAL mode for SQLite — dramatically improves concurrent reads
        @event.listens_for(engine, "connect")
        def set_sqlite_pragma(dbapi_conn, _):
            cursor = dbapi_conn.cursor()
            cursor.execute("PRAGMA journal_mode=WAL")
            cursor.execute("PRAGMA synchronous=NORMAL")
            cursor.execute("PRAGMA cache_size=-64000")   # 64MB page cache
            cursor.execute("PRAGMA temp_store=MEMORY")
            cursor.close()
        return engine
    else:
        # PostgreSQL / MySQL path
        return create_engine(
            url,
            pool_size=settings.DB_POOL_SIZE,
            max_overflow=settings.DB_MAX_OVERFLOW,
            pool_timeout=settings.DB_POOL_TIMEOUT,
            pool_recycle=settings.DB_POOL_RECYCLE,
            pool_pre_ping=True,          # detect stale connections
            echo=settings.ENABLE_DEBUG_MODE,
        )


engine = _build_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    from app.models import candidate, job, ranking  # noqa: F401
    Base.metadata.create_all(bind=engine)
    _create_indexes()
    logger.info("Database initialised (%s)", "SQLite" if settings.is_sqlite else "PostgreSQL")


def _create_indexes() -> None:
    """
    Create composite indexes for common query patterns.
    Safe to call repeatedly — uses IF NOT EXISTS.
    """
    if not settings.is_sqlite:
        return   # PostgreSQL handles this via SQLAlchemy index directives
    indexes = [
        "CREATE INDEX IF NOT EXISTS ix_candidates_industry_exp ON candidates(current_industry, years_of_experience)",
        "CREATE INDEX IF NOT EXISTS ix_candidates_location ON candidates(location)",
        "CREATE INDEX IF NOT EXISTS ix_rankings_job_rank ON rankings(job_id, rank)",
        "CREATE INDEX IF NOT EXISTS ix_rankings_score ON rankings(job_id, similarity_score DESC)",
    ]
    with engine.connect() as conn:
        for ddl in indexes:
            try:
                conn.execute(text(ddl))
            except Exception as e:
                logger.debug("Index skipped: %s", e)
        conn.commit()
    logger.info("Database indexes verified")
