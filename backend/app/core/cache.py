"""
Lightweight in-process cache with TTL.
Zero external dependencies — works on all platforms.
For multi-instance deployments, swap the backend for Redis by replacing _store.
"""
from __future__ import annotations
import time
import threading
from typing import Any, Callable, TypeVar

T = TypeVar("T")

_store: dict[str, tuple[Any, float]] = {}   # key → (value, expires_at)
_lock = threading.Lock()


def cache_get(key: str) -> Any | None:
    with _lock:
        entry = _store.get(key)
        if entry is None:
            return None
        value, expires_at = entry
        if time.time() > expires_at:
            del _store[key]
            return None
        return value


def cache_set(key: str, value: Any, ttl_seconds: int = 300) -> None:
    with _lock:
        _store[key] = (value, time.time() + ttl_seconds)


def cache_delete(key: str) -> None:
    with _lock:
        _store.pop(key, None)


def cache_clear_prefix(prefix: str) -> int:
    """Delete all keys that start with prefix. Returns count deleted."""
    with _lock:
        keys = [k for k in _store if k.startswith(prefix)]
        for k in keys:
            del _store[k]
        return len(keys)


def cached(key: str, ttl_seconds: int, fn: Callable[[], T]) -> T:
    """Get from cache or call fn() and cache the result."""
    hit = cache_get(key)
    if hit is not None:
        return hit
    result = fn()
    cache_set(key, result, ttl_seconds)
    return result
