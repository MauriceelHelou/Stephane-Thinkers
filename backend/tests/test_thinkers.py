"""Tests for Thinker API endpoints."""
import pytest
from fastapi.testclient import TestClient


class TestThinkersAPI:
    """Test suite for /api/thinkers endpoints."""

    def test_create_thinker(self, client: TestClient, sample_timeline: dict):
        """Test creating a new thinker."""
        response = client.post("/api/thinkers/", json={
            "name": "Immanuel Kant",
            "birth_year": 1724,
            "death_year": 1804,
            "field": "Philosophy",
            "biography_notes": "German philosopher",
            "timeline_id": sample_timeline["id"]
        })
        assert response.status_code in [200, 201, 204]
        data = response.json()
        assert data["name"] == "Immanuel Kant"
        assert data["birth_year"] == 1724
        assert data["death_year"] == 1804
        assert data["field"] == "Philosophy"
        assert "id" in data

    def test_create_thinker_minimal(self, client: TestClient, sample_timeline: dict):
        """Test creating thinker with minimal data."""
        response = client.post("/api/thinkers/", json={
            "name": "Unknown Thinker",
            "timeline_id": sample_timeline["id"]
        })
        assert response.status_code in [200, 201, 204]
        data = response.json()
        assert data["name"] == "Unknown Thinker"

    def test_create_thinker_missing_name(self, client: TestClient, sample_timeline: dict):
        """Test creating thinker without required name fails."""
        response = client.post("/api/thinkers/", json={
            "birth_year": 1900,
            "timeline_id": sample_timeline["id"]
        })
        assert response.status_code == 422

    def test_create_thinker_invalid_years(self, client: TestClient, sample_timeline: dict):
        """Test creating thinker with death_year before birth_year fails."""
        response = client.post("/api/thinkers/", json={
            "name": "Invalid Years",
            "birth_year": 2000,
            "death_year": 1900,
            "timeline_id": sample_timeline["id"]
        })
        assert response.status_code == 422

    def test_get_all_thinkers(self, client: TestClient, sample_thinker: dict):
        """Test getting all thinkers."""
        response = client.get("/api/thinkers/")
        assert response.status_code in [200, 201, 204]
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1

    def test_get_thinkers_by_timeline(self, client: TestClient, sample_thinker: dict, sample_timeline: dict):
        """Test getting thinkers filtered by timeline."""
        response = client.get(f"/api/thinkers/?timeline_id={sample_timeline['id']}")
        assert response.status_code in [200, 201, 204]
        data = response.json()
        assert all(t["timeline_id"] == sample_timeline["id"] for t in data)

    def test_get_thinker_by_id(self, client: TestClient, sample_thinker: dict):
        """Test getting a specific thinker with relations."""
        response = client.get(f"/api/thinkers/{sample_thinker['id']}")
        assert response.status_code in [200, 201, 204]
        data = response.json()
        assert data["id"] == sample_thinker["id"]
        assert data["name"] == sample_thinker["name"]
        # Should include relations
        assert "publications" in data
        assert "quotes" in data
        assert "tags" in data

    def test_get_thinker_not_found(self, client: TestClient):
        """Test getting non-existent thinker returns 404."""
        fake_id = "00000000-0000-0000-0000-000000000000"
        response = client.get(f"/api/thinkers/{fake_id}")
        assert response.status_code == 404

    def test_update_thinker(self, client: TestClient, sample_thinker: dict):
        """Test updating a thinker."""
        response = client.put(f"/api/thinkers/{sample_thinker['id']}", json={
            "name": "Updated Name",
            "field": "Updated Field"
        })
        assert response.status_code in [200, 201, 204]
        data = response.json()
        assert data["name"] == "Updated Name"
        assert data["field"] == "Updated Field"

    def test_update_thinker_position(self, client: TestClient, sample_thinker: dict):
        """Test updating thinker position."""
        response = client.put(f"/api/thinkers/{sample_thinker['id']}", json={
            "position_x": 100.5,
            "position_y": 200.5
        })
        assert response.status_code in [200, 201, 204]
        data = response.json()
        assert data["position_x"] == 100.5
        assert data["position_y"] == 200.5

    def test_update_thinker_not_found(self, client: TestClient):
        """Test updating non-existent thinker returns 404."""
        fake_id = "00000000-0000-0000-0000-000000000000"
        response = client.put(f"/api/thinkers/{fake_id}", json={
            "name": "New Name"
        })
        assert response.status_code == 404

    def test_delete_thinker(self, client: TestClient, sample_timeline: dict):
        """Test deleting a thinker."""
        # Create thinker to delete
        create_response = client.post("/api/thinkers/", json={
            "name": "To Delete",
            "timeline_id": sample_timeline["id"]
        })
        thinker_id = create_response.json()["id"]
        
        # Delete it
        response = client.delete(f"/api/thinkers/{thinker_id}")
        assert response.status_code in [200, 201, 204]
        
        # Verify it's gone
        get_response = client.get(f"/api/thinkers/{thinker_id}")
        assert get_response.status_code == 404

    def test_delete_thinker_not_found(self, client: TestClient):
        """Test deleting non-existent thinker returns 404."""
        fake_id = "00000000-0000-0000-0000-000000000000"
        response = client.delete(f"/api/thinkers/{fake_id}")
        assert response.status_code == 404
