"""Tests for Connection API endpoints."""
import pytest
from fastapi.testclient import TestClient


class TestConnectionsAPI:
    """Test suite for /api/connections endpoints."""

    def test_create_connection(self, client: TestClient, sample_thinker: dict, sample_thinker_2: dict):
        """Test creating a new connection."""
        response = client.post("/api/connections/", json={
            "from_thinker_id": sample_thinker["id"],
            "to_thinker_id": sample_thinker_2["id"],
            "connection_type": "influenced",
            "strength": 4,
            "notes": "Test connection"
        })
        assert response.status_code == 201
        data = response.json()
        assert data["from_thinker_id"] == sample_thinker["id"]
        assert data["to_thinker_id"] == sample_thinker_2["id"]
        assert data["connection_type"] == "influenced"
        assert data["strength"] == 4

    def test_create_connection_all_types(self, client: TestClient, sample_thinker: dict, sample_thinker_2: dict):
        """Test creating connections with all valid types."""
        # Valid connection types: influenced, critiqued, built_upon, synthesized
        connection_types = ["influenced", "critiqued", "built_upon", "synthesized"]

        for conn_type in connection_types:
            # Delete existing connections first
            connections = client.get("/api/connections/").json()
            for c in connections:
                client.delete(f"/api/connections/{c['id']}")

            response = client.post("/api/connections/", json={
                "from_thinker_id": sample_thinker["id"],
                "to_thinker_id": sample_thinker_2["id"],
                "connection_type": conn_type
            })
            assert response.status_code == 201, f"Failed for type: {conn_type}"
            assert response.json()["connection_type"] == conn_type

    def test_create_connection_invalid_type(self, client: TestClient, sample_thinker: dict, sample_thinker_2: dict):
        """Test creating connection with invalid type fails."""
        response = client.post("/api/connections/", json={
            "from_thinker_id": sample_thinker["id"],
            "to_thinker_id": sample_thinker_2["id"],
            "connection_type": "invalid_type"
        })
        assert response.status_code == 422

    def test_create_connection_self_loop(self, client: TestClient, sample_thinker: dict):
        """Test creating self-referential connection fails."""
        response = client.post("/api/connections/", json={
            "from_thinker_id": sample_thinker["id"],
            "to_thinker_id": sample_thinker["id"],
            "connection_type": "influenced"
        })
        assert response.status_code == 400

    def test_create_connection_nonexistent_thinker(self, client: TestClient, sample_thinker: dict):
        """Test creating connection with non-existent thinker fails."""
        fake_id = "00000000-0000-0000-0000-000000000000"
        response = client.post("/api/connections/", json={
            "from_thinker_id": sample_thinker["id"],
            "to_thinker_id": fake_id,
            "connection_type": "influenced"
        })
        assert response.status_code == 404

    def test_create_connection_strength_bounds(self, client: TestClient, sample_thinker: dict, sample_thinker_2: dict):
        """Test connection strength validation."""
        # Valid strength
        response = client.post("/api/connections/", json={
            "from_thinker_id": sample_thinker["id"],
            "to_thinker_id": sample_thinker_2["id"],
            "connection_type": "influenced",
            "strength": 5
        })
        assert response.status_code == 201

        # Clean up
        client.delete(f"/api/connections/{response.json()['id']}")

        # Invalid strength (too high)
        response = client.post("/api/connections/", json={
            "from_thinker_id": sample_thinker["id"],
            "to_thinker_id": sample_thinker_2["id"],
            "connection_type": "influenced",
            "strength": 6
        })
        assert response.status_code == 422

    def test_get_all_connections(self, client: TestClient, sample_connection: dict):
        """Test getting all connections."""
        response = client.get("/api/connections/")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1

    def test_get_connection_by_id(self, client: TestClient, sample_connection: dict):
        """Test getting a specific connection."""
        response = client.get(f"/api/connections/{sample_connection['id']}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == sample_connection["id"]

    def test_get_connection_not_found(self, client: TestClient):
        """Test getting non-existent connection returns 404."""
        fake_id = "00000000-0000-0000-0000-000000000000"
        response = client.get(f"/api/connections/{fake_id}")
        assert response.status_code == 404

    def test_update_connection(self, client: TestClient, sample_connection: dict):
        """Test updating a connection."""
        response = client.put(f"/api/connections/{sample_connection['id']}", json={
            "strength": 5,
            "notes": "Updated notes"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["strength"] == 5
        assert data["notes"] == "Updated notes"

    def test_update_connection_type(self, client: TestClient, sample_connection: dict):
        """Test updating connection type."""
        response = client.put(f"/api/connections/{sample_connection['id']}", json={
            "connection_type": "critiqued"
        })
        assert response.status_code == 200
        assert response.json()["connection_type"] == "critiqued"

    def test_update_connection_not_found(self, client: TestClient):
        """Test updating non-existent connection returns 404."""
        fake_id = "00000000-0000-0000-0000-000000000000"
        response = client.put(f"/api/connections/{fake_id}", json={
            "strength": 3
        })
        assert response.status_code == 404

    def test_delete_connection(self, client: TestClient, sample_connection: dict):
        """Test deleting a connection."""
        response = client.delete(f"/api/connections/{sample_connection['id']}")
        assert response.status_code == 204

        # Verify it's gone
        get_response = client.get(f"/api/connections/{sample_connection['id']}")
        assert get_response.status_code == 404

    def test_delete_connection_not_found(self, client: TestClient):
        """Test deleting non-existent connection returns 404."""
        fake_id = "00000000-0000-0000-0000-000000000000"
        response = client.delete(f"/api/connections/{fake_id}")
        assert response.status_code == 404

    def test_create_duplicate_connection(self, client: TestClient, sample_connection: dict, sample_thinker: dict, sample_thinker_2: dict):
        """Test creating duplicate connection fails."""
        response = client.post("/api/connections/", json={
            "from_thinker_id": sample_thinker["id"],
            "to_thinker_id": sample_thinker_2["id"],
            "connection_type": "influenced"
        })
        assert response.status_code == 400
