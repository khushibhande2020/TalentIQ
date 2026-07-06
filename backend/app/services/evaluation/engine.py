"""
TalentIQ AI Evaluation Engine
==============================
Orchestrates all evaluation metrics into a single, cacheable run.

Metrics produced
----------------
Retrieval Quality (IR metrics against proxy ground-truth):
  • Precision@5, Precision@10
  • Recall@5, Recall@10
  • NDCG@5, NDCG@10
  • MRR (Mean Reciprocal Rank)
  • MAP (Mean Average Precision)
  • Hit Rate@5, Hit Rate@10

Parsing Quality:
  • Resume parsing field coverage (% of expected fields present)
  • Skill extraction rate

System Performance:
  • TF-IDF vectorization time
  • Semantic embedding time
  • End-to-end matching pipeline time
  • Gemini success rate (from in-process metrics)
  • GPU vs CPU benchmark

Methodology: see validation_dataset.py
"""
from __future__ import annotations

import time
import statistics
from typing import Any

import numpy as np
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.logging import get_logger
from app.core.metrics import get_metrics, measure
from app.models.candidate import Candidate
from app.services.evaluation.ir_metrics import (
    precision_at_k,
    recall_at_k,
    ndcg_at_k,
    reciprocal_rank,
    average_precision,
    hit_rate_at_k,
)
from app.services.evaluation.relevance_scorer import build_relevance_judgments
from app.services.evaluation.validation_dataset import VALIDATION_QUERIES
from app.services.preprocessing import preprocess_text
from app.services.embeddings import get_model, encode_texts

logger = get_logger(__name__)
settings = get_settings()

# How many candidates to evaluate against per query (balance speed vs accuracy)
EVAL_CANDIDATE_LIMIT = 2000
K_VALUES = [5, 10]


# ── Candidate loader ──────────────────────────────────────────────────────────

def _load_candidates_for_eval(db: Session) -> list[dict[str, Any]]:
    """
    Load a representative sample of candidates for evaluation.
    Returns only the fields needed by the relevance scorer — fast.
    """
    rows = (
        db.query(
            Candidate.candidate_id,
            Candidate.current_title,
            Candidate.current_industry,
            Candidate.years_of_experience,
            Candidate.skills,
            Candidate.combined_text,
            Candidate.embedding,
        )
        .filter(Candidate.combined_text.isnot(None))
        .limit(EVAL_CANDIDATE_LIMIT)
        .all()
    )
    return [
        {
            "candidate_id": r.candidate_id,
            "current_title": r.current_title,
            "years_of_experience": r.years_of_experience,
            "skills": r.skills or [],
            "combined_text": r.combined_text or "",
            "embedding": r.embedding,
        }
        for r in rows
    ]


# ── Per-query matching ────────────────────────────────────────────────────────

def _run_query_matching(
    query: dict[str, Any],
    candidates: list[dict[str, Any]],
) -> tuple[list[str], dict[str, float], dict[str, float]]:
    """
    Run TF-IDF + semantic matching for one validation query.
    Returns (ranked_ids, tfidf_timing, semantic_timing).
    """
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity
    from app.services.embeddings import embedding_to_numpy

    texts = [c["combined_text"] for c in candidates]
    job_text = preprocess_text(query["description"])

    # Stage 1: TF-IDF
    t0 = time.perf_counter()
    vectorizer = TfidfVectorizer(max_features=settings.TFIDF_MAX_FEATURES)
    X = vectorizer.fit_transform(texts)
    job_vec = vectorizer.transform([job_text])
    tfidf_scores = cosine_similarity(job_vec, X)[0].astype(np.float32)
    tfidf_ms = (time.perf_counter() - t0) * 1000

    # Stage 2: Semantic
    t0 = time.perf_counter()
    model = get_model()
    job_emb = model.encode(job_text, show_progress_bar=False).astype(np.float32)

    emb_matrix = np.vstack([
        embedding_to_numpy(c["embedding"]).astype(np.float32)
        if c["embedding"]
        else np.zeros(384, dtype=np.float32)
        for c in candidates
    ])
    semantic_scores = cosine_similarity(job_emb.reshape(1, -1), emb_matrix)[0].astype(np.float32)
    semantic_ms = (time.perf_counter() - t0) * 1000

    # Combine
    combined = (tfidf_scores + semantic_scores) * 0.5
    top_idx = np.argsort(combined)[::-1]
    ranked_ids = [candidates[i]["candidate_id"] for i in top_idx]

    return ranked_ids, tfidf_ms, semantic_ms


