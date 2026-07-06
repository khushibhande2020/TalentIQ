"""
Agent 5 — Workforce Analytics Agent
Generates natural language insights from the analytics data using Gemini.
"""
from __future__ import annotations
from typing import Any
from app.agents.orchestrator import BaseAgent
from app.core.gemini import gemini_json


class WorkforceAnalyticsAgent(BaseAgent):
    name = "workforce_analytics"

    def _run(self, analytics: dict[str, Any], **kwargs) -> dict[str, Any]:
        top_skills = [s["skill"] for s in analytics.get("top_skills", [])[:10]]
        exp_dist = analytics.get("experience_distribution", [])
        industry_dist = analytics.get("industry_distribution", [])[:5]
        top_industries = [i["industry"] for i in industry_dist]

        prompt = f"""You are a workforce intelligence analyst for an enterprise HR platform.

CANDIDATE POOL ANALYTICS:
- Total Candidates: {analytics.get('total_candidates', 0):,}
- Total Jobs: {analytics.get('total_jobs', 0)}
- Total Match Runs: {analytics.get('total_rankings', 0):,}
- Avg Match Score: {analytics.get('avg_similarity_score', 0):.1%}
- Top Skills: {', '.join(top_skills)}
- Top Industries: {', '.join(top_industries)}
- Experience Distribution: {exp_dist}

Generate strategic workforce intelligence. Return JSON:
{{
  "pool_health_score": 78,
  "pool_health_label": "good|fair|poor|excellent",
  "key_insights": [
    "insight about skill concentration",
    "insight about experience distribution",
    "insight about industry diversity"
  ],
  "talent_trends": ["trend1", "trend2"],
  "skill_shortage_alerts": ["skill that is underrepresented"],
  "hiring_recommendations": ["recommendation1", "recommendation2"],
  "competitive_intelligence": "paragraph about talent market conditions",
  "diversity_score": 65,
  "pipeline_forecast": "prediction about upcoming hiring challenges"
}}"""

        result = gemini_json(prompt)
        return {
            "status": "ok",
            "agent": self.name,
            "workforce_intelligence": result,
        }
