from __future__ import annotations
import io
import time
from fastapi import APIRouter, Depends, UploadFile, File, BackgroundTasks, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.cache import cached, cache_clear_prefix
from app.core.config import get_settings
from app.core.exceptions import FileTooLargeError, ValidationError, NotFoundError
from app.core.logging import get_logger
from app.core.metrics import measure, increment
from app.db.session import get_db, SessionLocal
from app.schemas.schemas import Analytics
from app.services.analytics import get_analytics as _get_analytics
from app.services.candidate_profiling import bulk_upsert_candidates, iter_jsonl
from app.services.csv_utils import export_rankings_csv

logger = get_logger(__name__)
settings = get_settings()
router = APIRouter(tags=["misc"])


# ── Analytics (cached) ────────────────────────────────────────────────────────

@router.get("/analytics", response_model=Analytics)
def analytics(db: Session = Depends(get_db)):
    with measure("api.analytics"):
        result = cached(
            key="analytics:global",
            ttl_seconds=settings.ANALYTICS_CACHE_TTL_SECONDS,
            fn=lambda: _get_analytics(db),
        )
    return result


# ── Download results ──────────────────────────────────────────────────────────

@router.get("/download-results/{job_id}")
def download_results(job_id: str, db: Session = Depends(get_db)):
    csv_content = export_rankings_csv(db, job_id)
    if not csv_content:
        raise NotFoundError("Rankings", job_id)
    increment("api.downloads")
    return StreamingResponse(
        io.StringIO(csv_content),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="rankings_{job_id}.csv"'},
    )


# ── Candidate JSONL upload ────────────────────────────────────────────────────

@router.post("/upload-candidates", status_code=202)
async def upload_candidates(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
):
    """
    Upload a .jsonl file of candidate records.
    Uses its OWN session in the background task (fixes closed-session bug).
    """
    # Validate file type
    filename = file.filename or ""
    if not filename.endswith(".jsonl"):
        raise ValidationError("Only .jsonl files are supported")

    # Validate file size
    content = await file.read()
    max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    if len(content) > max_bytes:
        raise FileTooLargeError(settings.MAX_UPLOAD_SIZE_MB)

    # Parse records eagerly so we can report count immediately
    try:
        records = list(iter_jsonl(content))
    except Exception as e:
        raise ValidationError(f"Failed to parse JSONL: {e}")

    if not records:
        raise ValidationError("No valid records found in file")

    logger.info("Queuing %d candidates for ingestion (file=%s)", len(records), filename)
    increment("api.uploads")

    def _ingest_with_own_session():
        """Background task with its own DB session — safe after request ends."""
        db = SessionLocal()
        try:
            bulk_upsert_candidates(db, records, generate_embeddings=True)
            # Bust analytics cache after ingestion
            cache_clear_prefix("analytics:")
            logger.info("Background ingestion complete: %d candidates", len(records))
        except Exception as e:
            logger.exception("Background ingestion failed: %s", e)
        finally:
            db.close()

    background_tasks.add_task(_ingest_with_own_session)

    return {
        "message": f"Accepted {len(records)} candidates for processing",
        "count": len(records),
        "note": "Embeddings are being generated in the background. This may take several minutes for large files.",
    }


# ── Cache management ──────────────────────────────────────────────────────────

@router.post("/admin/cache/clear")
def clear_cache():
    """Clear all caches. Useful after bulk data changes."""
    deleted = cache_clear_prefix("")
    return {"cleared": deleted}
