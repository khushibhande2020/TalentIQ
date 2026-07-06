"""
Job analysis service.
Mirrors the notebook's analyze_job_description / generate_job_embedding functions.
Uses spaCy for NER and SentenceTransformer for embeddings.
"""

from __future__ import annotations
from typing import Any

from app.core.config import get_settings
from app.core.logging import get_logger
from app.services.embeddings import encode_single
from app.services.preprocessing import preprocess_text

logger = get_logger(__name__)
settings = get_settings()

_nlp = None


def get_nlp():
    global _nlp
    if _nlp is None:
        import spacy
        try:
            logger.info("Loading spaCy model: %s", settings.SPACY_MODEL)
            _nlp = spacy.load(settings.SPACY_MODEL)
        except OSError:
            logger.warning("spaCy model not found. Running: python -m spacy download en_core_web_sm")
            import subprocess, sys
            subprocess.run([sys.executable, "-m", "spacy", "download", "en_core_web_sm"], check=True)
            _nlp = spacy.load(settings.SPACY_MODEL)
    return _nlp


def analyze_job_description(job_description: str) -> list[tuple[str, str]]:
    """
    Extract named entities from job description.
    Mirrors notebook: entities = [(ent.text, ent.label_) for ent in doc.ents]
    """
    nlp = get_nlp()
    doc = nlp(str(job_description))
    return [(ent.text, ent.label_) for ent in doc.ents]


def generate_job_embedding(job_description: str) -> list[float]:
    """
    Generate embedding for a job description.
    Mirrors notebook: model.encode(str(job_description)).tolist()
    """
    return encode_single(str(job_description))


def process_job(job_description: str) -> dict[str, Any]:
    """Full job-side processing pipeline."""
    preprocessed = preprocess_text(job_description)
    entities = analyze_job_description(job_description)
    embedding = generate_job_embedding(preprocessed)
    return {
        "preprocessed_text": preprocessed,
        "entities": [{"text": e[0], "label": e[1]} for e in entities],
        "embedding": embedding,
    }
