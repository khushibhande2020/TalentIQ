"""
Information Retrieval Metrics.

All implementations follow standard IR literature:
  - Manning, Raghavan & Schütze (2008) Introduction to Information Retrieval
  - Järvelin & Kekäläinen (2002) — nDCG
  - Voorhees (2000) — MRR

Each function is pure (no I/O), fully typed, and independently testable.
"""
from __future__ import annotations
import math
from typing import Sequence


def precision_at_k(relevant: set[str], retrieved: list[str], k: int) -> float:
    """
    P@K = |relevant ∩ retrieved[:k]| / k

    Args:
        relevant:  set of candidate_ids considered relevant for this query
        retrieved: ordered list of retrieved candidate_ids (rank 1 first)
        k:         cutoff rank
    Returns:
        float in [0, 1]
    """
    if k <= 0:
        return 0.0
    top_k = retrieved[:k]
    hits = sum(1 for cid in top_k if cid in relevant)
    return hits / k


def recall_at_k(relevant: set[str], retrieved: list[str], k: int) -> float:
    """
    R@K = |relevant ∩ retrieved[:k]| / |relevant|

    Returns 0 if relevant set is empty (avoids divide-by-zero).
    """
    if not relevant:
        return 0.0
    top_k = retrieved[:k]
    hits = sum(1 for cid in top_k if cid in relevant)
    return hits / len(relevant)


def average_precision(relevant: set[str], retrieved: list[str]) -> float:
    """
    AP = (1 / |relevant|) * Σ P@k * rel(k)

    Used to compute MAP across queries.
    Returns 0 if relevant set is empty.
    """
    if not relevant:
        return 0.0
    hits = 0
    precision_sum = 0.0
    for i, cid in enumerate(retrieved, start=1):
        if cid in relevant:
            hits += 1
            precision_sum += hits / i
    return precision_sum / len(relevant)


def ndcg_at_k(
    graded_relevance: dict[str, int],
    retrieved: list[str],
    k: int,
) -> float:
    """
    nDCG@K = DCG@K / IDCG@K

    DCG@K  = Σ (2^rel_i - 1) / log2(i + 1)   for i in 1..k
    IDCG@K = DCG of perfect ordering (top-k most relevant first)

    Args:
        graded_relevance: dict mapping candidate_id → relevance grade (0-3)
        retrieved:        ordered retrieved list (rank 1 first)
        k:                cutoff rank
    Returns:
        float in [0, 1]
    """
    def dcg(items: list[str], grades: dict[str, int], cutoff: int) -> float:
        score = 0.0
        for i, cid in enumerate(items[:cutoff], start=1):
            rel = grades.get(cid, 0)
            score += (2 ** rel - 1) / math.log2(i + 1)
        return score

    actual_dcg = dcg(retrieved, graded_relevance, k)

    # IDCG: sort all known items by descending relevance
    ideal_order = sorted(graded_relevance.keys(), key=lambda c: graded_relevance[c], reverse=True)
    ideal_dcg = dcg(ideal_order, graded_relevance, k)

    if ideal_dcg == 0.0:
        return 0.0
    return actual_dcg / ideal_dcg


def reciprocal_rank(relevant: set[str], retrieved: list[str]) -> float:
    """
    Reciprocal Rank = 1 / rank_of_first_relevant_item

    Returns 0 if no relevant item is in the retrieved list.
    MRR is the mean of RR across multiple queries.
    """
    for i, cid in enumerate(retrieved, start=1):
        if cid in relevant:
            return 1.0 / i
    return 0.0


def mean_average_precision(
    queries: list[tuple[set[str], list[str]]]
) -> float:
    """MAP = mean of AP across all queries."""
    if not queries:
        return 0.0
    return sum(average_precision(rel, ret) for rel, ret in queries) / len(queries)


def mean_reciprocal_rank(
    queries: list[tuple[set[str], list[str]]]
) -> float:
    """MRR = mean of RR across all queries."""
    if not queries:
        return 0.0
    return sum(reciprocal_rank(rel, ret) for rel, ret in queries) / len(queries)


def f1_at_k(relevant: set[str], retrieved: list[str], k: int) -> float:
    """F1@K = 2 * P@K * R@K / (P@K + R@K)"""
    p = precision_at_k(relevant, retrieved, k)
    r = recall_at_k(relevant, retrieved, k)
    if p + r == 0:
        return 0.0
    return 2 * p * r / (p + r)


def hit_rate_at_k(relevant: set[str], retrieved: list[str], k: int) -> float:
    """HR@K = 1 if any relevant item is in top-k, else 0."""
    return 1.0 if any(cid in relevant for cid in retrieved[:k]) else 0.0