# ── Resume parsing quality ────────────────────────────────────────────────────

def _compute_parsing_quality(db: Session) -> dict[str, Any]:
    """
    Measures field coverage — what % of expected profile fields are populated.
    A fully parsed resume should have all critical fields.
    """
    CRITICAL_FIELDS = [
        "anonymized_name", "headline", "summary", "location",
        "years_of_experience", "current_title", "current_company",
        "current_industry", "skills", "career_history", "education",
    ]
    sample = (
        db.query(Candidate)
        .filter(Candidate.combined_text.isnot(None))
        .limit(500)
        .all()
    )
    if not sample:
        return {"field_coverage_pct": 0.0, "skill_extraction_rate": 0.0, "sample_size": 0}

    field_scores = []
    skill_counts = []

    for c in sample:
        populated = sum(
            1 for f in CRITICAL_FIELDS
            if getattr(c, f, None) not in (None, "", [], {})
        )
        field_scores.append(populated / len(CRITICAL_FIELDS))
        skill_counts.append(len(c.skills or []))

    avg_coverage = statistics.mean(field_scores)
    candidates_with_skills = sum(1 for c in sample if c.skills)
    skill_extraction_rate = candidates_with_skills / len(sample)
    avg_skills_per_resume = statistics.mean(skill_counts)

    return {
        "field_coverage_pct": round(avg_coverage * 100, 2),
        "skill_extraction_rate": round(skill_extraction_rate * 100, 2),
        "avg_skills_per_resume": round(avg_skills_per_resume, 1),
        "sample_size": len(sample),
        "methodology": "Field coverage = % of 11 critical profile fields populated across 500-candidate sample",
    }


# ── GPU benchmark ─────────────────────────────────────────────────────────────

def _run_gpu_benchmark() -> dict[str, Any]:
    """
    Benchmarks matrix operations with pandas vs cuDF (if available).
    Returns timing for both, plus speedup ratio.
    """
    import pandas as pd

    SIZE = 10_000

    # CPU benchmark (pandas)
    t0 = time.perf_counter()
    df = pd.DataFrame({"a": np.random.rand(SIZE), "b": np.random.rand(SIZE)})
    _ = df["a"].corr(df["b"])
    _ = df.groupby(pd.cut(df["a"], bins=10)).mean()
    cpu_ms = (time.perf_counter() - t0) * 1000

    # GPU benchmark (cuDF if available)
    gpu_ms = None
    gpu_available = False
    speedup = None

    if settings.ENABLE_GPU_ACCELERATION:
        try:
            import cudf  # type: ignore
            import cupy as cp  # type: ignore
            t0 = time.perf_counter()
            gdf = cudf.DataFrame({"a": cp.random.rand(SIZE), "b": cp.random.rand(SIZE)})
            _ = gdf["a"].corr(gdf["b"])
            _ = gdf.groupby(cudf.cut(gdf["a"], bins=10)).mean()
            gpu_ms = round((time.perf_counter() - t0) * 1000, 2)
            gpu_available = True
            speedup = round(cpu_ms / gpu_ms, 2) if gpu_ms > 0 else None
        except ImportError:
            pass
        except Exception as e:
            logger.warning("GPU benchmark error: %s", e)

    return {
        "cpu_pandas_ms": round(cpu_ms, 2),
        "gpu_cudf_ms": gpu_ms,
        "gpu_available": gpu_available,
        "speedup_ratio": speedup,
        "benchmark_size": SIZE,
        "note": "Benchmark: 10K-row DataFrame — correlation + groupby aggregation",
    }


# ── Gemini success rate ───────────────────────────────────────────────────────

