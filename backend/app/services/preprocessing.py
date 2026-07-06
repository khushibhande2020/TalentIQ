"""
Preprocessing service.
Replicates the notebook's text-cleaning pipeline:
  - word_tokenize → keep alphabetic → remove stop words → join
"""

from __future__ import annotations
import re
from typing import Any

import nltk
import pandas as pd
from nltk.corpus import stopwords
from nltk.tokenize import word_tokenize

from app.core.logging import get_logger

logger = get_logger(__name__)

# Download NLTK resources once at import time
for _pkg in ("punkt", "punkt_tab", "stopwords"):
    try:
        nltk.download(_pkg, quiet=True)
    except Exception:
        pass

_STOP_WORDS: set[str] = set(stopwords.words("english"))


# ── Low-level helpers ─────────────────────────────────────────────────────────

def preprocess_text(text: Any) -> str:
    """
    Tokenise, lowercase, keep only alphabetic tokens, remove stop-words.
    Mirrors the notebook's `preprocess_text` function exactly.
    """
    if pd.isna(text) or text is None:
        return ""
    tokens = word_tokenize(str(text).lower())
    tokens = [t for t in tokens if t.isalpha()]
    tokens = [t for t in tokens if t not in _STOP_WORDS]
    return " ".join(tokens)


def convert_career(history: Any) -> str:
    """
    Flatten career_history list into a single string.
    Mirrors the notebook's `convert_career` function.
    """
    if not isinstance(history, list):
        return ""
    return " ".join(
        f"{job.get('title', '')} {job.get('company', '')} {job.get('description', '')}"
        for job in history
    )


def flatten_field(value: Any) -> str:
    """Recursively stringify a dict / list field into plain text."""
    if value is None:
        return ""
    if isinstance(value, list):
        return " ".join(flatten_field(v) for v in value)
    if isinstance(value, dict):
        return " ".join(f"{k} {flatten_field(v)}" for k, v in value.items())
    return str(value)


# ── Candidate text builder ────────────────────────────────────────────────────

def build_combined_text(candidate_data: dict[str, Any]) -> str:
    """
    Build the combined_text used for TF-IDF + embedding.
    Mirrors the notebook:
        df["combined_text"] = (
            df["profile"] + " " + df["career_history"] + " " +
            df["skills"] + " " + df["education"]
        )
    """
    profile = flatten_field(candidate_data.get("profile", {}))
    career = convert_career(candidate_data.get("career_history", []))
    skills = flatten_field(candidate_data.get("skills", []))
    education = flatten_field(candidate_data.get("education", []))
    certifications = flatten_field(candidate_data.get("certifications", []))
    languages = flatten_field(candidate_data.get("languages", []))

    raw = f"{profile} {career} {skills} {education} {certifications} {languages}"
    return preprocess_text(raw)


def extract_profile_fields(candidate_data: dict[str, Any]) -> dict[str, Any]:
    """Unpack the nested profile dict into flat fields."""
    profile = candidate_data.get("profile", {}) or {}
    return {
        "anonymized_name": profile.get("anonymized_name"),
        "headline": profile.get("headline"),
        "summary": profile.get("summary"),
        "location": profile.get("location"),
        "country": profile.get("country"),
        "years_of_experience": profile.get("years_of_experience"),
        "current_title": profile.get("current_title"),
        "current_company": profile.get("current_company"),
        "current_company_size": profile.get("current_company_size"),
        "current_industry": profile.get("current_industry"),
    }
