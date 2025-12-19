"""Tests for Quote API endpoints."""
import pytest
from fastapi.testclient import TestClient


class TestQuotesAPI:
    """Test suite for /api/quotes endpoints."""

    def test_create_quote(self, client: TestClient, sample_thinker: dict):
        """Test creating a new quote."""
        response = client.post("/api/quotes/", json={
            "text": "I think, therefore I am.",
            "thinker_id": sample_thinker["id"],
            "source": "Meditations"
        })
        assert response.status_code in [200, 201, 204]
        data = response.json()
        assert data["text"] == "I think, therefore I am."
        assert data["source"] == "Meditations"

    def test_create_quote_minimal(self, client: TestClient, sample_thinker: dict):
        """Test creating quote with minimal data."""
        response = client.post("/api/quotes/", json={
            "text": "A minimal quote.",
            "thinker_id": sample_thinker["id"]
        })
        assert response.status_code in [200, 201, 204]

    def test_create_quote_nonexistent_thinker(self, client: TestClient):
        """Test creating quote with non-existent thinker fails."""
        fake_id = "00000000-0000-0000-0000-000000000000"
        response = client.post("/api/quotes/", json={
            "text": "Test quote",
            "thinker_id": fake_id
        })
        assert response.status_code == 404

    def test_create_quote_missing_text(self, client: TestClient, sample_thinker: dict):
        """Test creating quote without text fails."""
        response = client.post("/api/quotes/", json={
            "thinker_id": sample_thinker["id"]
        })
        assert response.status_code == 422

    def test_get_all_quotes(self, client: TestClient, sample_quote: dict):
        """Test getting all quotes."""
        response = client.get("/api/quotes/")
        assert response.status_code in [200, 201, 204]
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1

    def test_get_quotes_by_thinker(self, client: TestClient, sample_quote: dict, sample_thinker: dict):
        """Test getting quotes filtered by thinker."""
        response = client.get(f"/api/quotes/?thinker_id={sample_thinker['id']}")
        assert response.status_code in [200, 201, 204]
        data = response.json()
        assert all(q["thinker_id"] == sample_thinker["id"] for q in data)

    def test_get_quote_by_id(self, client: TestClient, sample_quote: dict):
        """Test getting a specific quote."""
        response = client.get(f"/api/quotes/{sample_quote['id']}")
        assert response.status_code in [200, 201, 204]
        data = response.json()
        assert data["id"] == sample_quote["id"]

    def test_get_quote_not_found(self, client: TestClient):
        """Test getting non-existent quote returns 404."""
        fake_id = "00000000-0000-0000-0000-000000000000"
        response = client.get(f"/api/quotes/{fake_id}")
        assert response.status_code == 404

    def test_update_quote(self, client: TestClient, sample_quote: dict):
        """Test updating a quote."""
        response = client.put(f"/api/quotes/{sample_quote['id']}", json={
            "text": "Updated quote text.",
            "source": "New Source"
        })
        assert response.status_code in [200, 201, 204]
        data = response.json()
        assert data["text"] == "Updated quote text."
        assert data["source"] == "New Source"

    def test_update_quote_not_found(self, client: TestClient):
        """Test updating non-existent quote returns 404."""
        fake_id = "00000000-0000-0000-0000-000000000000"
        response = client.put(f"/api/quotes/{fake_id}", json={
            "text": "New text"
        })
        assert response.status_code == 404

    def test_delete_quote(self, client: TestClient, sample_quote: dict):
        """Test deleting a quote."""
        response = client.delete(f"/api/quotes/{sample_quote['id']}")
        assert response.status_code in [200, 201, 204]
        
        # Verify it's gone
        get_response = client.get(f"/api/quotes/{sample_quote['id']}")
        assert get_response.status_code == 404

    def test_delete_quote_not_found(self, client: TestClient):
        """Test deleting non-existent quote returns 404."""
        fake_id = "00000000-0000-0000-0000-000000000000"
        response = client.delete(f"/api/quotes/{fake_id}")
        assert response.status_code == 404
