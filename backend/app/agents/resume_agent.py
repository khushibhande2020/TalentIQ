"""
Agent 1 — Resume Intelligence Agent
Extracts structured intelligence from a candidate profile using Gemini.
"""
from __future__ import annotations
from typing import Any
from app.agents.orchestrator import BaseAgent
from app.core.gemini import gemini_json


class ResumeIntelligenceAgent(BaseAgent):
    name = "resume_intelligence"

    def _run(self, candidate: dict[str, Any], **kwargs) -> dict[str, Any]:
        profile = candidate.get("profile", {}) or {}
        skills = candidate.get("skills", []) or []
        career = candidate.get("career_history", []) or []
        education = candidate.get("education", []) or []

        skill_names = [s.get("name", "") for s in skills if s.get("name")]
        companies = [c.get("company", "") for c in career if c.get("company")]
        degrees = [f"{e.get('degree','')} from {e.get('institution','')}" for e in education]

        prompt = f"""You are an expert talent intelligence analyst.

Analyze this candidate profile and extract structured intelligence:

Name: {profile.get('anonymized_name', 'Unknown')}
Headline: {profile.get('headline', '')}
Summary: {profile.get('summary', '')}
Experience: {profile.get('years_of_experience', 0)} years
Current Role: {profile.get('current_title', '')} at {profile.get('current_company', '')}
Skills: {', '.join(skill_names[:20])}
Career: {', '.join(companies[:5])}
Education: {', '.join(degrees[:3])}

Return JSON with these exact keys:
{{
  "seniority_level": "junior|mid|senior|lead|executive",
  "primary_domain": "main technical or functional area",
  "key_strengths": ["strength1", "strength2", "strength3"],
  "career_trajectory": "ascending|stable|transitioning|declining",
  "unique_value_proposition": "one sentence summary of what makes this candidate stand out",
  "red_flags": ["any concerns, or empty list"],
  "recommended_roles": ["role1", "role2", "role3"],
  "interview_difficulty": "easy|medium|hard",
  "confidence_score": 0.85
}}"""

        result = gemini_json(prompt)
        return {
            "status": "ok",
            "agent": self.name,
            "candidate_id": candidate.get("candidate_id", ""),
            "intelligence": result,
        }
