from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.candidate import Candidate
from app.schemas.schemas import CandidateOut, CandidatePage

router = APIRouter(prefix="/candidates", tags=["candidates"])


@router.get("", response_model=CandidatePage)
def list_candidates(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = Query(None),
    industry: str | None = Query(None),
    location: str | None = Query(None),
    min_exp: float | None = Query(None),
    max_exp: float | None = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(Candidate)
    if search:
        term = f"%{search}%"
        q = q.filter(
            Candidate.anonymized_name.ilike(term)
            | Candidate.headline.ilike(term)
            | Candidate.current_title.ilike(term)
            | Candidate.current_company.ilike(term)
        )
    if industry:
        q = q.filter(Candidate.current_industry.ilike(f"%{industry}%"))
    if location:
        q = q.filter(Candidate.location.ilike(f"%{location}%"))
    if min_exp is not None:
        q = q.filter(Candidate.years_of_experience >= min_exp)
    if max_exp is not None:
        q = q.filter(Candidate.years_of_experience <= max_exp)

    total = q.count()
    items = q.offset((page - 1) * page_size).limit(page_size).all()

    return CandidatePage(total=total, page=page, page_size=page_size, items=items)


@router.get("/{candidate_id}", response_model=CandidateOut)
def get_candidate(candidate_id: str, db: Session = Depends(get_db)):
    candidate = (
        db.query(Candidate)
        .filter(Candidate.candidate_id == candidate_id)
        .first()
    )
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    return candidate
