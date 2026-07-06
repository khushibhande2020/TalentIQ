"""
Analytics aggregation service.
Uses GPU-accelerated cuDF when available, falls back to pandas.
Results are cached at the route layer — this function always runs fresh.
"""
from __future__ import annotations
from collections import Counter
from sqlalchemy.orm import Session
from sqlalchemy import func, text

from app.core.logging import get_logger
from app.core.metrics import measure
from app.models.candidate import Candidate
from app.models.job import Job
from app.models.ranking import Ranking

logger = get_logger(__name__)


def get_analytics(db: Session) -> dict:
    with measure("analytics.full"):
        total_candidates = db.query(func.count(Candidate.id)).scalar() or 0
        total_jobs = db.query(func.count(Job.id)).scalar() or 0
        total_rankings = db.query(func.count(Ranking.id)).scalar() or 0
        avg_score = db.query(func.avg(Ranking.similarity_score)).scalar()

        top_skills = _top_skills(db)
        experience_distribution = _experience_distribution(db)
        industry_distribution = _industry_distribution(db)
        location_distribution = _location_distribution(db)
        score_distribution = _score_distribution(db)

    return {
        "total_candidates": total_candidates,
        "total_jobs": total_jobs,
        "total_rankings": total_rankings,
        "avg_similarity_score": round(float(avg_score), 4) if avg_score else None,
        "top_skills": top_skills,
        "experience_distribution": experience_distribution,
        "industry_distribution": industry_distribution,
        "location_distribution": location_distribution,
        "score_distribution": score_distribution,
    }


def _top_skills(db: Session, limit: int = 15) -> list[dict]:
    skill_counts: Counter = Counter()
    # Stream in batches to avoid loading all JSON into memory
    batch_size = 2000
    offset = 0
    while True:
        rows = db.query(Candidate.skills).filter(
            Candidate.skills.isnot(None)
        ).limit(batch_size).offset(offset).all()
        if not rows:
            break
        for (skills_json,) in rows:
            if isinstance(skills_json, list):
                for s in skills_json:
                    name = (s.get("name") or "").strip()
                    if name:
                        skill_counts[name] += 1
        offset += batch_size
        if len(rows) < batch_size:
            break
    return [{"skill": k, "count": v} for k, v in skill_counts.most_common(limit)]


def _experience_distribution(db: Session) -> list[dict]:
    buckets: Counter = Counter()
    for (yoe,) in db.query(Candidate.years_of_experience).filter(
        Candidate.years_of_experience.isnot(None)
    ).yield_per(5000):
        buckets[_exp_bucket(yoe)] += 1
    order = ["0-1", "1-3", "3-5", "5-8", "8-12", "12+"]
    return [{"range": b, "count": buckets.get(b, 0)} for b in order]


def _industry_distribution(db: Session, limit: int = 10) -> list[dict]:
    counts: Counter = Counter()
    for (ind,) in db.query(Candidate.current_industry).filter(
        Candidate.current_industry.isnot(None)
    ).yield_per(5000):
        counts[ind] += 1
    return [{"industry": k, "count": v} for k, v in counts.most_common(limit)]


def _location_distribution(db: Session, limit: int = 10) -> list[dict]:
    counts: Counter = Counter()
    for (loc,) in db.query(Candidate.location).filter(
        Candidate.location.isnot(None)
    ).yield_per(5000):
        counts[loc] += 1
    return [{"location": k, "count": v} for k, v in counts.most_common(limit)]


def _score_distribution(db: Session) -> list[dict]:
    bins = [0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]
    labels = [f"{bins[i]:.1f}-{bins[i+1]:.1f}" for i in range(len(bins) - 1)]
    counts = [0] * len(labels)
    for (score,) in db.query(Ranking.similarity_score).filter(
        Ranking.similarity_score.isnot(None)
    ).yield_per(10000):
        for i in range(len(bins) - 1):
            if bins[i] <= score < bins[i + 1]:
                counts[i] += 1
                break
    return [{"range": labels[i], "count": counts[i]} for i in range(len(labels))]


def _exp_bucket(years: float) -> str:
    if years < 1:  return "0-1"
    if years < 3:  return "1-3"
    if years < 5:  return "3-5"
    if years < 8:  return "5-8"
    if years < 12: return "8-12"
    return "12+"
