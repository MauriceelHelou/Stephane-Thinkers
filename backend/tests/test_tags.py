"""Tests for Tag API endpoints."""
import pytest
from fastapi.testclient import TestClient


class TestTagsAPI:
    """Test suite for /api/tags endpoints."""

    def test_create_tag(self, client: TestClient):
        """Test creating a new tag."""
        response = client.post("/api/tags/", json={
            "name": "Empiricism",
            "color": "#00FF00"
        })
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Empiricism"
        assert data["color"] == "#00FF00"

    def test_create_tag_minimal(self, client: TestClient):
        """Test creating tag with just name."""
        response = client.post("/api/tags/", json={
            "name": "MinimalTag"
        })
        assert response.status_code == 201

    def test_create_tag_missing_name(self, client: TestClient):
        """Test creating tag without name fails."""
        response = client.post("/api/tags/", json={
            "color": "#FF0000"
        })
        assert response.status_code == 422

    def test_create_tag_duplicate_name_returns_existing(self, client: TestClient, sample_tag: dict):
        """Test creating tag with duplicate name returns existing tag."""
        # API returns the existing tag instead of failing
        response = client.post("/api/tags/", json={
            "name": sample_tag["name"]
        })
        assert response.status_code == 201
        data = response.json()
        # Should return the existing tag
        assert data["id"] == sample_tag["id"]

    def test_create_tag_duplicate_name_case_insensitive_returns_existing(self, client: TestClient):
        """Case variants should resolve to the same canonical tag."""
        first = client.post("/api/tags/", json={"name": "Phenomenology"})
        assert first.status_code == 201
        second = client.post("/api/tags/", json={"name": "phenomenology"})
        assert second.status_code == 201
        assert second.json()["id"] == first.json()["id"]

    def test_get_all_tags(self, client: TestClient, sample_tag: dict):
        """Test getting all tags."""
        response = client.get("/api/tags/")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1

    def test_get_tags_limit_validation(self, client: TestClient):
        """Test list limit guardrails."""
        response = client.get("/api/tags/?limit=500")
        assert response.status_code == 422

    def test_get_tag_by_id(self, client: TestClient, sample_tag: dict):
        """Test getting a specific tag."""
        response = client.get(f"/api/tags/{sample_tag['id']}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == sample_tag["id"]
        assert data["name"] == sample_tag["name"]

    def test_get_tag_not_found(self, client: TestClient):
        """Test getting non-existent tag returns 404."""
        fake_id = "00000000-0000-0000-0000-000000000000"
        response = client.get(f"/api/tags/{fake_id}")
        assert response.status_code == 404

    def test_update_tag(self, client: TestClient, sample_tag: dict):
        """Test updating a tag."""
        response = client.put(f"/api/tags/{sample_tag['id']}", json={
            "name": "UpdatedTag",
            "color": "#0000FF"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "UpdatedTag"
        assert data["color"] == "#0000FF"

    def test_update_tag_not_found(self, client: TestClient):
        """Test updating non-existent tag returns 404."""
        fake_id = "00000000-0000-0000-0000-000000000000"
        response = client.put(f"/api/tags/{fake_id}", json={
            "name": "NewName"
        })
        assert response.status_code == 404

    def test_delete_tag(self, client: TestClient, sample_tag: dict):
        """Test deleting a tag."""
        response = client.delete(f"/api/tags/{sample_tag['id']}")
        assert response.status_code == 204

        # Verify it's gone
        get_response = client.get(f"/api/tags/{sample_tag['id']}")
        assert get_response.status_code == 404

    def test_delete_tag_not_found(self, client: TestClient):
        """Test deleting non-existent tag returns 404."""
        fake_id = "00000000-0000-0000-0000-000000000000"
        response = client.delete(f"/api/tags/{fake_id}")
        assert response.status_code == 404
