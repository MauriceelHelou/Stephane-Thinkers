import os
from dotenv import load_dotenv

# Load environment variables before other imports
load_dotenv()

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

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
)
from app.routes import test as test_routes
from app.security import require_auth

# Determine environment
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
is_production = ENVIRONMENT == "production"

from app.constants import API_VERSION

app = FastAPI(
    title="Intellectual Genealogy API",
    description="API for mapping intellectual history",
    version=API_VERSION,
    # Disable docs in production for security (optional)
    docs_url="/docs" if not is_production else None,
    redoc_url="/redoc" if not is_production else None,
)

# CORS configuration
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

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"],
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
