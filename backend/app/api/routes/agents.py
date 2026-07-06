"""
Multi-Agent API endpoints.
All routes check ENABLE_MULTI_AGENT feature flag.
Rate-limited: RATE_LIMIT_AI_RPM requests/minute.
"""
from __future__ import annotations
from typing import Any
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.exceptions import ServiceUnavailableError
from app.core.logging import get_logger
from app.core.metrics import measure
from app.db.session import get_db
from app.models.candidate import Candidate
from app.models.job import Job
from app.models.ranking import Ranking
from app.services.analytics import get_analytics

logger = get_logger(__name__)
settings = get_settings()
router = APIRouter(prefix="/agents", tags=["agents"])


def _require_agents():
    if not settings.ENABLE_MULTI_AGENT:
        raise ServiceUnavailableError("Multi-Agent AI (set ENABLE_MULTI_AGENT=true)")


# ── Request schemas ────────────────────────────────────────────────────────────

class JobAnalysisRequest(BaseModel):
    job_description: str
    context: dict[str, Any] | None = None


class SkillGapRequest(BaseModel):
    job_id: str
    candidate_id: str


class InterviewRequest(BaseModel):
    job_id: str
    candidate_id: str


class StrategyRequest(BaseModel):
    job_id: str
    budget: str | None = None
    timeline: str | None = None
    location: str | None = None
    team_size: str | None = None


class PipelineRequest(BaseModel):
    job_id: str
    context: dict[str, Any] | None = None


# ── Helpers ────────────────────────────────────────────────────────────────────

