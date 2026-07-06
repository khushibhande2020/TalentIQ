"""
Centralized exception handling.
Single place for all application errors — no scattered HTTPExceptions.
"""
from __future__ import annotations
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from app.core.logging import get_logger

logger = get_logger(__name__)


class TalentIQError(Exception):
    """Base application error."""
    def __init__(self, message: str, status_code: int = 500, detail: str | None = None):
        self.message = message
        self.status_code = status_code
        self.detail = detail or message
        super().__init__(message)


class NotFoundError(TalentIQError):
    def __init__(self, resource: str, id: str = ""):
        super().__init__(f"{resource} not found: {id}", status_code=404)


class ValidationError(TalentIQError):
    def __init__(self, message: str):
        super().__init__(message, status_code=422)


class ServiceUnavailableError(TalentIQError):
    def __init__(self, service: str):
        super().__init__(
            f"{service} is not available. Check configuration.",
            status_code=503,
        )


class FileTooLargeError(TalentIQError):
    def __init__(self, max_mb: int):
        super().__init__(f"File exceeds maximum size of {max_mb}MB", status_code=413)


class RateLimitError(TalentIQError):
    def __init__(self):
        super().__init__("Rate limit exceeded. Please slow down.", status_code=429)


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(TalentIQError)
    async def talentiq_error_handler(request: Request, exc: TalentIQError):
        logger.warning("TalentIQError [%d]: %s", exc.status_code, exc.message)
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": exc.message, "detail": exc.detail},
        )

    @app.exception_handler(Exception)
    async def generic_error_handler(request: Request, exc: Exception):
        logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
        return JSONResponse(
            status_code=500,
            content={"error": "Internal server error", "detail": str(exc)},
        )
