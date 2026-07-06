"""
BigQuery repository layer.
Each method tries BigQuery first; falls back to SQLAlchemy transparently.
Callers never need to know which backend is active.
"""
from __future__ import annotations
from typing import Any
from sqlalchemy.orm import Session
from sqlalchemy import func, text

from app.core.config import get_settings
from app.core.logging import get_logger
from app.core.metrics import measure
from app.services.bigquery.client import bq_query, is_bigquery_available, upload_dataframe_to_bq

logger = get_logger(__name__)
settings = get_settings()

_DS = settings.BIGQUERY_DATASET
_PRJ = settings.GOOGLE_CLOUD_PROJECT


def sync_candidates_to_bigquery(db: Session) -> dict[str, Any]:
    """Export candidates table to BigQuery for analytics."""
    if not is_bigquery_available():
        return {"status": "skipped", "reason": "BigQuery not configured"}
    try:
        import pandas as pd
        from app.models.candidate import Candidate
        rows = db.query(
            Candidate.candidate_id, Candidate.anonymized_name,
            Candidate.current_title, Candidate.current_company,
            Candidate.current_industry, Candidate.location, Candidate.country,
            Candidate.years_of_experience, Candidate.created_at,
        ).limit(100_000).all()
        df = pd.DataFrame(rows, columns=[
            "candidate_id", "anonymized_name", "current_title", "current_company",
            "current_industry", "location", "country", "years_of_experience", "created_at",
        ])
        success = upload_dataframe_to_bq(df, "candidates")
        return {"status": "ok" if success else "error", "rows_synced": len(df)}
    except Exception as e:
        logger.error("Candidate sync to BigQuery failed: %s", e)
        return {"status": "error", "error": str(e)}


def sync_rankings_to_bigquery(db: Session) -> dict[str, Any]:
    """Export rankings table to BigQuery."""
    if not is_bigquery_available():
        return {"status": "skipped", "reason": "BigQuery not configured"}
    try:
        import pandas as pd
        from app.models.ranking import Ranking
        rows = db.query(
            Ranking.job_id, Ranking.candidate_id, Ranking.rank,
            Ranking.similarity_score, Ranking.tfidf_score,
            Ranking.semantic_score, Ranking.created_at,
        ).limit(500_000).all()
        df = pd.DataFrame(rows, columns=[
            "job_id", "candidate_id", "rank", "similarity_score",
            "tfidf_score", "semantic_score", "created_at",
        ])
        success = upload_dataframe_to_bq(df, "rankings")
        return {"status": "ok" if success else "error", "rows_synced": len(df)}
    except Exception as e:
        return {"status": "error", "error": str(e)}


def get_hiring_funnel(db: Session) -> list[dict[str, Any]]:
    """
    Hiring funnel stages.
    BigQuery: efficient aggregation SQL.
    SQLite fallback: SQLAlchemy aggregate queries.
    """
    if is_bigquery_available():
        try:
            with measure("bigquery.hiring_funnel"):
                sql = f"""
                SELECT
                  COUNT(DISTINCT c.candidate_id) AS total_pool,
                  COUNT(DISTINCT r.candidate_id) AS screened,
                  COUNTIF(r.similarity_score >= 0.4) AS qualified,
                  COUNTIF(r.similarity_score >= 0.6) AS shortlisted,
                  COUNTIF(r.rank <= 10) AS top_10
                FROM `{_PRJ}.{_DS}.candidates` c
                LEFT JOIN `{_PRJ}.{_DS}.rankings` r USING (candidate_id)
                """
                rows = bq_query(sql)
            if rows:
                r = rows[0]
                return [
                    {"stage": "Total Pool",  "count": int(r.get("total_pool", 0)),  "color": "#6366f1"},
                    {"stage": "Screened",    "count": int(r.get("screened", 0)),    "color": "#8b5cf6"},
                    {"stage": "Qualified",   "count": int(r.get("qualified", 0)),   "color": "#06b6d4"},
                    {"stage": "Shortlisted", "count": int(r.get("shortlisted", 0)), "color": "#10b981"},
                    {"stage": "Top 10",      "count": int(r.get("top_10", 0)),      "color": "#f59e0b"},
                ]
        except Exception as e:
            logger.warning("BigQuery funnel query failed, using SQLite: %s", e)

    # SQLite fallback
    from app.models.candidate import Candidate
    from app.models.ranking import Ranking
    total      = db.query(func.count(Candidate.id)).scalar() or 0
    screened   = db.query(func.count(Ranking.id.distinct())).scalar() or 0
    qualified  = db.query(func.count(Ranking.id)).filter(Ranking.similarity_score >= 0.4).scalar() or 0
    shortlisted= db.query(func.count(Ranking.id)).filter(Ranking.similarity_score >= 0.6).scalar() or 0
    top_10     = db.query(func.count(Ranking.id)).filter(Ranking.rank <= 10).scalar() or 0
    return [
        {"stage": "Total Pool",  "count": total,       "color": "#6366f1"},
        {"stage": "Screened",    "count": screened,    "color": "#8b5cf6"},
        {"stage": "Qualified",   "count": qualified,   "color": "#06b6d4"},
        {"stage": "Shortlisted", "count": shortlisted, "color": "#10b981"},
        {"stage": "Top 10",      "count": top_10,      "color": "#f59e0b"},
    ]


def get_recruitment_trends(db: Session) -> list[dict[str, Any]]:
    """Monthly candidate ingestion trend (last 6 months)."""
    if is_bigquery_available():
        try:
            with measure("bigquery.recruitment_trends"):
                sql = f"""
                SELECT
                  FORMAT_DATE('%Y-%m', DATE(created_at)) AS month,
                  COUNT(*) AS candidates_added
                FROM `{_PRJ}.{_DS}.candidates`
                WHERE created_at >= DATE_SUB(CURRENT_DATE(), INTERVAL 6 MONTH)
                GROUP BY month ORDER BY month
                """
                rows = bq_query(sql)
            return [{"month": r["month"], "candidates": r["candidates_added"]} for r in rows]
        except Exception as e:
            logger.warning("BigQuery trends failed, using SQLite: %s", e)

    # SQLite fallback
    try:
        rows = db.execute(text("""
            SELECT strftime('%Y-%m', created_at) AS month, COUNT(*) AS cnt
            FROM candidates
            WHERE created_at IS NOT NULL
              AND created_at >= date('now', '-6 months')
            GROUP BY month ORDER BY month DESC LIMIT 6
        """)).fetchall()
        return [{"month": r[0], "candidates": r[1]} for r in reversed(rows)]
    except Exception as e:
        logger.warning("Trend query failed: %s", e)
        return []


def get_bq_status() -> dict[str, Any]:
    """Return BigQuery configuration and availability status."""
    return {
        "enabled":   settings.ENABLE_BIGQUERY,
        "available": is_bigquery_available(),
        "project":   settings.GOOGLE_CLOUD_PROJECT or "not configured",
        "dataset":   settings.BIGQUERY_DATASET,
        "fallback":  "SQLite (SQLAlchemy)" if not is_bigquery_available() else None,
    }
