"""
In-process metrics collection.
Tracks: request counts, latencies, error rates, agent timings.
Exposed via /health/metrics endpoint.
For production: drop-in replace with Prometheus client if desired.
"""
from __future__ import annotations
import time
import threading
from collections import defaultdict, deque
from contextlib import contextmanager
from typing import Generator

_lock = threading.Lock()

# Rolling window: last 1000 data points per metric
_latencies: dict[str, deque] = defaultdict(lambda: deque(maxlen=1000))
_counters: dict[str, int] = defaultdict(int)
_errors: dict[str, int] = defaultdict(int)


def increment(name: str, amount: int = 1) -> None:
    with _lock:
        _counters[name] += amount


def record_error(name: str) -> None:
    with _lock:
        _errors[name] += 1


def record_latency(name: str, ms: float) -> None:
    with _lock:
        _latencies[name].append(ms)


@contextmanager
def measure(name: str) -> Generator[None, None, None]:
    """Context manager that records latency for a named operation."""
    start = time.perf_counter()
    try:
        yield
    except Exception:
        record_error(name)
        raise
    finally:
        elapsed_ms = (time.perf_counter() - start) * 1000
        record_latency(name, elapsed_ms)
        increment(f"{name}.calls")


def get_metrics() -> dict:
    with _lock:
        result = {
            "counters": dict(_counters),
            "errors": dict(_errors),
            "latencies": {},
        }
        for name, values in _latencies.items():
            if values:
                lst = sorted(values)
                n = len(lst)
                result["latencies"][name] = {
                    "count": n,
                    "avg_ms": round(sum(lst) / n, 2),
                    "min_ms": round(lst[0], 2),
                    "max_ms": round(lst[-1], 2),
                    "p50_ms": round(lst[n // 2], 2),
                    "p95_ms": round(lst[int(n * 0.95)], 2),
                    "p99_ms": round(lst[int(n * 0.99)], 2),
                }
        return result
