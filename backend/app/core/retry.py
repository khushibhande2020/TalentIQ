"""
Retry decorator with exponential backoff.
Used for Gemini calls, BigQuery queries, and any flaky I/O.
"""
from __future__ import annotations
import time
import functools
from typing import Callable, TypeVar, Type
from app.core.logging import get_logger

logger = get_logger(__name__)
T = TypeVar("T")


def retry(
    max_attempts: int = 3,
    delay_seconds: float = 1.0,
    backoff: float = 2.0,
    exceptions: tuple[Type[Exception], ...] = (Exception,),
    reraise: bool = True,
):
    """
    Decorator: retry the wrapped function up to max_attempts times.
    Uses exponential backoff between attempts.
    """
    def decorator(fn: Callable[..., T]) -> Callable[..., T]:
        @functools.wraps(fn)
        def wrapper(*args, **kwargs) -> T:
            delay = delay_seconds
            last_exc: Exception | None = None
            for attempt in range(1, max_attempts + 1):
                try:
                    return fn(*args, **kwargs)
                except exceptions as e:
                    last_exc = e
                    if attempt < max_attempts:
                        logger.warning(
                            "%s failed (attempt %d/%d): %s — retrying in %.1fs",
                            fn.__name__, attempt, max_attempts, e, delay,
                        )
                        time.sleep(delay)
                        delay *= backoff
                    else:
                        logger.error("%s failed after %d attempts: %s", fn.__name__, max_attempts, e)
            if reraise and last_exc:
                raise last_exc
            return None  # type: ignore
        return wrapper
    return decorator
