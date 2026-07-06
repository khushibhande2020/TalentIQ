"""
GPU Benchmark endpoint.
Runs CPU vs GPU benchmarks and returns timing comparison.
Always works — GPU section is skipped gracefully if no CUDA available.
"""
from __future__ import annotations
import time
import numpy as np
from fastapi import APIRouter
from app.core.config import get_settings
from app.core.gpu_analytics import get_dataframe_engine, GPU_AVAILABLE
from app.core.logging import get_logger

logger = get_logger(__name__)
settings = get_settings()
router = APIRouter(prefix="/gpu-benchmark", tags=["gpu"])

SIZES = [1_000, 10_000, 50_000]


@router.get("")
def get_gpu_benchmark():
    """Run multi-size CPU vs GPU benchmark and return full comparison."""
    results = []

    for size in SIZES:
        cpu_ms = _run_cpu_benchmark(size)
        gpu_ms = _run_gpu_benchmark(size) if settings.ENABLE_GPU_ACCELERATION else None

        results.append({
            "size": size,
            "size_label": f"{size:,} rows",
            "cpu_ms": round(cpu_ms, 2),
            "gpu_ms": round(gpu_ms, 2) if gpu_ms is not None else None,
            "speedup": round(cpu_ms / gpu_ms, 2) if gpu_ms and gpu_ms > 0 else None,
        })

    # Embedding throughput benchmark
    embed_result = _embedding_benchmark()

    return {
        "gpu_available": GPU_AVAILABLE,
        "gpu_acceleration_enabled": settings.ENABLE_GPU_ACCELERATION,
        "dataframe_engine": get_dataframe_engine(),
        "benchmark_results": results,
        "embedding_benchmark": embed_result,
        "note": (
            "GPU benchmarks require ENABLE_GPU_ACCELERATION=true and NVIDIA CUDA GPU + cuDF installed."
            if not GPU_AVAILABLE
            else f"GPU acceleration active via {get_dataframe_engine()}"
        ),
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
    }


def _run_cpu_benchmark(size: int) -> float:
    import pandas as pd
    t0 = time.perf_counter()
    df = pd.DataFrame({
        "a": np.random.rand(size),
        "b": np.random.rand(size),
        "c": np.random.randint(0, 10, size),
    })
    _ = df.groupby("c").agg({"a": "mean", "b": "std"})
    _ = df["a"].corr(df["b"])
    _ = df.sort_values("a").reset_index(drop=True)
    return (time.perf_counter() - t0) * 1000


def _run_gpu_benchmark(size: int) -> float | None:
    try:
        import cudf  # type: ignore
        import cupy as cp  # type: ignore
        t0 = time.perf_counter()
        df = cudf.DataFrame({
            "a": cp.random.rand(size),
            "b": cp.random.rand(size),
            "c": cp.random.randint(0, 10, size),
        })
        _ = df.groupby("c").agg({"a": "mean", "b": "std"})
        _ = df["a"].corr(df["b"])
        _ = df.sort_values("a").reset_index(drop=True)
        return (time.perf_counter() - t0) * 1000
    except ImportError:
        return None
    except Exception as e:
        logger.warning("GPU benchmark error: %s", e)
        return None


def _embedding_benchmark() -> dict:
    """Benchmark SentenceTransformer encode speed."""
    try:
        from app.services.embeddings import get_model
        texts = [
            "Python developer with machine learning experience",
            "Senior data engineer with Spark and BigQuery",
            "Full stack developer React TypeScript Node.js",
        ] * 10  # 30 texts
        model = get_model()
        t0 = time.perf_counter()
        _ = model.encode(texts, batch_size=32, show_progress_bar=False)
        elapsed = (time.perf_counter() - t0) * 1000
        return {
            "texts_encoded": len(texts),
            "total_ms": round(elapsed, 1),
            "ms_per_text": round(elapsed / len(texts), 2),
            "texts_per_second": round(len(texts) / (elapsed / 1000), 1),
        }
    except Exception as e:
        return {"error": str(e)}
