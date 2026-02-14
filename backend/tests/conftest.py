"""
Pytest configuration and fixtures for backend tests.
"""
import os
import pytest
from typing import Generator
from uuid import uuid4

# Set test environment before imports
os.environ["DATABASE_URL"] = "sqlite:///./test_db.db"
os.environ["ENVIRONMENT"] = "test"
os.environ["DEEPSEEK_API_KEY"] = "test-key-for-mocking"
os.environ["OPENAI_API_KEY"] = "test-openai-key"
os.environ["AUTH_REQUIRED"] = "true"
os.environ["AUTH_BYPASS_FOR_TESTS"] = "true"
os.environ["SITE_PASSWORD"] = "test-password"
os.environ["AUTH_TOKEN_SECRET"] = "test-token-secret"

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool

from app.main import app
from app.database import Base, get_db


# Create test database engine
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_db.db"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    """Override database dependency for testing."""
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(scope="function")
def db() -> Generator[Session, None, None]:
    """Create a fresh database for each test."""
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db: Session) -> Generator[TestClient, None, None]:
    """Create a test client with database dependency override."""
    app.dependency_overrides[get_db] = override_get_db
    Base.metadata.create_all(bind=engine)
    
    with TestClient(app) as test_client:
        yield test_client
    
    Base.metadata.drop_all(bind=engine)
    app.dependency_overrides.clear()


@pytest.fixture
def sample_timeline(client: TestClient) -> dict:
    """Create a sample timeline for testing."""
    response = client.post("/api/timelines/", json={
        "name": "Mysticism and Subject Formation",
        "description": "Working timeline for a philosophy/psychology/religious studies dissertation."
    })
    assert response.status_code in [200, 201], f"Unexpected status: {response.status_code}"
    return response.json()


@pytest.fixture
def sample_thinker(client: TestClient, sample_timeline: dict) -> dict:
    """Create a sample thinker for testing."""
    response = client.post("/api/thinkers/", json={
        "name": "Meister Eckhart",
        "birth_year": 1260,
        "death_year": 1328,
        "field": "Mystical Theology",
        "timeline_id": sample_timeline["id"]
    })
    assert response.status_code in [200, 201], f"Unexpected status: {response.status_code}"
    return response.json()


@pytest.fixture
def sample_thinker_2(client: TestClient, sample_timeline: dict) -> dict:
    """Create a second sample thinker for testing connections."""
    response = client.post("/api/thinkers/", json={
        "name": "Georges Bataille",
        "birth_year": 1897,
        "death_year": 1962,
        "field": "Philosophy and Religious Studies",
        "timeline_id": sample_timeline["id"]
    })
    assert response.status_code in [200, 201], f"Unexpected status: {response.status_code}"
    return response.json()


@pytest.fixture
def sample_connection(client: TestClient, sample_thinker: dict, sample_thinker_2: dict) -> dict:
    """Create a sample connection for testing."""
    response = client.post("/api/connections/", json={
        "from_thinker_id": sample_thinker["id"],
        "to_thinker_id": sample_thinker_2["id"],
        "connection_type": "influenced",
        "strength": 3,
        "notes": "Comparative thread from apophatic detachment to modern transgression."
    })
    assert response.status_code in [200, 201], f"Unexpected status: {response.status_code}"
    return response.json()


@pytest.fixture
def sample_publication(client: TestClient, sample_thinker: dict) -> dict:
    """Create a sample publication for testing."""
    response = client.post("/api/publications/", json={
        "title": "Selected Sermons",
        "year": 1320,
        "thinker_id": sample_thinker["id"],
        "publication_type": "book"
    })
    assert response.status_code in [200, 201], f"Unexpected status: {response.status_code}"
    return response.json()


@pytest.fixture
def sample_quote(client: TestClient, sample_thinker: dict) -> dict:
    """Create a sample quote for testing."""
    response = client.post("/api/quotes/", json={
        "text": "Detachment is treated as freedom from possessive selfhood.",
        "thinker_id": sample_thinker["id"]
    })
    assert response.status_code in [200, 201], f"Unexpected status: {response.status_code}"
    return response.json()


@pytest.fixture
def sample_tag(client: TestClient) -> dict:
    """Create a sample tag for testing."""
    response = client.post("/api/tags/", json={
        "name": "Mysticism",
        "color": "#C8553D"
    })
    assert response.status_code in [200, 201], f"Unexpected status: {response.status_code}"
    return response.json()


@pytest.fixture
def sample_institution(client: TestClient) -> dict:
    """Create a sample institution for testing."""
    response = client.post("/api/institutions/", json={
        "name": "University of Chicago Divinity School",
        "city": "Chicago",
        "country": "USA"
    })
    assert response.status_code == 201, f"Unexpected status: {response.status_code}"
    return response.json()


@pytest.fixture
def sample_research_question(client: TestClient) -> dict:
    """Create a sample research question for testing."""
    response = client.post("/api/research-questions/", json={
        "title": "How does apophatic language map onto psychoanalytic accounts of desire?",
        "description": "Track convergences and divergences between Meister Eckhart, Freud-adjacent theory, and Bataille.",
        "category": "influence",
        "status": "open",
        "priority": 2
    })
    assert response.status_code in [200, 201], f"Unexpected status: {response.status_code}"
    return response.json()


@pytest.fixture
def sample_note(client: TestClient, sample_thinker: dict) -> dict:
    """Create a sample note for testing."""
    response = client.post("/api/notes/", json={
        "title": "Dissertation memo",
        "content": "Compare [[Meister Eckhart]] and [[Georges Bataille]] on loss, interiority, and limit-experience.",
        "note_type": "research",
        "thinker_id": sample_thinker["id"]
    })
    assert response.status_code in [200, 201], f"Unexpected status: {response.status_code}"
    return response.json()


@pytest.fixture
def sample_timeline_event(client: TestClient, sample_timeline: dict) -> dict:
    """Create a sample timeline event for testing."""
    response = client.post("/api/timeline-events/", json={
        "name": "Publication of The Varieties of Religious Experience",
        "year": 1902,
        "timeline_id": sample_timeline["id"],
        "event_type": "publication"
    })
    assert response.status_code in [200, 201], f"Unexpected status: {response.status_code}"
    return response.json()


@pytest.fixture
def sample_combined_view(client: TestClient, sample_timeline: dict) -> dict:
    """Create a sample combined view for testing."""
    response = client.post("/api/combined-views/", json={
        "name": "PhD Interdisciplinary View",
        "description": "Merged timeline for philosophy, psychology, and religious studies.",
        "timeline_ids": [sample_timeline["id"]]
    })
    assert response.status_code in [200, 201], f"Unexpected status: {response.status_code}"
    return response.json()
