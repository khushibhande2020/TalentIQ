"""
Agent 2 — Job Intelligence Agent
Extracts structured requirements from a job description using Gemini.
"""
from __future__ import annotations
from app.agents.orchestrator import BaseAgent
from app.core.gemini import gemini_json


class JobIntelligenceAgent(BaseAgent):
    name = "job_intelligence"

    def _run(self, job_description: str, **kwargs) -> dict:
        prompt = f"""You are an expert job requirements analyst.

Analyze this job description and extract structured intelligence:

---
{job_description[:3000]}
---

Return JSON with these exact keys:
{{
  "title": "inferred job title",
  "seniority_level": "junior|mid|senior|lead|executive",
  "required_skills": ["skill1", "skill2", "skill3", "skill4", "skill5"],
  "preferred_skills": ["skill1", "skill2", "skill3"],
  "min_experience_years": 3,
  "max_experience_years": 8,
  "education_requirement": "bachelor|master|phd|any",
  "key_responsibilities": ["responsibility1", "responsibility2", "responsibility3"],
  "tech_stack": ["tech1", "tech2", "tech3"],
  "soft_skills": ["skill1", "skill2"],
  "work_mode": "remote|onsite|hybrid|any",
  "hiring_urgency": "low|medium|high|critical",
  "role_complexity": "low|medium|high",
  "estimated_salary_range": "e.g. $80K-$120K or Not specified",
  "ideal_candidate_summary": "two sentence description of the perfect candidate"
}}"""

        result = gemini_json(prompt)
        return {
            "status": "ok",
            "agent": self.name,
            "job_intelligence": result,
        }
