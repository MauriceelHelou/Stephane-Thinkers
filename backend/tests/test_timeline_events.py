"""Tests for Timeline Event API endpoints."""
import pytest
from fastapi.testclient import TestClient


class TestTimelineEventsAPI:
    """Test suite for /api/timeline-events endpoints."""

    def test_create_timeline_event(self, client: TestClient, sample_timeline: dict):
        """Test creating a new timeline event."""
        response = client.post("/api/timeline-events/", json={
            "name": "World War I",
            "year": 1914,
            "timeline_id": sample_timeline["id"],
            "event_type": "war",
            "description": "Start of WWI"
        })
        assert response.status_code in [200, 201]
        data = response.json()
        assert data["name"] == "World War I"
        assert data["year"] == 1914
        assert data["event_type"] == "war"

    def test_create_timeline_event_all_types(self, client: TestClient, sample_timeline: dict):
        """Test creating events with all valid types."""
        event_types = ["council", "publication", "war", "invention", "cultural", "political", "other"]
        
        for i, event_type in enumerate(event_types):
            response = client.post("/api/timeline-events/", json={
                "name": f"Event {i}",
                "year": 1900 + i,
                "timeline_id": sample_timeline["id"],
                "event_type": event_type
            })
            assert response.status_code in [200, 201], f"Failed for type: {event_type}"

    def test_create_timeline_event_nonexistent_timeline(self, client: TestClient):
        """Test creating event with non-existent timeline fails."""
        fake_id = "00000000-0000-0000-0000-000000000000"
        response = client.post("/api/timeline-events/", json={
            "name": "Test Event",
            "year": 1950,
            "timeline_id": fake_id,
            "event_type": "other"
        })
        assert response.status_code == 404

    def test_create_timeline_event_minimal(self, client: TestClient, sample_timeline: dict):
        """Test creating event with required data."""
        response = client.post("/api/timeline-events/", json={
            "name": "Minimal Event",
            "year": 1950,
            "timeline_id": sample_timeline["id"],
            "event_type": "other"
        })
        assert response.status_code in [200, 201]

    def test_get_all_timeline_events(self, client: TestClient, sample_timeline_event: dict):
        """Test getting all timeline events."""
        response = client.get("/api/timeline-events/")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1

    def test_get_timeline_events_by_timeline(self, client: TestClient, sample_timeline_event: dict, sample_timeline: dict):
        """Test getting events filtered by timeline."""
        response = client.get(f"/api/timeline-events/?timeline_id={sample_timeline['id']}")
        assert response.status_code == 200
        data = response.json()
        assert all(e["timeline_id"] == sample_timeline["id"] for e in data)

    def test_get_timeline_event_by_id(self, client: TestClient, sample_timeline_event: dict):
        """Test getting a specific timeline event."""
        response = client.get(f"/api/timeline-events/{sample_timeline_event['id']}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == sample_timeline_event["id"]

    def test_get_timeline_event_not_found(self, client: TestClient):
        """Test getting non-existent event returns 404."""
        fake_id = "00000000-0000-0000-0000-000000000000"
        response = client.get(f"/api/timeline-events/{fake_id}")
        assert response.status_code == 404

    def test_update_timeline_event(self, client: TestClient, sample_timeline_event: dict):
        """Test updating a timeline event."""
        response = client.put(f"/api/timeline-events/{sample_timeline_event['id']}", json={
            "name": "Updated Event",
            "year": 1960,
            "description": "Updated description"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Event"
        assert data["year"] == 1960

    def test_update_timeline_event_not_found(self, client: TestClient):
        """Test updating non-existent event returns 404."""
        fake_id = "00000000-0000-0000-0000-000000000000"
        response = client.put(f"/api/timeline-events/{fake_id}", json={
            "name": "New Name"
        })
        assert response.status_code == 404

    def test_delete_timeline_event(self, client: TestClient, sample_timeline_event: dict):
        """Test deleting a timeline event."""
        response = client.delete(f"/api/timeline-events/{sample_timeline_event['id']}")
        assert response.status_code == 204
        
        # Verify it's gone
        get_response = client.get(f"/api/timeline-events/{sample_timeline_event['id']}")
        assert get_response.status_code == 404

    def test_delete_timeline_event_not_found(self, client: TestClient):
        """Test deleting non-existent event returns 404."""
        fake_id = "00000000-0000-0000-0000-000000000000"
        response = client.delete(f"/api/timeline-events/{fake_id}")
        assert response.status_code == 404
