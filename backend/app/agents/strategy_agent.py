"""
Agent 7 — Hiring Strategy Agent
Produces complete hiring strategy given job, context, and constraints.
"""
from __future__ import annotations
from typing import Any
from app.agents.orchestrator import BaseAgent
from app.core.gemini import gemini_json


class HiringStrategyAgent(BaseAgent):
    name = "hiring_strategy"

    def _run(
        self,
        job_description: str,
        context: dict[str, Any] | None = None,
        **kwargs,
    ) -> dict[str, Any]:
        ctx = context or {}

        prompt = f"""You are a Chief People Officer and hiring strategist.

JOB REQUIREMENTS:
{job_description[:1500]}

HIRING CONTEXT:
Budget: {ctx.get('budget', 'Not specified')}
Timeline: {ctx.get('timeline', 'Not specified')}
Location: {ctx.get('location', 'Not specified')}
Team Size: {ctx.get('team_size', 'Not specified')}
Industry: {ctx.get('industry', 'Not specified')}

Generate a comprehensive hiring strategy. Return JSON:
{{
  "recommended_strategy": "direct hire|agency|referral|campus|mixed",
  "time_to_hire_estimate": "4-6 weeks",
  "budget_allocation": {{
    "job_boards": "30%",
    "agency_fees": "0%",
    "referral_bonus": "20%",
    "other": "50%"
  }},
  "talent_sourcing_channels": ["LinkedIn", "GitHub", "Referrals"],
  "hiring_risks": [
    {{"risk": "description", "severity": "high|medium|low", "mitigation": "how to mitigate"}}
  ],
  "skill_shortage_impact": "assessment of market availability",
  "interview_process_recommendation": ["step1", "step2", "step3"],
  "offer_strategy": "compensation and benefits positioning",
  "onboarding_plan": "first 30-60-90 day plan summary",
  "success_metrics": ["metric1", "metric2"],
  "alternative_approaches": ["approach if plan A fails"],
  "executive_summary": "2-3 sentence summary for leadership"
}}"""

        result = gemini_json(prompt)
        return {
            "status": "ok",
            "agent": self.name,
            "hiring_strategy": result,
        }
