"""
Evaluation API endpoints.

GET  /api/v1/evaluation/run      — run full evaluation suite (cached 10 min)
GET  /api/v1/evaluation/status   — last run status + summary KPIs
GET  /api/v1/evaluation/metrics  — detailed per-query IR metrics
GET  /api/v1/evaluation/methodology — methodology documentation
POST /api/v1/evaluation/run      — force re-run (bypasses cache)
"""
from __future__ import annotations
import time
from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException
from sqlalchemy.orm import Session

from app.core.cache import cache_get, cache_set, cache_delete
from app.core.config import get_settings
from app.core.exceptions import ServiceUnavailableError
from app.core.logging import get_logger
from app.core.metrics import measure, increment
from app.db.session import get_db, SessionLocal
from app.services.evaluation.engine import run_full_evaluation
from app.services.evaluation.validation_dataset import VALIDATION_QUERIES

logger = get_logger(__name__)
settings = get_settings()
router = APIRouter(prefix="/evaluation", tags=["evaluation"])

CACHE_KEY = "evaluation:last_report"
CACHE_TTL = 600       # 10 minutes — evaluation is expensive
STATUS_KEY = "evaluation:status"


def _require_evaluation():
    if not settings.ENABLE_EVALUATION:
        raise ServiceUnavailableError("Evaluation framework (set ENABLE_EVALUATION=true in .env)")


def _run_and_cache(db: Session) -> dict:
    cache_set(STATUS_KEY, {"status": "running", "started_at": time.strftime("%Y-%m-%dT%H:%M:%SZ")}, ttl_seconds=600)
    try:
        with measure("eval.full_run"):
            report = run_full_evaluation(db)
        cache_set(CACHE_KEY, report, ttl_seconds=CACHE_TTL)
        cache_set(STATUS_KEY, {
            "status": "ready",
            "last_run": report.get("evaluated_at"),
            "total_eval_time_ms": report.get("total_eval_time_ms"),
            "num_queries": report.get("ir_metrics", {}).get("num_queries_evaluated", 0),
        }, ttl_seconds=CACHE_TTL + 60)
        increment("eval.full_run.success")
        return report
    except Exception as e:
        cache_set(STATUS_KEY, {"status": "error", "error": str(e)}, ttl_seconds=120)
        raise


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("/run")
def get_or_run_evaluation(db: Session = Depends(get_db)):
    """
    Returns cached evaluation report if fresh (< 10 min old).
    Runs evaluation synchronously if no cached result exists.
    For large pools this takes 60–120 seconds — use POST to trigger async.
    """
    _require_evaluation()
    cached = cache_get(CACHE_KEY)
    if cached:
        return {**cached, "_cached": True}
    return _run_and_cache(db)


@router.post("/run")
def force_run_evaluation(
    background_tasks: BackgroundTasks,
):
    """
    Force a fresh evaluation run in the background.
    Poll GET /evaluation/status to track progress, then GET /evaluation/run for results.
    """
    _require_evaluation()
    cache_delete(CACHE_KEY)

    def _bg_run():
        db = SessionLocal()
        try:
            _run_and_cache(db)
        except Exception as e:
            logger.exception("Background evaluation failed: %s", e)
        finally:
            db.close()

    background_tasks.add_task(_bg_run)
    cache_set(STATUS_KEY, {
        "status": "running",
        "started_at": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "note": "Poll GET /api/v1/evaluation/status to track progress",
    }, ttl_seconds=600)

    return {
        "message": "Evaluation started in background",
        "poll_url": "/api/v1/evaluation/status",
        "result_url": "/api/v1/evaluation/run",
    }


@router.get("/status")
def evaluation_status():
    """Quick status check — does not trigger a run."""
    _require_evaluation()
    status = cache_get(STATUS_KEY)
    if not status:
        return {"status": "never_run", "note": "POST /api/v1/evaluation/run to start"}
    return status


@router.get("/metrics")
def evaluation_metrics(db: Session = Depends(get_db)):
    """
    Detailed per-query IR metrics.
    Runs evaluation if no cached result exists.
    """
    _require_evaluation()
    cached = cache_get(CACHE_KEY)
    if not cached:
        cached = _run_and_cache(db)

    return {
        "ir_metrics": cached.get("ir_metrics", {}),
        "per_query_results": cached.get("per_query_results", []),
        "parsing_quality": cached.get("parsing_quality", {}),
        "performance": cached.get("performance", {}),
        "gemini": cached.get("gemini", {}),
        "gpu_benchmark": cached.get("gpu_benchmark", {}),
        "evaluated_at": cached.get("evaluated_at"),
        "candidate_pool_size": cached.get("candidate_pool_size"),
    }


@router.get("/methodology")
def evaluation_methodology():
    """
    Returns full methodology documentation — shown on the dashboard.
    No computation required.
    """
    return {
        "framework": "TalentIQ AI Evaluation Framework v1.0",
        "ground_truth_approach": "proxy_relevance",
        "description": (
            "When human-annotated relevance labels are unavailable, we construct proxy "
            "ground-truth using a principled multi-signal relevance model. "
            "This approach is standard in Information Retrieval research."
        ),
        "relevance_formula": {
            "formula": "score = 0.6 × skill_overlap + 0.2 × experience_fit + 0.2 × title_similarity",
            "skill_overlap": "Fuzzy substring matching: |candidate_skills ∩ job_skills| / |job_skills|",
            "experience_fit": "Gaussian centered on required experience range midpoint",
            "title_similarity": "Token overlap between candidate title and job title",
        },
        "graded_relevance": {
            "grade_3": "Highly relevant (score ≥ 0.60)",
            "grade_2": "Relevant (score ≥ 0.40) — threshold for binary metrics",
            "grade_1": "Partially relevant (score ≥ 0.20)",
            "grade_0": "Not relevant (score < 0.20)",
        },
        "metrics_explained": {
            "Precision@K": "Fraction of top-K results that are relevant. Higher = fewer false positives.",
            "Recall@K": "Fraction of all relevant candidates found in top-K. Higher = better coverage.",
            "NDCG@K": "Normalized Discounted Cumulative Gain. Rewards relevant results ranked higher. Range [0,1].",
            "MRR": "Mean Reciprocal Rank. How high the first relevant result appears on average.",
            "MAP": "Mean Average Precision. Area under the precision-recall curve across queries.",
            "Hit Rate@K": "Binary: was at least one relevant candidate in the top-K results?",
        },
        "validation_queries": [
            {"id": q["query_id"], "title": q["title"]}
            for q in VALIDATION_QUERIES
        ],
        "limitations": [
            "Proxy labels are approximations — skill synonym matching may miss some equivalences",
            "Metrics should be interpreted relatively (vs baseline), not as absolute scores",
            "Ground truth improves significantly once human recruiter feedback is collected",
        ],
        "references": [
            "Manning, Raghavan & Schütze (2008) — Introduction to Information Retrieval",
            "Järvelin & Kekäläinen (2002) — Cumulated gain-based evaluation (nDCG)",
            "Voorhees (2000) — The TREC-8 Question Answering Track Report (MRR)",
        ],
    }
