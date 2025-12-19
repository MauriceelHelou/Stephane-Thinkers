"""Tests for Timeline API endpoints."""
import pytest
from fastapi.testclient import TestClient


class TestTimelinesAPI:
    """Test suite for /api/timelines endpoints."""

    def test_create_timeline(self, client: TestClient):
        """Test creating a new timeline."""
        response = client.post("/api/timelines/", json={
            "name": "Philosophy Timeline",
            "description": "A timeline of philosophers"
        })
        assert response.status_code in [200, 201, 204]
        data = response.json()
        assert data["name"] == "Philosophy Timeline"
        assert data["description"] == "A timeline of philosophers"
        assert "id" in data

    def test_create_timeline_minimal(self, client: TestClient):
        """Test creating timeline with minimal data."""
        response = client.post("/api/timelines/", json={
            "name": "Minimal Timeline"
        })
        assert response.status_code in [200, 201, 204]
        data = response.json()
        assert data["name"] == "Minimal Timeline"

    def test_create_timeline_missing_name(self, client: TestClient):
        """Test creating timeline without required name fails."""
        response = client.post("/api/timelines/", json={
            "description": "No name provided"
        })
        assert response.status_code == 422

    def test_get_all_timelines(self, client: TestClient, sample_timeline: dict):
        """Test getting all timelines."""
        response = client.get("/api/timelines/")
        assert response.status_code in [200, 201, 204]
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        assert any(t["id"] == sample_timeline["id"] for t in data)

    def test_get_timeline_by_id(self, client: TestClient, sample_timeline: dict):
        """Test getting a specific timeline."""
        response = client.get(f"/api/timelines/{sample_timeline['id']}")
        assert response.status_code in [200, 201, 204]
        data = response.json()
        assert data["id"] == sample_timeline["id"]
        assert data["name"] == sample_timeline["name"]

    def test_get_timeline_not_found(self, client: TestClient):
        """Test getting non-existent timeline returns 404."""
        fake_id = "00000000-0000-0000-0000-000000000000"
        response = client.get(f"/api/timelines/{fake_id}")
        assert response.status_code == 404

    def test_update_timeline(self, client: TestClient, sample_timeline: dict):
        """Test updating a timeline."""
        response = client.put(f"/api/timelines/{sample_timeline['id']}", json={
            "name": "Updated Timeline",
            "description": "Updated description"
        })
        assert response.status_code in [200, 201, 204]
        data = response.json()
        assert data["name"] == "Updated Timeline"
        assert data["description"] == "Updated description"

    def test_update_timeline_partial(self, client: TestClient, sample_timeline: dict):
        """Test partial update of timeline."""
        response = client.put(f"/api/timelines/{sample_timeline['id']}", json={
            "name": "Only Name Updated"
        })
        assert response.status_code in [200, 201, 204]
        data = response.json()
        assert data["name"] == "Only Name Updated"

    def test_update_timeline_not_found(self, client: TestClient):
        """Test updating non-existent timeline returns 404."""
        fake_id = "00000000-0000-0000-0000-000000000000"
        response = client.put(f"/api/timelines/{fake_id}", json={
            "name": "New Name"
        })
        assert response.status_code == 404

    def test_delete_timeline(self, client: TestClient):
        """Test deleting a timeline."""
        # Create timeline to delete
        create_response = client.post("/api/timelines/", json={
            "name": "To Delete"
        })
        timeline_id = create_response.json()["id"]
        
        # Delete it
        response = client.delete(f"/api/timelines/{timeline_id}")
        assert response.status_code in [200, 201, 204]
        
        # Verify it's gone
        get_response = client.get(f"/api/timelines/{timeline_id}")
        assert get_response.status_code == 404

    def test_delete_timeline_not_found(self, client: TestClient):
        """Test deleting non-existent timeline returns 404."""
        fake_id = "00000000-0000-0000-0000-000000000000"
        response = client.delete(f"/api/timelines/{fake_id}")
        assert response.status_code == 404
