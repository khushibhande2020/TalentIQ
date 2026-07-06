"""
Agent 6 — Interview Agent
Generates technical questions, behavioral questions, coding rounds, and evaluation rubrics.
"""
from __future__ import annotations
from typing import Any
from app.agents.orchestrator import BaseAgent
from app.core.gemini import gemini_json


class InterviewAgent(BaseAgent):
    name = "interview"

    def _run(
        self,
        job_description: str,
        candidate: dict[str, Any],
        **kwargs,
    ) -> dict[str, Any]:
        skills = [s.get("name", "") for s in (candidate.get("skills") or [])[:15]]
        name = candidate.get("anonymized_name") or candidate.get("candidate_id", "Candidate")

        prompt = f"""You are an expert technical interviewer and hiring manager.

JOB REQUIREMENTS:
{job_description[:1200]}

CANDIDATE:
Name: {name}
Role: {candidate.get('current_title', '')}
Experience: {candidate.get('years_of_experience', 0)} years
Skills: {', '.join(skills)}

Generate a complete interview kit. Return JSON:
{{
  "recommended_interview_rounds": 3,
  "technical_questions": [
    {{"question": "...", "difficulty": "medium", "expected_answer_hint": "..."}},
    {{"question": "...", "difficulty": "hard", "expected_answer_hint": "..."}}
  ],
  "behavioral_questions": [
    {{"question": "Tell me about...", "competency": "leadership|teamwork|problem-solving"}},
    {{"question": "Describe a situation...", "competency": "conflict-resolution"}}
  ],
  "coding_challenge": {{
    "title": "challenge name",
    "description": "problem statement",
    "difficulty": "easy|medium|hard",
    "time_minutes": 45,
    "evaluation_criteria": ["correctness", "efficiency", "code quality"]
  }},
  "evaluation_rubric": {{
    "technical_skills": "what to look for",
    "communication": "what to look for",
    "problem_solving": "what to look for",
    "culture_fit": "what to look for"
  }},
  "red_flag_questions": ["question to probe a concern"],
  "estimated_interview_duration_minutes": 90
}}"""

        result = gemini_json(prompt)
        return {
            "status": "ok",
            "agent": self.name,
            "candidate_id": candidate.get("candidate_id", ""),
            "interview_kit": result,
        }
