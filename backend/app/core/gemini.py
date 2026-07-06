"""
Gemini client — production-hardened.
Uses settings.gemini_enabled (ENABLE_GEMINI=true AND GEMINI_API_KEY set).
Retries with exponential backoff. Never raises — always returns a string.
"""
from __future__ import annotations
import json
import time
from typing import Any

from app.core.config import get_settings
from app.core.logging import get_logger
from app.core.metrics import increment, record_latency, record_error

logger = get_logger(__name__)

_genai = None       # google.generativeai module
_configured = False # whether configure() has been called


def _ensure_configured() -> bool:
    """Lazy-init Gemini. Returns True if ready to use."""
    global _genai, _configured
    if _configured:
        return _genai is not None

    _configured = True
    settings = get_settings()

    if not settings.gemini_enabled:
        if settings.ENABLE_GEMINI and not settings.GEMINI_API_KEY:
            logger.warning(
                "ENABLE_GEMINI=true but GEMINI_API_KEY is not set. "
                "Add GEMINI_API_KEY=<your-key> to backend/.env"
            )
        else:
            logger.debug("Gemini disabled (ENABLE_GEMINI=false)")
        return False

    try:
        import google.generativeai as genai  # type: ignore
        genai.configure(api_key=settings.GEMINI_API_KEY)
        _genai = genai
        logger.info(
            "Gemini ready (model=%s, key=...%s)",
            settings.GEMINI_MODEL,
            settings.GEMINI_API_KEY[-4:],
        )
        return True
    except ImportError:
        logger.warning(
            "google-generativeai not installed. "
            "Run: pip install google-generativeai"
        )
    except Exception as e:
        logger.error("Gemini init failed: %s", e)
    return False


def gemini_generate(
    prompt: str,
    model: str | None = None,
    json_mode: bool = False,
) -> str:
    """
    Call Gemini with retry. Never raises — returns fallback string on failure.
    """
    settings = get_settings()
    if not _ensure_configured():
        return _fallback(json_mode, settings)

    model_name = model or settings.GEMINI_MODEL

    for attempt in range(1, settings.GEMINI_MAX_RETRIES + 1):
        t0 = time.perf_counter()
        try:
            m = _genai.GenerativeModel(model_name)
            resp = m.generate_content(
                prompt,
                generation_config={"candidate_count": 1},
                request_options={"timeout": settings.GEMINI_TIMEOUT_SECONDS},
            )
            elapsed_ms = (time.perf_counter() - t0) * 1000
            record_latency("gemini.generate", elapsed_ms)
            increment("gemini.calls")
            return resp.text

        except Exception as e:
            record_error("gemini.generate")
            if attempt < settings.GEMINI_MAX_RETRIES:
                wait = 2.0 ** (attempt - 1)
                logger.warning(
                    "Gemini attempt %d/%d failed: %s — retrying in %.0fs",
                    attempt, settings.GEMINI_MAX_RETRIES, e, wait,
                )
                time.sleep(wait)
            else:
                logger.error("Gemini failed after %d attempts: %s", settings.GEMINI_MAX_RETRIES, e)

    return _fallback(json_mode, settings)


def gemini_json(prompt: str, model: str | None = None) -> dict[str, Any]:
    """Call Gemini and parse JSON. Returns {} on any failure."""
    raw = gemini_generate(
        prompt + "\n\nRespond ONLY with valid JSON. No markdown, no backticks, no preamble.",
        model=model,
        json_mode=True,
    )
    try:
        clean = (
            raw.strip()
            .removeprefix("```json")
            .removeprefix("```")
            .removesuffix("```")
            .strip()
        )
        return json.loads(clean)
    except (json.JSONDecodeError, AttributeError):
        logger.warning("Gemini returned non-JSON: %.200s", raw[:200])
        return {}


def is_gemini_available() -> bool:
    """Check whether Gemini is configured and importable."""
    return _ensure_configured()


def _fallback(json_mode: bool, settings=None) -> str:
    if settings is None:
        settings = get_settings()
    if json_mode:
        return json.dumps({
            "status": "unavailable",
            "note": (
                "Gemini AI is not active. "
                "Set ENABLE_GEMINI=true and GEMINI_API_KEY=<key> in backend/.env"
            ),
            "insights": [],
            "recommendations": [],
        })
    return (
        "Gemini AI is not active. "
        "To enable: add ENABLE_GEMINI=true and GEMINI_API_KEY=<your-key> to backend/.env, "
        "then restart the server."
    )