def _compute_gemini_stats() -> dict[str, Any]:
    """
    Derives Gemini success rate from in-process metrics collected during runtime.
    """
    metrics = get_metrics()
    counters = metrics.get("counters", {})
    errors = metrics.get("errors", {})
    latencies = metrics.get("latencies", {})

    # Sum all agent calls (all go through gemini)
    total_agent_calls = sum(
        v for k, v in counters.items()
        if k.endswith(".calls") and k.startswith("agent.")
    )
    total_agent_errors = sum(
        v for k, v in errors.items()
        if k.startswith("agent.")
    )

    success_rate = (
        round((total_agent_calls - total_agent_errors) / total_agent_calls * 100, 1)
        if total_agent_calls > 0
        else None
    )

    # Gemini latency from agent timings
    gemini_latencies = {
        k: v for k, v in latencies.items()
        if k.startswith("agent.")
    }
    avg_gemini_ms = None
    if gemini_latencies:
        all_avgs = [v["avg_ms"] for v in gemini_latencies.values()]
        avg_gemini_ms = round(statistics.mean(all_avgs), 1)

    return {
        "total_agent_calls": total_agent_calls,
        "total_agent_errors": total_agent_errors,
        "success_rate_pct": success_rate,
        "avg_response_ms": avg_gemini_ms,
        "enabled": settings.ENABLE_GEMINI,
        "model": settings.GEMINI_MODEL,
        "note": "Derived from in-process metrics. Run agent calls to populate." if total_agent_calls == 0 else None,
    }


# ── System performance ────────────────────────────────────────────────────────

def _compute_system_performance() -> dict[str, Any]:
    """Extract API latency stats from in-process metrics."""
    metrics = get_metrics()
    latencies = metrics.get("latencies", {})

    def _extract(key: str) -> dict | None:
        data = latencies.get(key)
        if not data:
            return None
        return {
            "avg_ms": data["avg_ms"],
            "p50_ms": data["p50_ms"],
            "p95_ms": data["p95_ms"],
            "p99_ms": data["p99_ms"],
            "count": data["count"],
        }

    return {
        "matching_pipeline": _extract("matching.load_candidates"),
        "tfidf_stage": _extract("matching.tfidf"),
        "semantic_stage": _extract("matching.semantic"),
        "ranking_persist": _extract("matching.persist"),
        "analytics_api": _extract("api.analytics"),
        "http_overall": _extract("http.post"),
    }


# ── Master evaluation runner ──────────────────────────────────────────────────

