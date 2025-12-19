"""Tests for Combined Timeline View API endpoints."""
import pytest
from fastapi.testclient import TestClient


class TestCombinedViewsAPI:
    """Test suite for /api/combined-views endpoints."""

    def test_create_combined_view(self, client: TestClient, sample_timeline: dict):
        """Test creating a new combined view."""
        response = client.post("/api/combined-views/", json={
            "name": "Philosophy & Science",
            "description": "Combined view of philosophy and science",
            "timeline_ids": [sample_timeline["id"]]
        })
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Philosophy & Science"
        assert len(data["members"]) == 1

    def test_create_combined_view_multiple_timelines(self, client: TestClient):
        """Test creating combined view with multiple timelines."""
        # Create two timelines
        timeline1 = client.post("/api/timelines/", json={"name": "Timeline 1"}).json()
        timeline2 = client.post("/api/timelines/", json={"name": "Timeline 2"}).json()

        response = client.post("/api/combined-views/", json={
            "name": "Multi-Timeline View",
            "timeline_ids": [timeline1["id"], timeline2["id"]]
        })
        assert response.status_code == 201
        data = response.json()
        assert len(data["members"]) == 2

    def test_create_combined_view_minimal(self, client: TestClient, sample_timeline: dict):
        """Test creating combined view with minimal data."""
        response = client.post("/api/combined-views/", json={
            "name": "Minimal View",
            "timeline_ids": [sample_timeline["id"]]
        })
        assert response.status_code == 201

    def test_create_combined_view_missing_name(self, client: TestClient, sample_timeline: dict):
        """Test creating combined view without name fails."""
        response = client.post("/api/combined-views/", json={
            "timeline_ids": [sample_timeline["id"]]
        })
        assert response.status_code == 422

    def test_create_combined_view_nonexistent_timeline(self, client: TestClient):
        """Test creating combined view with non-existent timeline fails."""
        fake_id = "00000000-0000-0000-0000-000000000000"
        response = client.post("/api/combined-views/", json={
            "name": "Invalid View",
            "timeline_ids": [fake_id]
        })
        assert response.status_code == 404

    def test_get_all_combined_views(self, client: TestClient, sample_combined_view: dict):
        """Test getting all combined views."""
        response = client.get("/api/combined-views/")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1

    def test_get_combined_view_by_id(self, client: TestClient, sample_combined_view: dict):
        """Test getting a specific combined view."""
        response = client.get(f"/api/combined-views/{sample_combined_view['id']}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == sample_combined_view["id"]
        assert "members" in data

    def test_get_combined_view_not_found(self, client: TestClient):
        """Test getting non-existent combined view returns 404."""
        fake_id = "00000000-0000-0000-0000-000000000000"
        response = client.get(f"/api/combined-views/{fake_id}")
        assert response.status_code == 404

    def test_update_combined_view(self, client: TestClient, sample_combined_view: dict):
        """Test updating a combined view."""
        response = client.put(f"/api/combined-views/{sample_combined_view['id']}", json={
            "name": "Updated View Name",
            "description": "Updated description"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated View Name"
        assert data["description"] == "Updated description"

    def test_update_combined_view_timelines(self, client: TestClient, sample_combined_view: dict):
        """Test updating combined view timelines."""
        # Create new timeline
        new_timeline = client.post("/api/timelines/", json={"name": "New Timeline"}).json()

        response = client.put(f"/api/combined-views/{sample_combined_view['id']}", json={
            "timeline_ids": [new_timeline["id"]]
        })
        assert response.status_code == 200

    def test_update_combined_view_not_found(self, client: TestClient):
        """Test updating non-existent combined view returns 404."""
        fake_id = "00000000-0000-0000-0000-000000000000"
        response = client.put(f"/api/combined-views/{fake_id}", json={
            "name": "New Name"
        })
        assert response.status_code == 404

    def test_delete_combined_view(self, client: TestClient, sample_combined_view: dict):
        """Test deleting a combined view."""
        response = client.delete(f"/api/combined-views/{sample_combined_view['id']}")
        assert response.status_code == 204

        # Verify it's gone
        get_response = client.get(f"/api/combined-views/{sample_combined_view['id']}")
        assert get_response.status_code == 404

    def test_delete_combined_view_not_found(self, client: TestClient):
        """Test deleting non-existent combined view returns 404."""
        fake_id = "00000000-0000-0000-0000-000000000000"
        response = client.delete(f"/api/combined-views/{fake_id}")
        assert response.status_code == 404

    def test_get_combined_view_events(self, client: TestClient, sample_timeline: dict, sample_timeline_event: dict):
        """Test getting events from a combined view."""
        # Create combined view with the timeline
        view = client.post("/api/combined-views/", json={
            "name": "Events Test View",
            "timeline_ids": [sample_timeline["id"]]
        }).json()

        response = client.get(f"/api/combined-views/{view['id']}/events")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
