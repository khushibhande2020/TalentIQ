"""
Agent 3 — Candidate Matching Agent
Adds Gemini-powered reasoning and explainability on top of the
existing semantic matching scores. Does NOT replace the matching algorithm.
"""
from __future__ import annotations
from typing import Any
from app.agents.orchestrator import BaseAgent
from app.core.gemini import gemini_json


class CandidateMatchingAgent(BaseAgent):
    name = "candidate_matching"

    def _run(
        self,
        job_description: str,
        candidates: list[dict[str, Any]],
        **kwargs,
    ) -> dict[str, Any]:
        # Build a compact summary of top candidates for the prompt
        cand_summaries = []
        for c in candidates[:8]:
            skills = [s.get("name", "") for s in (c.get("skills") or [])[:8]]
            cand_summaries.append(
                f"Rank {c.get('rank')}: {c.get('anonymized_name', c.get('candidate_id', ''))} | "
                f"{c.get('current_title', '')} at {c.get('current_company', '')} | "
                f"{c.get('years_of_experience', 0)} yrs | "
                f"Score: {round(c.get('similarity_score', 0) * 100, 1)}% | "
                f"Skills: {', '.join(skills)}"
            )

        prompt = f"""You are a senior technical recruiter making hiring decisions.

JOB DESCRIPTION (excerpt):
{job_description[:1500]}

TOP CANDIDATES (pre-ranked by AI semantic matching):
{chr(10).join(cand_summaries)}

Provide explainable AI reasoning for these rankings. Return JSON:
{{
  "overall_pool_quality": "poor|fair|good|excellent",
  "recommendation": "one sentence overall hiring recommendation",
  "top_pick_reasoning": "why rank 1 is the best match",
  "candidates": [
    {{
      "rank": 1,
      "candidate_id": "...",
      "match_explanation": "why this candidate fits",
      "key_matching_factors": ["factor1", "factor2"],
      "concerns": ["concern1 or empty"],
      "hire_recommendation": "strong_yes|yes|maybe|no",
      "confidence": 0.85
    }}
  ],
  "hiring_insight": "strategic insight about this candidate pool"
}}"""

        result = gemini_json(prompt)
        return {
            "status": "ok",
            "agent": self.name,
            "explainability": result,
        }