def run_full_evaluation(db: Session) -> dict[str, Any]:
    """
    Run the complete evaluation suite. Takes 30–120 seconds depending on pool size.
    Returns a comprehensive metrics report.
    """
    logger.info("Starting full evaluation run (candidate_limit=%d)", EVAL_CANDIDATE_LIMIT)
    eval_start = time.perf_counter()

    # ── 1. Load candidates ────────────────────────────────────────────────────
    with measure("eval.load_candidates"):
        candidates = _load_candidates_for_eval(db)

    n_candidates = len(candidates)
    logger.info("Loaded %d candidates for evaluation", n_candidates)

    if n_candidates < 50:
        return {
            "error": "Insufficient candidates for evaluation",
            "detail": f"Found {n_candidates} candidates. Need at least 50. Upload more data.",
            "status": "insufficient_data",
        }

    # ── 2. IR metrics across all validation queries ───────────────────────────
    query_results: list[dict[str, Any]] = []
    all_tfidf_ms: list[float] = []
    all_semantic_ms: list[float] = []

    for query in VALIDATION_QUERIES:
        logger.info("Evaluating query: %s", query["query_id"])

        try:
            # Build proxy ground truth
            relevant_ids, graded = build_relevance_judgments(
                candidates, query, relevant_threshold_grade=2
            )

            if not relevant_ids:
                logger.debug("Query %s: no relevant candidates found — skipping", query["query_id"])
                continue

            # Run matching
            ranked_ids, tfidf_ms, semantic_ms = _run_query_matching(query, candidates)
            all_tfidf_ms.append(tfidf_ms)
            all_semantic_ms.append(semantic_ms)

            # Compute IR metrics at K=5 and K=10
            q_metrics: dict[str, Any] = {
                "query_id": query["query_id"],
                "query_title": query["title"],
                "n_relevant": len(relevant_ids),
                "n_retrieved": len(ranked_ids),
                "tfidf_ms": round(tfidf_ms, 1),
                "semantic_ms": round(semantic_ms, 1),
                "rr": round(reciprocal_rank(relevant_ids, ranked_ids), 4),
                "ap": round(average_precision(relevant_ids, ranked_ids), 4),
            }
            for k in K_VALUES:
                q_metrics[f"p@{k}"]    = round(precision_at_k(relevant_ids, ranked_ids, k), 4)
                q_metrics[f"r@{k}"]    = round(recall_at_k(relevant_ids, ranked_ids, k), 4)
                q_metrics[f"ndcg@{k}"] = round(ndcg_at_k(graded, ranked_ids, k), 4)
                q_metrics[f"hr@{k}"]   = round(hit_rate_at_k(relevant_ids, ranked_ids, k), 4)

            query_results.append(q_metrics)

        except Exception as e:
            logger.warning("Query %s evaluation failed: %s", query["query_id"], e)

    # ── 3. Aggregate IR metrics ───────────────────────────────────────────────
    def _mean(key: str) -> float:
        vals = [q[key] for q in query_results if key in q]
        return round(statistics.mean(vals), 4) if vals else 0.0

    aggregated_ir: dict[str, Any] = {
        "num_queries_evaluated": len(query_results),
        "mrr": _mean("rr"),
        "map": _mean("ap"),
    }
    for k in K_VALUES:
        aggregated_ir[f"precision@{k}"]  = _mean(f"p@{k}")
        aggregated_ir[f"recall@{k}"]     = _mean(f"r@{k}")
        aggregated_ir[f"ndcg@{k}"]       = _mean(f"ndcg@{k}")
        aggregated_ir[f"hit_rate@{k}"]   = _mean(f"hr@{k}")

    # ── 4. Parsing quality ────────────────────────────────────────────────────
    with measure("eval.parsing_quality"):
        parsing = _compute_parsing_quality(db)

    # ── 5. GPU benchmark ──────────────────────────────────────────────────────
    with measure("eval.gpu_benchmark"):
        gpu_benchmark = _run_gpu_benchmark()

    # ── 6. Gemini stats ───────────────────────────────────────────────────────
    gemini_stats = _compute_gemini_stats()

    # ── 7. System performance ─────────────────────────────────────────────────
    system_perf = _compute_system_performance()

    # ── 8. Timing stats ───────────────────────────────────────────────────────
    avg_tfidf_ms = round(statistics.mean(all_tfidf_ms), 1) if all_tfidf_ms else None
    avg_semantic_ms = round(statistics.mean(all_semantic_ms), 1) if all_semantic_ms else None
    total_eval_ms = round((time.perf_counter() - eval_start) * 1000, 0)

    # ── 9. Assemble report ────────────────────────────────────────────────────
    report = {
        "status": "ok",
        "evaluated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "candidate_pool_size": n_candidates,
        "eval_candidate_sample": EVAL_CANDIDATE_LIMIT,
        "total_eval_time_ms": total_eval_ms,

        "ir_metrics": aggregated_ir,
        "per_query_results": query_results,

        "parsing_quality": parsing,

        "performance": {
            "avg_tfidf_ms": avg_tfidf_ms,
            "avg_semantic_ms": avg_semantic_ms,
            "avg_e2e_query_ms": round(
                (avg_tfidf_ms or 0) + (avg_semantic_ms or 0), 1
            ),
            "system": system_perf,
        },

        "gemini": gemini_stats,
        "gpu_benchmark": gpu_benchmark,

        "methodology": {
            "ground_truth": "Proxy relevance labels (no human annotations available)",
            "relevance_formula": "0.6 × skill_overlap + 0.2 × experience_fit + 0.2 × title_similarity",
            "relevance_threshold": "Grade ≥ 2 for binary metrics (P@K, R@K, MRR)",
            "graded_relevance": "0=irrelevant, 1=partial, 2=relevant, 3=highly relevant (for nDCG)",
            "validation_queries": len(VALIDATION_QUERIES),
            "references": [
                "Manning, Raghavan & Schütze (2008) — Introduction to Information Retrieval",
                "Järvelin & Kekäläinen (2002) — nDCG",
                "Voorhees (2000) — MRR",
            ],
        },
    }

    logger.info("Evaluation complete in %.0f ms", total_eval_ms)
    return report
