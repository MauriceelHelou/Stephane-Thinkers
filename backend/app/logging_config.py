"""
Structured JSON logging configuration.

Provides correlation IDs, structured audit logging, and environment-based
log levels for production observability.
"""
import json
import logging
import os
import sys
from contextvars import ContextVar, Token
from datetime import datetime, timezone
from typing import Optional


_correlation_id_ctx: ContextVar[Optional[str]] = ContextVar("correlation_id", default=None)


def set_correlation_id(correlation_id: Optional[str]) -> Token:
    return _correlation_id_ctx.set(correlation_id)


def reset_correlation_id(token: Token) -> None:
    _correlation_id_ctx.reset(token)


class JSONFormatter(logging.Formatter):
    """Format log records as single-line JSON for structured log ingestion."""

    def format(self, record: logging.LogRecord) -> str:
        log_entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }

        # Add correlation ID if available
        correlation_id = getattr(record, "correlation_id", None) or _correlation_id_ctx.get()
        if correlation_id:
            log_entry["correlation_id"] = correlation_id

        # Add any extra fields from the record
        for key in (
            "event",
            "client_ip",
            "total_rows",
            "size_bytes",
            "elapsed_seconds",
            "filename",
            "backup_filename",
            "backup_version",
            "artifact_id",
        ):
            val = getattr(record, key, None)
            if val is not None:
                log_entry[key] = val

        # Add exception info if present
        if record.exc_info and record.exc_info[1]:
            log_entry["exception"] = self.formatException(record.exc_info)

        return json.dumps(log_entry, default=str)


def configure_logging() -> None:
    """Configure application logging.

    - Production: JSON-formatted, INFO level
    - Development: standard human-readable, DEBUG level
    """
    environment = os.getenv("ENVIRONMENT", "development")
    is_production = environment == "production"
    log_level = os.getenv("LOG_LEVEL", "INFO" if is_production else "DEBUG")

    root = logging.getLogger()
    root.setLevel(getattr(logging, log_level.upper(), logging.INFO))

    # Remove existing handlers
    root.handlers.clear()

    handler = logging.StreamHandler(sys.stdout)

    if is_production:
        handler.setFormatter(JSONFormatter())
    else:
        handler.setFormatter(logging.Formatter(
            "%(asctime)s %(levelname)-5s [%(name)s] %(message)s",
            datefmt="%H:%M:%S",
        ))

    root.addHandler(handler)

    # Reduce noise from third-party libraries
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)
