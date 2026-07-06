from __future__ import annotations
from pydantic import BaseModel, Field
from typing import Any, Optional
from datetime import datetime


# ── Candidate ─────────────────────────────────────────────────────────────────

class CandidateBase(BaseModel):
    candidate_id: str
    anonymized_name: Optional[str] = None
    headline: Optional[str] = None
    summary: Optional[str] = None
    location: Optional[str] = None
    country: Optional[str] = None
    years_of_experience: Optional[float] = None
    current_title: Optional[str] = None
    current_company: Optional[str] = None
    current_company_size: Optional[str] = None
    current_industry: Optional[str] = None
    career_history: Optional[list[dict[str, Any]]] = None
    education: Optional[list[dict[str, Any]]] = None
    skills: Optional[list[dict[str, Any]]] = None
    certifications: Optional[list[dict[str, Any]]] = None
    languages: Optional[list[dict[str, Any]]] = None
    redrob_signals: Optional[dict[str, Any]] = None


class CandidateOut(CandidateBase):
    id: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class CandidatePage(BaseModel):
    total: int
    page: int
    page_size: int
    items: list[CandidateOut]


# ── Job ───────────────────────────────────────────────────────────────────────

class JobCreate(BaseModel):
    title: Optional[str] = None
    description: str = Field(..., min_length=10)


class JobOut(BaseModel):
    id: int
    job_id: str
    title: Optional[str] = None
    description: str
    entities: Optional[list[Any]] = None
    status: str
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ── Ranking / Match ───────────────────────────────────────────────────────────

class RankedCandidate(BaseModel):
    rank: int
    candidate_id: str
    anonymized_name: Optional[str] = None
    headline: Optional[str] = None
    current_title: Optional[str] = None
    current_company: Optional[str] = None
    location: Optional[str] = None
    years_of_experience: Optional[float] = None
    skills: Optional[list[dict[str, Any]]] = None
    similarity_score: float
    tfidf_score: float
    semantic_score: float

    class Config:
        from_attributes = True


class MatchRequest(BaseModel):
    job_id: str
    top_k: int = Field(default=100, ge=1, le=500)


class MatchResponse(BaseModel):
    job_id: str
    job_title: Optional[str]
    total_candidates: int
    ranked: list[RankedCandidate] = []


# ── Analytics ─────────────────────────────────────────────────────────────────

class Analytics(BaseModel):
    total_candidates: int
    total_jobs: int
    total_rankings: int
    avg_similarity_score: Optional[float]
    top_skills: list[dict[str, Any]]
    experience_distribution: list[dict[str, Any]]
    industry_distribution: list[dict[str, Any]]
    location_distribution: list[dict[str, Any]]
    score_distribution: list[dict[str, Any]]
