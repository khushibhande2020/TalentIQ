"""
CSV utilities — export results to CSV (mirrors notebook outputs).
"""

from __future__ import annotations
import csv
import io
from typing import Any

from sqlalchemy.orm import Session

from app.models.candidate import Candidate
from app.models.ranking import Ranking


def export_rankings_csv(db: Session, job_id: str) -> str:
    """
    Export ranked candidates for a job to CSV string.
    Mirrors notebook's ranked_candidates.to_csv("ranked_candidates.csv").
    """
    rankings = (
        db.query(Ranking)
        .filter(Ranking.job_id == job_id)
        .order_by(Ranking.rank)
        .all()
    )

    if not rankings:
        return ""

    cand_ids = [r.candidate_id for r in rankings]
    candidates: dict[str, Candidate] = {
        c.candidate_id: c
        for c in db.query(Candidate).filter(Candidate.candidate_id.in_(cand_ids)).all()
    }

    output = io.StringIO()
    fieldnames = [
        "rank", "candidate_id", "anonymized_name", "headline",
        "current_title", "current_company", "location",
        "years_of_experience", "similarity_score", "tfidf_score", "semantic_score",
    ]
    writer = csv.DictWriter(output, fieldnames=fieldnames)
    writer.writeheader()

    for r in rankings:
        c = candidates.get(r.candidate_id)
        writer.writerow(
            {
                "rank": r.rank,
                "candidate_id": r.candidate_id,
                "anonymized_name": c.anonymized_name if c else "",
                "headline": c.headline if c else "",
                "current_title": c.current_title if c else "",
                "current_company": c.current_company if c else "",
                "location": c.location if c else "",
                "years_of_experience": c.years_of_experience if c else "",
                "similarity_score": round(r.similarity_score or 0, 6),
                "tfidf_score": round(r.tfidf_score or 0, 6),
                "semantic_score": round(r.semantic_score or 0, 6),
            }
        )

    return output.getvalue()
