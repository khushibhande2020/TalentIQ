"""
Embeddings service.
Wraps SentenceTransformer(all-MiniLM-L6-v2) — the model used in the notebook.
Singleton pattern so the model is loaded once per process.
"""

from __future__ import annotations
from typing import Any
import numpy as np
from sentence_transformers import SentenceTransformer

from app.core.config import get_settings
from app.core.logging import get_logger

logger = get_logger(__name__)
settings = get_settings()

_model: SentenceTransformer | None = None


def get_model() -> SentenceTransformer:
    global _model
    if _model is None:
        logger.info("Loading SentenceTransformer: %s", settings.SENTENCE_TRANSFORMER_MODEL)
        _model = SentenceTransformer(settings.SENTENCE_TRANSFORMER_MODEL)
        logger.info("SentenceTransformer loaded successfully")
    return _model


def encode_texts(texts: list[str], batch_size: int | None = None) -> np.ndarray:
    """
    Encode a list of texts into embeddings.
    Mirrors the notebook:
        embeddings = model.encode(df["combined_text"].tolist(), batch_size=256)
    """
    bs = batch_size or settings.EMBEDDING_BATCH_SIZE
    model = get_model()
    return model.encode(texts, batch_size=bs, show_progress_bar=False)


def encode_single(text: str) -> list[float]:
    """Encode a single text and return as a Python list (JSON-serialisable)."""
    model = get_model()
    return model.encode(str(text)).tolist()


def embedding_to_numpy(embedding: Any) -> np.ndarray:
    """Convert a stored JSON embedding (list / str) back to np.ndarray."""
    if isinstance(embedding, np.ndarray):
        return embedding
    if isinstance(embedding, list):
        return np.array(embedding, dtype=np.float32)
    if isinstance(embedding, str):
        import json
        return np.array(json.loads(embedding), dtype=np.float32)
    raise ValueError(f"Unsupported embedding type: {type(embedding)}")
