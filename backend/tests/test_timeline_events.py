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


class TestTimelineEventEndYear:
    """Test suite for the optional end_year (range) field."""

    def test_create_event_with_end_year(self, client: TestClient, sample_timeline: dict):
        """An event created with end_year persists and returns it."""
        response = client.post("/api/timeline-events/", json={
            "name": "Council of Trent",
            "year": 1545,
            "end_year": 1563,
            "timeline_id": sample_timeline["id"],
            "event_type": "council",
        })
        assert response.status_code in [200, 201]
        data = response.json()
        assert data["year"] == 1545
        assert data["end_year"] == 1563

    def test_create_event_without_end_year_defaults_null(self, client: TestClient, sample_timeline: dict):
        """An event created without end_year returns end_year=None (point item)."""
        response = client.post("/api/timeline-events/", json={
            "name": "Single date event",
            "year": 1600,
            "timeline_id": sample_timeline["id"],
            "event_type": "other",
        })
        assert response.status_code in [200, 201]
        assert response.json()["end_year"] is None

    def test_create_event_end_year_equal_to_year_allowed(self, client: TestClient, sample_timeline: dict):
        """end_year == year is permitted (renders as a point)."""
        response = client.post("/api/timeline-events/", json={
            "name": "Same-year span",
            "year": 1700,
            "end_year": 1700,
            "timeline_id": sample_timeline["id"],
            "event_type": "other",
        })
        assert response.status_code in [200, 201]
        assert response.json()["end_year"] == 1700

    def test_create_event_end_year_before_year_rejected(self, client: TestClient, sample_timeline: dict):
        """Creating with end_year < year is rejected."""
        response = client.post("/api/timeline-events/", json={
            "name": "Backwards range",
            "year": 1600,
            "end_year": 1500,
            "timeline_id": sample_timeline["id"],
            "event_type": "other",
        })
        assert response.status_code == 422

    def test_create_event_end_year_out_of_bounds_rejected(self, client: TestClient, sample_timeline: dict):
        """end_year outside [-10000, 10000] is rejected."""
        response = client.post("/api/timeline-events/", json={
            "name": "Way too far",
            "year": 1600,
            "end_year": 99999,
            "timeline_id": sample_timeline["id"],
            "event_type": "other",
        })
        assert response.status_code == 422

    def test_update_event_set_end_year(self, client: TestClient, sample_timeline_event: dict):
        """Updating an event to add an end_year persists it."""
        response = client.put(f"/api/timeline-events/{sample_timeline_event['id']}", json={
            "end_year": 1910,
        })
        assert response.status_code == 200
        assert response.json()["end_year"] == 1910

    def test_update_event_clear_end_year(self, client: TestClient, sample_timeline: dict):
        """Updating an event to set end_year=null clears it back to a point."""
        created = client.post("/api/timeline-events/", json={
            "name": "Range to clear",
            "year": 1545,
            "end_year": 1563,
            "timeline_id": sample_timeline["id"],
            "event_type": "council",
        }).json()
        response = client.put(f"/api/timeline-events/{created['id']}", json={
            "end_year": None,
        })
        assert response.status_code == 200
        assert response.json()["end_year"] is None

    def test_partial_update_end_year_below_persisted_year_rejected(
        self, client: TestClient, sample_timeline_event: dict
    ):
        """PATCH-style PUT of only end_year below the persisted year is rejected.

        The fixture event has year=1902 with no end_year. Sending only
        end_year=1850 must be validated against the stored year, not skipped.
        """
        response = client.put(f"/api/timeline-events/{sample_timeline_event['id']}", json={
            "end_year": 1850,
        })
        assert response.status_code == 422

    def test_partial_update_year_above_persisted_end_year_rejected(
        self, client: TestClient, sample_timeline: dict
    ):
        """Raising only `year` above a persisted end_year is rejected."""
        created = client.post("/api/timeline-events/", json={
            "name": "Existing range",
            "year": 1545,
            "end_year": 1563,
            "timeline_id": sample_timeline["id"],
            "event_type": "council",
        }).json()
        response = client.put(f"/api/timeline-events/{created['id']}", json={
            "year": 1600,
        })
        assert response.status_code == 422
