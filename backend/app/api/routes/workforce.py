"""
Workforce Intelligence — rich analytics for the Workforce Dashboard.
Combines existing analytics + BigQuery hiring funnel + trends + Gemini summary.
"""
from __future__ import annotations
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.cache import cache_get, cache_set
from app.core.config import get_settings
from app.core.logging import get_logger
from app.db.session import get_db
from app.services.analytics import get_analytics
from app.services.bigquery.repository import (
    get_hiring_funnel, get_recruitment_trends, get_bq_status,
)

logger = get_logger(__name__)
settings = get_settings()
router = APIRouter(prefix="/workforce", tags=["workforce"])

CACHE_TTL = 300


@router.get("")
def get_workforce_intelligence(db: Session = Depends(get_db)):
    cached = cache_get("workforce:data")
    if cached:
        return {**cached, "_cached": True}

    analytics = get_analytics(db)
    funnel    = get_hiring_funnel(db)
    trends    = get_recruitment_trends(db)
    bq_status = get_bq_status()

    # Gemini executive summary
    summary = _generate_workforce_summary(analytics)

    data = {
        "analytics": analytics,
        "hiring_funnel": funnel,
        "recruitment_trends": trends,
        "executive_summary": summary,
        "bigquery": bq_status,
        "data_engine": "BigQuery" if bq_status["available"] else "SQLite",
    }
    cache_set("workforce:data", data, CACHE_TTL)
    return data


def _generate_workforce_summary(analytics: dict) -> dict:
    if not settings.ENABLE_GEMINI:
        top_skills = [s["skill"] for s in analytics.get("top_skills", [])[:5]]
        return {
            "summary": (
                f"Your talent pool of {analytics.get('total_candidates',0):,} candidates "
                f"spans {analytics.get('total_jobs',0)} open roles. "
                f"Top skills: {', '.join(top_skills)}."
            ),
            "talent_health": "Data available — enable Gemini for AI insights",
            "ai_generated": False,
        }
    from app.core.gemini import gemini_json
    top_skills = [s["skill"] for s in analytics.get("top_skills", [])[:8]]
    top_industries = [i["industry"] for i in analytics.get("industry_distribution", [])[:5]]
    prompt = f"""You are a Chief People Officer reviewing workforce intelligence data.

Pool: {analytics.get('total_candidates',0):,} candidates
Jobs: {analytics.get('total_jobs',0)}
Avg match score: {analytics.get('avg_similarity_score', 0):.1%}
Top skills: {', '.join(top_skills)}
Top industries: {', '.join(top_industries)}
Match runs: {analytics.get('total_rankings',0):,}

Generate a brief workforce intelligence summary. Return JSON:
{{
  "summary": "3-sentence executive summary",
  "talent_health": "one-line talent pool health assessment",
  "key_insight": "the most important insight from this data",
  "risk": "one key talent risk to watch",
  "opportunity": "one key talent opportunity",
  "ai_generated": true
}}"""
    result = gemini_json(prompt)
    if not result:
        return {"summary": "Workforce summary unavailable", "ai_generated": False}
    result["ai_generated"] = True
    return result
