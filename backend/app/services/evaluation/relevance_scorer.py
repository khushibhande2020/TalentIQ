"""
Relevance Scorer.

Builds proxy ground-truth relevance labels from candidate data
when human-annotated labels are unavailable.

See validation_dataset.py for full methodology documentation.
"""
from __future__ import annotations
import re
from typing import Any

import numpy as np

from app.core.logging import get_logger

logger = get_logger(__name__)


def _normalize_skill(s: str) -> str:
    """Lowercase, strip, remove punctuation for fuzzy matching."""
    return re.sub(r"[^a-z0-9 ]", "", s.lower().strip())


def _skill_overlap_score(
    candidate_skills: list[dict[str, Any]],
    required_skills: list[str],
) -> float:
    """
    Fraction of required skills present in candidate's skill list.
    Uses fuzzy substring matching to handle variations (e.g. 'node.js' ≈ 'nodejs').
    """
    if not required_skills:
        return 0.5   # no requirement → neutral

    cand_skill_names = {_normalize_skill(s.get("name", "")) for s in candidate_skills}
    req_normalized = [_normalize_skill(r) for r in required_skills]

    hits = 0
    for req in req_normalized:
        # Exact match OR substring match (catches "machine learning" ≈ "ml")
        if any(req in cs or cs in req for cs in cand_skill_names if cs):
            hits += 1

    return hits / len(req_normalized)


def _experience_fit_score(
    years_of_experience: float | None,
    min_exp: float,
    max_exp: float,
) -> float:
    """
    Gaussian fit: peak at midpoint of [min_exp, max_exp].
    Falls off smoothly for under/over-qualified candidates.
    """
    if years_of_experience is None:
        return 0.4   # unknown experience → slight penalty

    yoe = float(years_of_experience)
    mid = (min_exp + max_exp) / 2.0
    spread = max((max_exp - min_exp) / 2.0, 1.0)

    # Gaussian centered on midpoint
    score = math.exp(-0.5 * ((yoe - mid) / spread) ** 2)
    return float(score)


def _title_semantic_score(
    candidate_title: str | None,
    job_title: str,
) -> float:
    """
    Lightweight title similarity using token overlap.
    Full embedding similarity is too expensive to run for every candidate
    during batch evaluation — this is a fast approximation.
    """
    if not candidate_title:
        return 0.3
    cand_tokens = set(_normalize_skill(candidate_title).split())
    job_tokens = set(_normalize_skill(job_title).split())
    # Remove stop words
    stops = {"the", "a", "an", "of", "in", "and", "or", "for", "with", "at"}
    cand_tokens -= stops
    job_tokens -= stops
    if not job_tokens:
        return 0.5
    overlap = len(cand_tokens & job_tokens)
    return min(overlap / len(job_tokens), 1.0)


import math  # noqa: E402 — needed for _experience_fit_score


def compute_relevance_score(
    candidate: dict[str, Any],
    query: dict[str, Any],
) -> tuple[float, int]:
    """
    Compute continuous relevance score and discrete grade for a candidate–query pair.

    Returns:
        (score: float in [0,1], grade: int in {0,1,2,3})
    """
    skill_score = _skill_overlap_score(
        candidate.get("skills") or [],
        query.get("required_skills", []),
    )
    exp_score = _experience_fit_score(
        candidate.get("years_of_experience"),
        query.get("min_exp", 0),
        query.get("max_exp", 20),
    )
    title_score = _title_semantic_score(
        candidate.get("current_title"),
        query.get("title", ""),
    )

    # Weighted combination (see methodology in validation_dataset.py)
    combined = 0.60 * skill_score + 0.20 * exp_score + 0.20 * title_score

    # Map to 4-level graded relevance
    if combined >= 0.60:
        grade = 3   # highly relevant
    elif combined >= 0.40:
        grade = 2   # relevant
    elif combined >= 0.20:
        grade = 1   # partially relevant
    else:
        grade = 0   # not relevant

    return combined, grade


def build_relevance_judgments(
    candidates: list[dict[str, Any]],
    query: dict[str, Any],
    relevant_threshold_grade: int = 2,
) -> tuple[set[str], dict[str, int]]:
    """
    Build relevance judgments for all candidates against a query.

    Returns:
        relevant_ids: set of candidate_ids with grade >= threshold (binary relevance)
        graded:       dict mapping candidate_id → grade (0-3) for nDCG
    """
    relevant_ids: set[str] = set()
    graded: dict[str, int] = {}

    for c in candidates:
        cid = c.get("candidate_id", "")
        if not cid:
            continue
        _, grade = compute_relevance_score(c, query)
        graded[cid] = grade
        if grade >= relevant_threshold_grade:
            relevant_ids.add(cid)

    return relevant_ids, graded
