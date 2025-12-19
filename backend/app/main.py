import os
from dotenv import load_dotenv

# Load environment variables before other imports
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes import thinkers, connections, publications, quotes, tags, timelines, timeline_events, combined_timeline_views, institutions, notes, research_questions, ai, quiz, auth
from app.routes import test as test_routes

# Determine environment
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
is_production = ENVIRONMENT == "production"

app = FastAPI(
    title="Intellectual Genealogy API",
    description="API for mapping intellectual history",
    version="1.0.1",
    # Disable docs in production for security (optional)
    docs_url="/docs" if not is_production else None,
    redoc_url="/redoc" if not is_production else None,
)

# CORS configuration
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3001")

# Build list of allowed origins
allowed_origins = [FRONTEND_URL]

# In development, also allow common local development URLs
if not is_production:
    allowed_origins.extend([
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
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

app.include_router(timelines.router)
app.include_router(timeline_events.router)
app.include_router(combined_timeline_views.router)
app.include_router(thinkers.router)
app.include_router(connections.router)
app.include_router(publications.router)
app.include_router(quotes.router)
app.include_router(tags.router)
app.include_router(institutions.router)
app.include_router(notes.router)
app.include_router(research_questions.router)
app.include_router(ai.router)
app.include_router(quiz.router)
app.include_router(auth.router)

# Only include test routes in development
if not is_production:
    app.include_router(test_routes.router)

@app.get("/")
def read_root():
    return {"message": "Intellectual Genealogy API", "version": "1.0.0"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}

