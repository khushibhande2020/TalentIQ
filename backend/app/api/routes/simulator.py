"""
Hiring Strategy Simulator.
Recruiter adjusts parameters → system recomputes match scores in-memory
→ Gemini generates updated strategy + recommendations.
Does NOT write to the database — pure simulation.
"""
from __future__ import annotations
from typing import Any
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
import numpy as np

from app.core.config import get_settings
from app.core.logging import get_logger
from app.core.metrics import measure
from app.db.session import get_db
from app.models.candidate import Candidate
from app.services.preprocessing import preprocess_text
from app.services.embeddings import embedding_to_numpy, get_model

logger = get_logger(__name__)
settings = get_settings()
router = APIRouter(prefix="/simulator", tags=["simulator"])


class SimulatorParams(BaseModel):
    job_description: str = Field(..., min_length=20)
    salary_range: str | None = None
    min_experience: float = Field(default=0.0, ge=0)
    max_experience: float = Field(default=20.0, le=50)
    location_preference: str | None = None
    remote_policy: str = "any"          # remote | onsite | hybrid | any
    required_skills: list[str] = Field(default_factory=list)
    hiring_target: int = Field(default=5, ge=1, le=50)
    budget_constraint: str | None = None
    team_size: str | None = None
    top_k: int = Field(default=20, ge=5, le=100)


class SimulatorResponse(BaseModel):
    filtered_candidates: list[dict[str, Any]]
    total_matching_pool: int
    strategy: dict[str, Any]
    simulation_params: dict[str, Any]
    feasibility_score: float
    feasibility_label: str


@router.post("", response_model=SimulatorResponse)
def run_simulator(payload: SimulatorParams, db: Session = Depends(get_db)):
    """
    Simulate a hiring scenario with custom parameters.
    Returns ranked candidates + AI-generated strategy.
    """
    with measure("simulator.run"):
        # 1. Filter candidate pool by simulation constraints
        query = db.query(Candidate).filter(Candidate.combined_text.isnot(None))

        if payload.min_experience > 0:
            query = query.filter(Candidate.years_of_experience >= payload.min_experience)
        if payload.max_experience < 20:
            query = query.filter(Candidate.years_of_experience <= payload.max_experience)
        if payload.location_preference and payload.remote_policy == "onsite":
            query = query.filter(
                Candidate.location.ilike(f"%{payload.location_preference}%")
            )

        candidates = query.limit(3000).all()

        if not candidates:
            return SimulatorResponse(
                filtered_candidates=[],
                total_matching_pool=0,
                strategy={"error": "No candidates match the specified filters"},
                simulation_params=payload.dict(),
                feasibility_score=0.0,
                feasibility_label="Not Feasible",
            )

        # 2. Skill filter (soft — score bonus for required skills)
        required_lower = [s.lower().strip() for s in payload.required_skills]

        # 3. Semantic matching on filtered pool
        from sklearn.feature_extraction.text import TfidfVectorizer
        from sklearn.metrics.pairwise import cosine_similarity

        texts = [c.combined_text or "" for c in candidates]
        job_text = preprocess_text(payload.job_description)

        vec = TfidfVectorizer(max_features=settings.TFIDF_MAX_FEATURES)
        X = vec.fit_transform(texts)
        job_vec = vec.transform([job_text])
        tfidf_scores = cosine_similarity(job_vec, X)[0]

        model = get_model()
        job_emb = model.encode(job_text, show_progress_bar=False).astype(np.float32)
        emb_matrix = np.vstack([
            embedding_to_numpy(c.embedding).astype(np.float32) if c.embedding
            else np.zeros(384, dtype=np.float32)
            for c in candidates
        ])
        semantic_scores = cosine_similarity(job_emb.reshape(1, -1), emb_matrix)[0]

        combined = (tfidf_scores + semantic_scores) * 0.5

        # Skill bonus: +0.05 per required skill match
        if required_lower:
            for i, c in enumerate(candidates):
                cand_skills = {(s.get("name") or "").lower() for s in (c.skills or [])}
                matches = sum(1 for r in required_lower if any(r in cs for cs in cand_skills))
                bonus = (matches / len(required_lower)) * 0.1
                combined[i] = min(combined[i] + bonus, 1.0)

        top_idx = np.argsort(combined)[::-1][:payload.top_k]

        filtered = []
        for rank, idx in enumerate(top_idx, 1):
            c = candidates[idx]
            filtered.append({
                "rank": rank,
                "candidate_id": c.candidate_id,
                "name": c.anonymized_name or c.candidate_id,
                "title": c.current_title,
                "company": c.current_company,
                "location": c.location,
                "years_of_experience": c.years_of_experience,
                "score": round(float(combined[idx]), 3),
                "skills": [s.get("name", "") for s in (c.skills or [])[:6]],
                "work_mode": (c.redrob_signals or {}).get("preferred_work_mode") if c.redrob_signals else None,
            })

        # Feasibility: can we find `hiring_target` qualified candidates?
        qualified = [f for f in filtered if f["score"] >= 0.4]
        feasibility = min(len(qualified) / payload.hiring_target, 1.0)
        feasibility_label = (
            "Highly Feasible" if feasibility >= 0.8 else
            "Feasible"        if feasibility >= 0.5 else
            "Challenging"     if feasibility >= 0.3 else
            "Not Feasible"
        )

        # AI strategy
        strategy = _generate_strategy(payload, len(candidates), qualified, feasibility)

        return SimulatorResponse(
            filtered_candidates=filtered,
            total_matching_pool=len(candidates),
            strategy=strategy,
            simulation_params=payload.dict(),
            feasibility_score=round(feasibility, 3),
            feasibility_label=feasibility_label,
        )


def _generate_strategy(
    params: SimulatorParams,
    pool_size: int,
    qualified: list,
    feasibility: float,
) -> dict:
    if not settings.ENABLE_GEMINI:
        return {
            "recommendation": f"Found {len(qualified)} qualified candidates for {params.hiring_target} target hires.",
            "feasibility_assessment": f"Feasibility: {round(feasibility * 100)}%",
            "top_suggestion": "Enable Gemini for AI-powered strategy.",
            "ai_generated": False,
        }
    from app.core.gemini import gemini_json
    prompt = f"""You are a hiring strategy advisor analyzing a simulation scenario.

Simulation Parameters:
- Job: {params.job_description[:500]}
- Salary: {params.salary_range or 'Not specified'}
- Experience: {params.min_experience}–{params.max_experience} years
- Location: {params.location_preference or 'Any'}, Remote: {params.remote_policy}
- Required Skills: {', '.join(params.required_skills) or 'None specified'}
- Hiring Target: {params.hiring_target} hires
- Candidate Pool: {pool_size} candidates
- Qualified (score ≥ 0.4): {len(qualified)}
- Feasibility: {round(feasibility * 100)}%

Generate a hiring strategy. Return JSON:
{{
  "recommendation": "2-sentence overall recommendation",
  "feasibility_assessment": "assessment of hiring feasibility",
  "top_suggestion": "single most impactful change to improve results",
  "risks": ["risk1", "risk2"],
  "timeline_estimate": "estimated time to fill",
  "budget_note": "salary competitiveness note",
  "alternative_approach": "if constraints are too tight, suggest alternative",
  "ai_generated": true
}}"""
    result = gemini_json(prompt)
    if not result:
        return {"recommendation": "Strategy unavailable", "ai_generated": False}
    result["ai_generated"] = True
    return result