def _get_job_or_404(job_id: str, db: Session) -> Job:
    job = db.query(Job).filter(Job.job_id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
    return job


def _get_candidate_or_404(candidate_id: str, db: Session) -> Candidate:
    c = db.query(Candidate).filter(Candidate.candidate_id == candidate_id).first()
    if not c:
        raise HTTPException(status_code=404, detail=f"Candidate {candidate_id} not found")
    return c


def _candidate_to_dict(c: Candidate) -> dict:
    return {
        "candidate_id": c.candidate_id,
        "anonymized_name": c.anonymized_name,
        "current_title": c.current_title,
        "current_company": c.current_company,
        "years_of_experience": c.years_of_experience,
        "skills": c.skills or [],
        "career_history": c.career_history or [],
        "education": c.education or [],
        "summary": c.summary,
        "profile": {
            "anonymized_name": c.anonymized_name,
            "headline": c.headline,
            "summary": c.summary,
            "years_of_experience": c.years_of_experience,
            "current_title": c.current_title,
            "current_company": c.current_company,
        },
    }


def _rankings_for_job(job_id: str, db: Session, limit: int = 10) -> list[dict]:
    rankings = (
        db.query(Ranking)
        .filter(Ranking.job_id == job_id)
        .order_by(Ranking.rank)
        .limit(limit)
        .all()
    )
    cand_ids = [r.candidate_id for r in rankings]
    candidates = {
        c.candidate_id: c
        for c in db.query(Candidate).filter(Candidate.candidate_id.in_(cand_ids)).all()
    }
    result = []
    for r in rankings:
        c = candidates.get(r.candidate_id)
        result.append({
            "rank": r.rank,
            "candidate_id": r.candidate_id,
            "anonymized_name": c.anonymized_name if c else None,
            "current_title": c.current_title if c else None,
            "current_company": c.current_company if c else None,
            "years_of_experience": c.years_of_experience if c else None,
            "skills": c.skills if c else [],
            "similarity_score": r.similarity_score or 0,
        })
    return result


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.post("/job-analysis")
def analyze_job(payload: JobAnalysisRequest):
    """Agent 2: Extract structured intelligence from a job description."""
    _require_agents()
    from app.agents.job_agent import JobIntelligenceAgent
    with measure("api.agent.job_analysis"):
        return JobIntelligenceAgent().run(job_description=payload.job_description)


@router.post("/resume-analysis/{candidate_id}")
def analyze_resume(candidate_id: str, db: Session = Depends(get_db)):
    """Agent 1: Extract structured intelligence from a candidate profile."""
    _require_agents()
    c = _get_candidate_or_404(candidate_id, db)
    from app.agents.resume_agent import ResumeIntelligenceAgent
    with measure("api.agent.resume_analysis"):
        return ResumeIntelligenceAgent().run(candidate=_candidate_to_dict(c))


@router.post("/matching-reasoning/{job_id}")
def matching_reasoning(job_id: str, db: Session = Depends(get_db)):
    """Agent 3: Explainable AI reasoning on top of existing match scores."""
    _require_agents()
    job = _get_job_or_404(job_id, db)
    ranked = _rankings_for_job(job_id, db, limit=10)
    if not ranked:
        raise HTTPException(status_code=400, detail="Run matching first (POST /match)")
    from app.agents.matching_agent import CandidateMatchingAgent
    with measure("api.agent.matching_reasoning"):
        return CandidateMatchingAgent().run(
            job_description=job.description,
            candidates=ranked,
        )


@router.post("/skill-gap")
def skill_gap(payload: SkillGapRequest, db: Session = Depends(get_db)):
    """Agent 4: Skill gap analysis + learning roadmap for a candidate vs job."""
    _require_agents()
    job = _get_job_or_404(payload.job_id, db)
    c = _get_candidate_or_404(payload.candidate_id, db)
    from app.agents.skill_gap_agent import SkillGapAgent
    with measure("api.agent.skill_gap"):
        return SkillGapAgent().run(
            job_description=job.description,
            candidate=_candidate_to_dict(c),
        )


@router.post("/interview-kit")
def interview_kit(payload: InterviewRequest, db: Session = Depends(get_db)):
    """Agent 6: Generate full interview kit for a candidate."""
    _require_agents()
    job = _get_job_or_404(payload.job_id, db)
    c = _get_candidate_or_404(payload.candidate_id, db)
    from app.agents.interview_agent import InterviewAgent
    with measure("api.agent.interview"):
        return InterviewAgent().run(
            job_description=job.description,
            candidate=_candidate_to_dict(c),
        )


@router.post("/hiring-strategy")
def hiring_strategy(payload: StrategyRequest, db: Session = Depends(get_db)):
    """Agent 7: Generate comprehensive hiring strategy."""
    _require_agents()
    job = _get_job_or_404(payload.job_id, db)
    context = {
        "budget": payload.budget,
        "timeline": payload.timeline,
        "location": payload.location,
        "team_size": payload.team_size,
    }
    from app.agents.strategy_agent import HiringStrategyAgent
    with measure("api.agent.strategy"):
        return HiringStrategyAgent().run(
            job_description=job.description,
            context=context,
        )


@router.post("/workforce-intelligence")
def workforce_intelligence(db: Session = Depends(get_db)):
    """Agent 5: Workforce analytics + AI-generated insights."""
    _require_agents()
    analytics = get_analytics(db)
    from app.agents.workforce_agent import WorkforceAnalyticsAgent
    with measure("api.agent.workforce"):
        return WorkforceAnalyticsAgent().run(analytics=analytics)


@router.post("/executive-report")
def executive_report(period: str = "weekly", db: Session = Depends(get_db)):
    """Agent 8: Generate executive hiring report."""
    _require_agents()
    analytics = get_analytics(db)
    jobs_raw = db.query(Job).order_by(Job.created_at.desc()).limit(20).all()
    jobs = [{"title": j.title, "status": j.status, "job_id": j.job_id} for j in jobs_raw]
    from app.agents.report_agent import ExecutiveReportAgent
    with measure("api.agent.executive_report"):
        return ExecutiveReportAgent().run(analytics=analytics, jobs=jobs, period=period)


@router.post("/pipeline/{job_id}")
def run_full_pipeline(job_id: str, payload: PipelineRequest, db: Session = Depends(get_db)):
    """
    Full multi-agent pipeline for a job:
    job_intelligence → matching_reasoning → skill_gap → interview → strategy
    """
    _require_agents()
    job = _get_job_or_404(job_id, db)
    ranked = _rankings_for_job(job_id, db, limit=10)
    from app.agents.orchestrator import get_orchestrator
    with measure("api.agent.pipeline"):
        return get_orchestrator().run_hiring_pipeline(
            job_description=job.description,
            ranked_candidates=ranked,
            context=payload.context,
        )
