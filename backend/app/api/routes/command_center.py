"""
Command Center — AI Hiring Command Center endpoint.
Aggregates: KPIs, AI briefing, health score, alerts, recommendations, GPU stats.
Cached 5 minutes. Gemini generates briefing text.
"""
from __future__ import annotations
import time
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.cache import cache_get, cache_set
from app.core.config import get_settings
from app.core.gemini import gemini_json
from app.core.gpu_analytics import get_dataframe_engine, GPU_AVAILABLE
from app.core.logging import get_logger
from app.core.metrics import get_metrics
from app.db.session import get_db
from app.models.candidate import Candidate
from app.models.job import Job
from app.models.ranking import Ranking
from app.services.analytics import get_analytics
from app.services.bigquery.repository import get_hiring_funnel, get_bq_status

logger = get_logger(__name__)
settings = get_settings()
router = APIRouter(prefix="/command-center", tags=["command-center"])

CACHE_KEY = "command_center:data"
CACHE_TTL = 300


def _compute_health_score(
    total_candidates: int,
    total_jobs: int,
    avg_score: float | None,
    qualified_pct: float,
) -> dict:
    """Compute a 0–100 hiring health score from platform metrics."""
    score = 0
    breakdown = {}

    # Pool size (max 25 pts)
    pool_pts = min(total_candidates / 1000 * 25, 25)
    breakdown["pool_size"] = round(pool_pts, 1)
    score += pool_pts

    # Active jobs (max 20 pts)
    job_pts = min(total_jobs * 5, 20)
    breakdown["active_jobs"] = round(job_pts, 1)
    score += job_pts

    # Match quality (max 30 pts)
    if avg_score:
        quality_pts = avg_score * 30
        breakdown["match_quality"] = round(quality_pts, 1)
        score += quality_pts

    # Qualified candidate rate (max 25 pts)
    qual_pts = qualified_pct * 25
    breakdown["qualified_rate"] = round(qual_pts, 1)
    score += qual_pts

    total = min(round(score), 100)
    label = (
        "Excellent" if total >= 80 else
        "Good"      if total >= 60 else
        "Fair"      if total >= 40 else
        "Poor"
    )
    return {"score": total, "label": label, "breakdown": breakdown}


def _build_alerts(
    total_candidates: int,
    total_jobs: int,
    avg_score: float | None,
) -> list[dict]:
    alerts = []
    if total_candidates == 0:
        alerts.append({"level": "critical", "message": "No candidates in pool. Upload a JSONL file to get started.", "action": "Upload Candidates"})
    elif total_candidates < 100:
        alerts.append({"level": "warning", "message": f"Small candidate pool ({total_candidates}). Matching quality improves with more candidates.", "action": "Import More"})
    if total_jobs == 0:
        alerts.append({"level": "info", "message": "No jobs posted yet. Upload a job description to begin matching.", "action": "Upload Job"})
    if avg_score and avg_score < 0.3:
        alerts.append({"level": "warning", "message": "Average match scores are low. Consider broadening job requirements or expanding the candidate pool.", "action": "View Analytics"})
    if not settings.ENABLE_GEMINI:
        alerts.append({"level": "info", "message": "Gemini AI is disabled. Add GEMINI_API_KEY to .env for AI-powered insights.", "action": "Settings"})
    return alerts


