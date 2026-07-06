"""
Match API routes — production-hardened.

Changes:
  - POST /match now starts matching in a background task and returns immediately
    with a job_id and status URL. For small pools (< 5K candidates) it still
    runs synchronously so the UI gets instant results.
  - GET /match/{job_id} always returns cached/persisted results.
  - Metrics tracked on every match run.
"""
from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.cache import cache_get, cache_set, cache_delete
from app.core.config import get_settings
from app.core.logging import get_logger
from app.core.metrics import measure, increment
from app.db.session import get_db, SessionLocal
from app.models.candidate import Candidate
from app.models.job import Job
from app.models.ranking import Ranking
from app.schemas.schemas import MatchRequest, MatchResponse, RankedCandidate
from app.services.semantic_matching import run_matching, persist_rankings

logger = get_logger(__name__)
settings = get_settings()
router = APIRouter(prefix="/match", tags=["match"])

# Threshold: run synchronously below this, async above
SYNC_THRESHOLD = 5_000


def _enrich_rankings(job: Job, results: list[dict], db: Session) -> MatchResponse:
    """Enrich raw ranking dicts with candidate profile data."""
    cand_ids = [r["candidate_id"] for r in results]
    candidates = {
        c.candidate_id: c
        for c in db.query(Candidate)
        .filter(Candidate.candidate_id.in_(cand_ids))
        .all()
    }
    ranked = []
    for r in results:
        c = candidates.get(r["candidate_id"])
        ranked.append(RankedCandidate(
            rank=r["rank"],
            candidate_id=r["candidate_id"],
            anonymized_name=c.anonymized_name if c else None,
            headline=c.headline if c else None,
            current_title=c.current_title if c else None,
            current_company=c.current_company if c else None,
            location=c.location if c else None,
            years_of_experience=c.years_of_experience if c else None,
            skills=c.skills if c else None,
            similarity_score=r["similarity_score"],
            tfidf_score=r["tfidf_score"],
            semantic_score=r["semantic_score"],
        ))
    return MatchResponse(
        job_id=job.job_id,
        job_title=job.title,
        total_candidates=db.query(func.count(Candidate.id)).scalar() or 0,
        ranked=ranked,
    )


def _run_match_task(job_id: str, top_k: int) -> None:
    """Background task: run matching with its own DB session."""
    db = SessionLocal()
    try:
        job = db.query(Job).filter(Job.job_id == job_id).first()
        if not job:
            return
        with measure("matching.full_pipeline"):
            results = run_matching(db, job, top_k=top_k)
            persist_rankings(db, job_id, results)
        job.status = "matched"
        db.commit()
        # Bust any cached ranking results for this job
        cache_delete(f"match:{job_id}")
        increment("match.completed")
        logger.info("Background match complete: job=%s, results=%d", job_id, len(results))
    except Exception as e:
        logger.exception("Background match failed for job %s: %s", job_id, e)
        increment("match.errors")
    finally:
        db.close()


@router.post("", response_model=MatchResponse)
def match_candidates(
    payload: MatchRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """
    Run the full TF-IDF + Semantic matching pipeline.

    - Small pools (≤ 5K candidates): runs synchronously, returns results immediately.
    - Large pools (> 5K candidates): starts in background, returns accepted status.
      Poll GET /match/{job_id} for results.
    """
    job = db.query(Job).filter(Job.job_id == payload.job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if not job.embedding:
        raise HTTPException(status_code=400, detail="Job embedding not available — resubmit the job")

    candidate_count = db.query(func.count(Candidate.id)).scalar() or 0

    if candidate_count <= SYNC_THRESHOLD:
        # Synchronous path — small pool, instant result
        with measure("match.sync"):
            results = run_matching(db, job, top_k=payload.top_k)
            persist_rankings(db, job.job_id, results)
        job.status = "matched"
        db.commit()
        cache_delete(f"match:{job.job_id}")
        increment("match.sync.completed")
        return _enrich_rankings(job, results, db)
    else:
        # Async path — large pool
        job.status = "processing"
        db.commit()
        background_tasks.add_task(_run_match_task, job.job_id, payload.top_k)
        increment("match.async.queued")
        logger.info(
            "Match queued async (pool=%d > threshold=%d): job=%s",
            candidate_count, SYNC_THRESHOLD, job.job_id,
        )
        # Return whatever rankings exist (from a prior run if any)
        existing = _get_existing_rankings(job, db)
        if existing.ranked:
            return existing
        # No prior results — return empty with status indicator
        return MatchResponse(
            job_id=job.job_id,
            job_title=job.title,
            total_candidates=candidate_count,
            ranked=[],
            # Note: frontend polls /match/{job_id} until results appear
        )


@router.get("/{job_id}", response_model=MatchResponse)
def get_match_results(job_id: str, top_k: int = 100, db: Session = Depends(get_db)):
    """Retrieve persisted rankings for a job (cached 60s)."""
    cache_key = f"match:{job_id}:{top_k}"
    cached = cache_get(cache_key)
    if cached:
        return cached

    job = db.query(Job).filter(Job.job_id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    result = _get_existing_rankings(job, db, top_k)
    cache_set(cache_key, result, ttl_seconds=60)
    return result


def _get_existing_rankings(job: Job, db: Session, top_k: int = 200) -> MatchResponse:
    rankings = (
        db.query(Ranking)
        .filter(Ranking.job_id == job.job_id)
        .order_by(Ranking.rank)
        .limit(top_k)
        .all()
    )
    cand_ids = [r.candidate_id for r in rankings]
    candidates = {
        c.candidate_id: c
        for c in db.query(Candidate)
        .filter(Candidate.candidate_id.in_(cand_ids))
        .all()
    }
    ranked = []
    for r in rankings:
        c = candidates.get(r.candidate_id)
        ranked.append(RankedCandidate(
            rank=r.rank,
            candidate_id=r.candidate_id,
            anonymized_name=c.anonymized_name if c else None,
            headline=c.headline if c else None,
            current_title=c.current_title if c else None,
            current_company=c.current_company if c else None,
            location=c.location if c else None,
            years_of_experience=c.years_of_experience if c else None,
            skills=c.skills if c else None,
            similarity_score=r.similarity_score or 0,
            tfidf_score=r.tfidf_score or 0,
            semantic_score=r.semantic_score or 0,
        ))
    return MatchResponse(
        job_id=job.job_id,
        job_title=job.title,
        total_candidates=db.query(func.count(Candidate.id)).scalar() or 0,
        ranked=ranked,
    )
