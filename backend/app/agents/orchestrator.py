"""
Multi-Agent Orchestrator.
All agents inherit from BaseAgent and are coordinated here.
Each agent is stateless — safe to call concurrently.
Falls back gracefully if ENABLE_MULTI_AGENT=false or Gemini unavailable.
"""
from __future__ import annotations
import time
from typing import Any
from app.core.config import get_settings
from app.core.logging import get_logger
from app.core.metrics import measure, increment, record_error
from app.core.gemini import gemini_generate, gemini_json

logger = get_logger(__name__)
settings = get_settings()


class BaseAgent:
    """All agents inherit from this. Provides timing, logging, error handling."""

    name: str = "BaseAgent"

    def run(self, **kwargs) -> dict[str, Any]:
        if not settings.ENABLE_MULTI_AGENT:
            return {"status": "disabled", "message": "Set ENABLE_MULTI_AGENT=true in .env"}
        with measure(f"agent.{self.name}"):
            try:
                result = self._run(**kwargs)
                increment(f"agent.{self.name}.success")
                return result
            except Exception as e:
                record_error(f"agent.{self.name}")
                logger.error("Agent %s failed: %s", self.name, e)
                return {
                    "status": "error",
                    "agent": self.name,
                    "error": str(e),
                    "fallback": True,
                }

    def _run(self, **kwargs) -> dict[str, Any]:
        raise NotImplementedError


class Orchestrator:
    """
    Coordinates all agents. Single entry point for multi-agent workflows.
    Agents run independently — failure in one does not block others.
    """

    def __init__(self):
        from app.agents.resume_agent import ResumeIntelligenceAgent
        from app.agents.job_agent import JobIntelligenceAgent
        from app.agents.matching_agent import CandidateMatchingAgent
        from app.agents.skill_gap_agent import SkillGapAgent
        from app.agents.workforce_agent import WorkforceAnalyticsAgent
        from app.agents.interview_agent import InterviewAgent
        from app.agents.strategy_agent import HiringStrategyAgent
        from app.agents.report_agent import ExecutiveReportAgent

        self.agents = {
            "resume": ResumeIntelligenceAgent(),
            "job": JobIntelligenceAgent(),
            "matching": CandidateMatchingAgent(),
            "skill_gap": SkillGapAgent(),
            "workforce": WorkforceAnalyticsAgent(),
            "interview": InterviewAgent(),
            "strategy": HiringStrategyAgent(),
            "report": ExecutiveReportAgent(),
        }

    def run_agent(self, agent_name: str, **kwargs) -> dict[str, Any]:
        agent = self.agents.get(agent_name)
        if not agent:
            return {"status": "error", "error": f"Unknown agent: {agent_name}"}
        return agent.run(**kwargs)

    def run_hiring_pipeline(
        self,
        job_description: str,
        ranked_candidates: list[dict],
        context: dict | None = None,
    ) -> dict[str, Any]:
        """
        Full pipeline: job analysis → matching reasoning → skill gaps → interview Qs → strategy.
        Each step feeds into the next.
        """
        ctx = context or {}
        results = {}

        results["job_analysis"] = self.agents["job"].run(job_description=job_description)
        results["matching_reasoning"] = self.agents["matching"].run(
            job_description=job_description,
            candidates=ranked_candidates[:10],
        )
        if ranked_candidates:
            results["skill_gap"] = self.agents["skill_gap"].run(
                job_description=job_description,
                candidate=ranked_candidates[0],
            )
            results["interview_questions"] = self.agents["interview"].run(
                job_description=job_description,
                candidate=ranked_candidates[0],
            )
        results["strategy"] = self.agents["strategy"].run(
            job_description=job_description,
            context=ctx,
        )
        return results


# Singleton
_orchestrator: Orchestrator | None = None


def get_orchestrator() -> Orchestrator:
    global _orchestrator
    if _orchestrator is None:
        _orchestrator = Orchestrator()
    return _orchestrator
