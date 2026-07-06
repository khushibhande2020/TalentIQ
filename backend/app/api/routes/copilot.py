"""
AI Hiring Copilot — natural language interface over platform data.
Answers recruiter questions using analytics + BigQuery + Gemini reasoning.
Falls back gracefully when Gemini is disabled.
"""
from __future__ import annotations
import time
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.cache import cache_get, cache_set
from app.core.config import get_settings
from app.core.logging import get_logger
from app.core.metrics import measure
from app.db.session import get_db
from app.services.analytics import get_analytics
from app.services.bigquery.repository import get_hiring_funnel

logger = get_logger(__name__)
settings = get_settings()
router = APIRouter(prefix="/copilot", tags=["copilot"])

# Store last 20 messages in memory per session (keyed by session_id)
_conversation_store: dict[str, list[dict]] = {}
MAX_HISTORY = 10


class CopilotMessage(BaseModel):
    message: str = Field(..., min_length=3, max_length=2000)
    session_id: str = "default"


class CopilotResponse(BaseModel):
    response: str
    session_id: str
    data_used: list[str]
    ai_generated: bool
    timestamp: str


@router.post("", response_model=CopilotResponse)
def copilot_chat(payload: CopilotMessage, db: Session = Depends(get_db)):
    """Answer a recruiter's natural language question using platform data + Gemini."""
    session_id = payload.session_id
    user_msg = payload.message.strip()

    with measure("copilot.query"):
        # Build context from platform data
        context_parts, data_used = _build_context(user_msg, db)

        if not settings.ENABLE_GEMINI:
            response = _rule_based_response(user_msg, context_parts)
            ai_generated = False
        else:
            response = _gemini_response(user_msg, context_parts, session_id)
            ai_generated = True

        # Update conversation history
        history = _conversation_store.setdefault(session_id, [])
        history.append({"role": "user", "content": user_msg})
        history.append({"role": "assistant", "content": response})
        # Keep last MAX_HISTORY * 2 messages
        _conversation_store[session_id] = history[-(MAX_HISTORY * 2):]

    return CopilotResponse(
        response=response,
        session_id=session_id,
        data_used=data_used,
        ai_generated=ai_generated,
        timestamp=time.strftime("%Y-%m-%dT%H:%M:%SZ"),
    )


@router.delete("/session/{session_id}")
def clear_session(session_id: str):
    """Clear conversation history for a session."""
    _conversation_store.pop(session_id, None)
    return {"message": f"Session {session_id} cleared"}


@router.get("/session/{session_id}")
def get_session_history(session_id: str):
    """Retrieve conversation history."""
    return {"session_id": session_id, "history": _conversation_store.get(session_id, [])}


def _build_context(question: str, db: Session) -> tuple[dict, list[str]]:
    """Gather relevant platform data based on question keywords."""
    ctx = {}
    used = []

    q = question.lower()

    # Always include core stats
    analytics = cache_get("analytics:global")
    if not analytics:
        analytics = get_analytics(db)
        cache_set("analytics:global", analytics, 300)

    ctx["platform_stats"] = {
        "total_candidates": analytics.get("total_candidates", 0),
        "total_jobs": analytics.get("total_jobs", 0),
        "total_rankings": analytics.get("total_rankings", 0),
        "avg_match_score": analytics.get("avg_similarity_score"),
    }
    used.append("platform_stats")

    if any(w in q for w in ["skill", "tech", "stack", "know", "language"]):
        ctx["top_skills"] = analytics.get("top_skills", [])[:10]
        used.append("skill_data")

    if any(w in q for w in ["experience", "years", "senior", "junior", "level"]):
        ctx["experience_distribution"] = analytics.get("experience_distribution", [])
        used.append("experience_data")

    if any(w in q for w in ["location", "where", "city", "country", "remote"]):
        ctx["location_distribution"] = analytics.get("location_distribution", [])[:8]
        used.append("location_data")

    if any(w in q for w in ["industry", "sector", "domain", "field"]):
        ctx["industry_distribution"] = analytics.get("industry_distribution", [])[:8]
        used.append("industry_data")

    if any(w in q for w in ["funnel", "pipeline", "screened", "qualified", "shortlist"]):
        ctx["hiring_funnel"] = get_hiring_funnel(db)
        used.append("hiring_funnel")

    if any(w in q for w in ["score", "match", "quality", "ranking"]):
        ctx["score_distribution"] = analytics.get("score_distribution", [])
        used.append("score_distribution")

    return ctx, used


def _gemini_response(question: str, context: dict, session_id: str) -> str:
    from app.core.gemini import gemini_generate

    history = _conversation_store.get(session_id, [])
    history_text = ""
    if history:
        history_text = "\nConversation History (last exchanges):\n"
        for msg in history[-6:]:
            history_text += f"{msg['role'].capitalize()}: {msg['content']}\n"

    prompt = f"""You are TalentIQ Copilot, an expert AI hiring assistant with access to live recruitment data.

Platform Data:
{_format_context(context)}
{history_text}

Recruiter Question: {question}

Answer helpfully and concisely. Use the data provided. If you don't have enough data, say so clearly.
Keep your response under 200 words. Be specific with numbers from the data."""

    return gemini_generate(prompt)


def _rule_based_response(question: str, context: dict) -> str:
    """Simple keyword-based responses when Gemini is disabled."""
    q = question.lower()
    stats = context.get("platform_stats", {})
    candidates = stats.get("total_candidates", 0)
    jobs = stats.get("total_jobs", 0)
    avg = stats.get("avg_match_score")

    if any(w in q for w in ["how many candidate", "total candidate", "pool size"]):
        return f"Your candidate pool contains **{candidates:,} candidates**."

    if any(w in q for w in ["how many job", "job posting", "active job"]):
        return f"There are **{jobs} jobs** in the system."

    if any(w in q for w in ["average score", "match quality", "avg score"]):
        score_str = f"**{avg:.1%}**" if avg else "not available yet"
        return f"The average match score across all rankings is {score_str}."

    if any(w in q for w in ["skill", "top skill"]):
        skills = context.get("top_skills", [])
        if skills:
            top = ", ".join(s["skill"] for s in skills[:5])
            return f"The top skills in your candidate pool are: **{top}**."

    if "funnel" in q or "pipeline" in q:
        funnel = context.get("hiring_funnel", [])
        if funnel:
            summary = " → ".join(f"{f['stage']}: {f['count']:,}" for f in funnel)
            return f"Hiring funnel: {summary}"

    return (
        f"I can see you have **{candidates:,} candidates** and **{jobs} jobs** in your platform. "
        f"Enable Gemini (ENABLE_GEMINI=true + GEMINI_API_KEY) for natural language AI answers to any question."
    )


def _format_context(ctx: dict) -> str:
    import json
    lines = []
    for key, value in ctx.items():
        lines.append(f"[{key}]: {json.dumps(value, default=str)[:500]}")
    return "\n".join(lines)
