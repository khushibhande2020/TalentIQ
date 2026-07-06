"""
Agent 4 — Skill Gap Agent
Identifies missing skills, training recommendations, and alternative roles.
"""
from __future__ import annotations
from typing import Any
from app.agents.orchestrator import BaseAgent
from app.core.gemini import gemini_json


class SkillGapAgent(BaseAgent):
    name = "skill_gap"

    def _run(
        self,
        job_description: str,
        candidate: dict[str, Any],
        **kwargs,
    ) -> dict[str, Any]:
        skills = [s.get("name", "") for s in (candidate.get("skills") or [])[:20]]
        name = candidate.get("anonymized_name") or candidate.get("candidate_id", "Candidate")

        prompt = f"""You are a learning & development specialist and career advisor.

JOB REQUIREMENTS:
{job_description[:1500]}

CANDIDATE PROFILE:
Name: {name}
Current Role: {candidate.get('current_title', '')}
Experience: {candidate.get('years_of_experience', 0)} years
Current Skills: {', '.join(skills)}

Perform a skill gap analysis. Return JSON:
{{
  "match_percentage": 72,
  "missing_critical_skills": ["skill1", "skill2"],
  "missing_nice_to_have_skills": ["skill1", "skill2"],
  "existing_transferable_skills": ["skill1", "skill2"],
  "gap_severity": "low|medium|high|critical",
  "training_recommendations": [
    {{
      "skill": "skill name",
      "resource": "recommended course or resource",
      "estimated_weeks": 4,
      "priority": "high|medium|low"
    }}
  ],
  "learning_roadmap": "3-6 month plan to close the gaps",
  "alternative_roles": ["role1", "role2"],
  "readiness_timeline": "ready now|1-3 months|3-6 months|6-12 months|not suitable"
}}"""

        result = gemini_json(prompt)
        return {
            "status": "ok",
            "agent": self.name,
            "candidate_id": candidate.get("candidate_id", ""),
            "skill_gap_analysis": result,
        }