@router.get("")
def get_command_center(db: Session = Depends(get_db)):
    cached = cache_get(CACHE_KEY)
    if cached:
        return {**cached, "_cached": True}

    # Core metrics
    total_candidates = db.query(func.count(Candidate.id)).scalar() or 0
    total_jobs       = db.query(func.count(Job.id)).scalar() or 0
    total_rankings   = db.query(func.count(Ranking.id)).scalar() or 0
    avg_score        = db.query(func.avg(Ranking.similarity_score)).scalar()
    matched_jobs     = db.query(func.count(Job.id)).filter(Job.status == "matched").scalar() or 0

    # Qualified candidates (score >= 0.4)
    qualified_count  = db.query(func.count(Ranking.id)).filter(Ranking.similarity_score >= 0.4).scalar() or 0
    qualified_pct    = (qualified_count / total_rankings) if total_rankings > 0 else 0.0

    # Health score
    health = _compute_health_score(total_candidates, total_jobs, avg_score, qualified_pct)

    # Recent jobs
    recent_jobs = db.query(Job).order_by(Job.created_at.desc()).limit(5).all()
    recent_jobs_data = [
        {"job_id": j.job_id, "title": j.title or "(Untitled)", "status": j.status,
         "created_at": j.created_at.isoformat() if j.created_at else None}
        for j in recent_jobs
    ]

    # Top ranked candidates across all jobs
    top_matches = (
        db.query(Ranking, Candidate)
        .join(Candidate, Ranking.candidate_id == Candidate.candidate_id)
        .order_by(Ranking.similarity_score.desc())
        .limit(5)
        .all()
    )
    top_matches_data = [
        {
            "candidate_id": c.candidate_id,
            "name": c.anonymized_name or c.candidate_id,
            "title": c.current_title,
            "job_id": r.job_id,
            "score": round(r.similarity_score or 0, 3),
        }
        for r, c in top_matches
    ]

    # Hiring funnel
    funnel = get_hiring_funnel(db)

    # GPU info
    gpu_info = {
        "available": GPU_AVAILABLE,
        "engine": get_dataframe_engine(),
        "acceleration": settings.ENABLE_GPU_ACCELERATION,
    }

    # System metrics
    sys_metrics = get_metrics()
    api_calls = sum(v for k, v in sys_metrics.get("counters", {}).items() if k.startswith("http."))

    # Alerts
    alerts = _build_alerts(total_candidates, total_jobs, avg_score)

    # Gemini daily briefing
    briefing = _generate_briefing(total_candidates, total_jobs, avg_score, health, alerts)

    # AI recommendations
    recommendations = _generate_recommendations(
        total_candidates, total_jobs, avg_score, qualified_pct, health["score"]
    )

    data = {
        "kpis": {
            "total_candidates": total_candidates,
            "total_jobs": total_jobs,
            "total_rankings": total_rankings,
            "matched_jobs": matched_jobs,
            "avg_match_score": round(float(avg_score), 3) if avg_score else None,
            "qualified_candidates": qualified_count,
            "qualified_pct": round(qualified_pct * 100, 1),
            "api_calls_today": api_calls,
        },
        "health_score": health,
        "alerts": alerts,
        "recent_jobs": recent_jobs_data,
        "top_matches": top_matches_data,
        "hiring_funnel": funnel,
        "gpu": gpu_info,
        "bigquery": get_bq_status(),
        "ai_briefing": briefing,
        "recommendations": recommendations,
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
    }

    cache_set(CACHE_KEY, data, CACHE_TTL)
    return data


def _generate_briefing(
    candidates: int, jobs: int, avg_score: float | None,
    health: dict, alerts: list,
) -> dict:
    if not settings.ENABLE_GEMINI:
        return {
            "headline": f"Hiring Platform — {candidates:,} candidates, {jobs} jobs active",
            "summary": "Enable Gemini (ENABLE_GEMINI=true + GEMINI_API_KEY) for AI-generated daily briefings.",
            "ai_generated": False,
        }
    prompt = f"""You are a Chief People Officer giving a daily hiring briefing.

Platform Status:
- Candidates in pool: {candidates:,}
- Active jobs: {jobs}
- Average match score: {f'{avg_score:.1%}' if avg_score else 'N/A'}
- Platform health score: {health['score']}/100 ({health['label']})
- Active alerts: {len(alerts)}

Write a concise, professional daily briefing. Return JSON:
{{
  "headline": "one headline sentence (max 15 words)",
  "summary": "2-3 sentence executive summary of hiring status",
  "priority_action": "the single most important action to take today",
  "sentiment": "positive|neutral|concerning",
  "ai_generated": true
}}"""
    result = gemini_json(prompt)
    if not result:
        return {"headline": "Daily Briefing", "summary": "AI briefing unavailable.", "ai_generated": False}
    result["ai_generated"] = True
    return result


def _generate_recommendations(
    candidates: int, jobs: int, avg_score: float | None,
    qualified_pct: float, health_score: int,
) -> list[dict]:
    if not settings.ENABLE_GEMINI:
        recs = []
        if candidates < 500:
            recs.append({"priority": "high", "category": "Data", "action": "Import more candidates", "detail": "Larger pools improve match quality significantly."})
        if jobs == 0:
            recs.append({"priority": "high", "category": "Workflow", "action": "Upload your first job description", "detail": "Start matching by posting a job."})
        if avg_score and avg_score < 0.4:
            recs.append({"priority": "medium", "category": "Quality", "action": "Review job descriptions", "detail": "More specific JDs improve match precision."})
        return recs or [{"priority": "low", "category": "Platform", "action": "Enable Gemini for AI recommendations", "detail": "Add GEMINI_API_KEY to .env"}]

    avg_score_display = f"{avg_score:.1%}" if avg_score else "N/A"
    prompt = f"""You are a hiring strategy advisor. Generate 3 specific, actionable recommendations.

Data: {candidates:,} candidates, {jobs} jobs, avg score {avg_score_display},
qualified rate {qualified_pct:.1%}, health score {health_score}/100.

Return JSON array of exactly 3 items:
[
  {{
    "priority": "high|medium|low",
    "category": "Data|Matching|Workflow|Strategy",
    "action": "short action title",
    "detail": "one sentence explanation"
  }}
]"""
    result = gemini_json(prompt)
    if isinstance(result, list):
        return result[:3]
    return []
