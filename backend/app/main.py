import os
import time
import logging
import uuid
from collections import defaultdict
from dotenv import load_dotenv

# Load environment variables before other imports
load_dotenv()

# Configure structured logging early
from app.logging_config import configure_logging, set_correlation_id, reset_correlation_id
configure_logging()

from fastapi import Depends, FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from app.routes import (
    thinkers,
    connections,
    publications,
    quotes,
    tags,
    note_tags,
    timelines,
    timeline_events,
    combined_timeline_views,
    institutions,
    notes,
    research_questions,
    ai,
    quiz,
    auth,
    folders,
    critical_terms,
    analysis,
    backup,
    ingestion,
    jobs,
    notion,
)
from app.routes import test as test_routes
from app.security import require_auth

logger = logging.getLogger(__name__)

# Determine environment
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
is_production = ENVIRONMENT == "production"

from app.constants import API_VERSION

# ---------------------------------------------------------------------------
# Sentry integration (opt-in via SENTRY_DSN env var)
# ---------------------------------------------------------------------------
SENTRY_DSN = os.getenv("SENTRY_DSN", "")
if SENTRY_DSN and is_production:
    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration

        sentry_sdk.init(
            dsn=SENTRY_DSN,
            environment=ENVIRONMENT,
            traces_sample_rate=float(os.getenv("SENTRY_TRACES_SAMPLE_RATE", "0.1")),
            integrations=[FastApiIntegration(), SqlalchemyIntegration()],
            send_default_pii=False,  # Never send PII
        )
        logger.info("Sentry initialized for environment=%s", ENVIRONMENT)
    except ImportError:
        logger.warning("sentry-sdk not installed; Sentry integration disabled")

# ---------------------------------------------------------------------------
# Rate limiting middleware
# ---------------------------------------------------------------------------

# Route-class rate limits (requests per minute per client IP).
RATE_LIMITS: dict[str, int] = {
    "/api/auth/": int(os.getenv("RATE_LIMIT_AUTH", "20")),
    "/api/backup/": int(os.getenv("RATE_LIMIT_BACKUP", "30")),
    "/api/ai/": int(os.getenv("RATE_LIMIT_AI", "60")),
    "/api/notion/": int(os.getenv("RATE_LIMIT_NOTION", "20")),
}
DEFAULT_RATE_LIMIT = int(os.getenv("RATE_LIMIT_DEFAULT", "300"))

# In-memory token bucket (per IP + route class).
_rate_buckets: dict[str, list[float]] = defaultdict(list)
_RATE_WINDOW = 60.0  # seconds


def _get_route_class(path: str) -> str:
    for prefix in RATE_LIMITS:
        if path.startswith(prefix):
            return prefix
    return "default"


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Skip rate limiting in test/development unless explicitly enabled
        if not is_production and not os.getenv("RATE_LIMIT_ENABLED"):
            return await call_next(request)

        client_ip = request.client.host if request.client else "unknown"
        route_class = _get_route_class(request.url.path)
        limit = RATE_LIMITS.get(route_class, DEFAULT_RATE_LIMIT)
        bucket_key = f"{client_ip}:{route_class}"

        now = time.monotonic()
        # Prune old entries
        _rate_buckets[bucket_key] = [
            t for t in _rate_buckets[bucket_key] if now - t < _RATE_WINDOW
        ]

        if len(_rate_buckets[bucket_key]) >= limit:
            logger.warning(
                "Rate limit exceeded: client=%s route_class=%s limit=%d",
                client_ip, route_class, limit,
            )
            return Response(
                content='{"detail":"Rate limit exceeded"}',
                status_code=429,
                media_type="application/json",
                headers={"Retry-After": "60"},
            )

        _rate_buckets[bucket_key].append(now)
        return await call_next(request)


class CorrelationIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        incoming_id = request.headers.get("X-Correlation-ID", "").strip()
        correlation_id = incoming_id or str(uuid.uuid4())
        token = set_correlation_id(correlation_id)
        try:
            response = await call_next(request)
        finally:
            reset_correlation_id(token)

        response.headers["X-Correlation-ID"] = correlation_id
        return response


app = FastAPI(
    title="Intellectual Genealogy API",
    description="API for mapping intellectual history",
    version=API_VERSION,
    # Disable docs in production for security (optional)
    docs_url="/docs" if not is_production else None,
    redoc_url="/redoc" if not is_production else None,
)

# Correlation IDs for structured logging
app.add_middleware(CorrelationIdMiddleware)

# Rate limiting
app.add_middleware(RateLimitMiddleware)

# CORS configuration — tightened headers for production
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3010")

# Build list of allowed origins
allowed_origins = [FRONTEND_URL]

# In development, also allow common local development URLs
if not is_production:
    allowed_origins.extend([
        "http://localhost:3000",
        "http://localhost:3010",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3010",
    ])

# Remove duplicates while preserving order
allowed_origins = list(dict.fromkeys(allowed_origins))

# Explicit header lists (no wildcards in production)
ALLOWED_HEADERS = [
    "Authorization",
    "Content-Type",
    "Accept",
    "Origin",
    "X-Requested-With",
    "X-Correlation-ID",
]
EXPOSED_HEADERS = [
    "Content-Disposition",
    "Content-Length",
    "Retry-After",
    "X-Correlation-ID",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=ALLOWED_HEADERS,
    expose_headers=EXPOSED_HEADERS,
)

# Protect all non-auth API routers with server-side auth.
protected_dependencies = [Depends(require_auth)]

app.include_router(timelines.router, dependencies=protected_dependencies)
app.include_router(timeline_events.router, dependencies=protected_dependencies)
app.include_router(combined_timeline_views.router, dependencies=protected_dependencies)
app.include_router(thinkers.router, dependencies=protected_dependencies)
app.include_router(connections.router, dependencies=protected_dependencies)
app.include_router(publications.router, dependencies=protected_dependencies)
app.include_router(quotes.router, dependencies=protected_dependencies)
app.include_router(tags.router, dependencies=protected_dependencies)
app.include_router(note_tags.router, dependencies=protected_dependencies)
app.include_router(institutions.router, dependencies=protected_dependencies)
app.include_router(notes.router, dependencies=protected_dependencies)
app.include_router(folders.router, dependencies=protected_dependencies)
app.include_router(research_questions.router, dependencies=protected_dependencies)
app.include_router(critical_terms.router, dependencies=protected_dependencies)
app.include_router(analysis.router, dependencies=protected_dependencies)
app.include_router(ingestion.router, dependencies=protected_dependencies)
app.include_router(jobs.router, dependencies=protected_dependencies)
app.include_router(ai.router, dependencies=protected_dependencies)
app.include_router(quiz.router, dependencies=protected_dependencies)
app.include_router(backup.router, dependencies=protected_dependencies)
app.include_router(notion.router, dependencies=protected_dependencies)
app.include_router(auth.router)

# Only include test routes in explicit test environment.
if ENVIRONMENT == "test":
    app.include_router(test_routes.router)

@app.get("/")
def read_root():
    return {"message": "Intellectual Genealogy API", "version": API_VERSION}

@app.get("/health")
def health_check():
    return {"status": "healthy"}


@app.get("/api/health")
def api_health_check():
    return {"status": "healthy"}
