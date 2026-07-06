"""
Agent 8 — Executive Report Agent
Generates weekly hiring summaries, executive reports, and recruiter dashboards.
"""
from __future__ import annotations
from typing import Any
from datetime import datetime
from app.agents.orchestrator import BaseAgent
from app.core.gemini import gemini_generate, gemini_json


class ExecutiveReportAgent(BaseAgent):
    name = "executive_report"

    def _run(
        self,
        analytics: dict[str, Any],
        jobs: list[dict[str, Any]] | None = None,
        period: str = "weekly",
        **kwargs,
    ) -> dict[str, Any]:
        jobs = jobs or []
        job_summaries = "\n".join(
            f"- {j.get('title','Untitled')} ({j.get('status','')}, {j.get('job_id','')})"
            for j in jobs[:10]
        )

        prompt = f"""You are a Chief People Officer writing an executive report.

REPORTING PERIOD: {period.upper()} — {datetime.now().strftime('%B %d, %Y')}

PLATFORM METRICS:
- Total Candidates in Pool: {analytics.get('total_candidates', 0):,}
- Active Job Postings: {analytics.get('total_jobs', 0)}
- Total Matches Run: {analytics.get('total_rankings', 0):,}
- Average Match Score: {analytics.get('avg_similarity_score', 0):.1%}

ACTIVE JOBS:
{job_summaries or 'No active jobs'}

TOP SKILLS IN POOL: {', '.join(s['skill'] for s in analytics.get('top_skills', [])[:8])}

Generate an executive report. Return JSON:
{{
  "report_title": "Weekly Talent Intelligence Report",
  "report_date": "{datetime.now().strftime('%Y-%m-%d')}",
  "executive_summary": "3-4 sentence overview for C-suite",
  "headline_metrics": [
    {{"label": "Candidates Processed", "value": "{analytics.get('total_candidates',0):,}", "trend": "up|down|stable"}},
    {{"label": "Active Requisitions", "value": "{analytics.get('total_jobs',0)}", "trend": "up|down|stable"}},
    {{"label": "Avg Match Quality", "value": "{analytics.get('avg_similarity_score',0):.1%}", "trend": "up|down|stable"}}
  ],
  "key_findings": ["finding1", "finding2", "finding3"],
  "talent_market_summary": "paragraph about talent availability",
  "top_risks": ["risk1", "risk2"],
  "recommendations": ["recommendation1", "recommendation2", "recommendation3"],
  "next_steps": ["action1", "action2"],
  "hiring_velocity": "assessment of hiring speed",
  "pipeline_health": "healthy|at_risk|critical",
  "budget_utilization": "N/A — not configured",
  "recruiter_highlights": "notable achievements this period"
}}"""

        result = gemini_json(prompt)
        return {
            "status": "ok",
            "agent": self.name,
            "period": period,
            "report": result,
            "generated_at": datetime.now().isoformat(),
        }
