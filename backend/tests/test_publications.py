"""Tests for Publication API endpoints."""
import pytest
from fastapi.testclient import TestClient


class TestPublicationsAPI:
    """Test suite for /api/publications endpoints."""

    def test_create_publication(self, client: TestClient, sample_thinker: dict):
        """Test creating a new publication."""
        response = client.post("/api/publications/", json={
            "title": "Critique of Pure Reason",
            "year": 1781,
            "thinker_id": sample_thinker["id"],
            "publication_type": "book",
            "publisher": "Test Publisher"
        })
        assert response.status_code == 201
        data = response.json()
        assert data["title"] == "Critique of Pure Reason"
        assert data["year"] == 1781
        assert data["publication_type"] == "book"

    def test_create_publication_all_types(self, client: TestClient, sample_thinker: dict):
        """Test creating publications with all valid types."""
        # Valid publication types: book, article, chapter, thesis, conference, report, other
        pub_types = ["book", "article", "chapter", "thesis", "conference", "report", "other"]

        for i, pub_type in enumerate(pub_types):
            response = client.post("/api/publications/", json={
                "title": f"Test {pub_type} {i}",
                "thinker_id": sample_thinker["id"],
                "publication_type": pub_type
            })
            assert response.status_code == 201, f"Failed for type: {pub_type}"
            assert response.json()["publication_type"] == pub_type

    def test_create_publication_nonexistent_thinker(self, client: TestClient):
        """Test creating publication with non-existent thinker fails."""
        fake_id = "00000000-0000-0000-0000-000000000000"
        response = client.post("/api/publications/", json={
            "title": "Test Publication",
            "thinker_id": fake_id
        })
        assert response.status_code == 404

    def test_create_publication_minimal(self, client: TestClient, sample_thinker: dict):
        """Test creating publication with minimal data."""
        response = client.post("/api/publications/", json={
            "title": "Minimal Publication",
            "thinker_id": sample_thinker["id"]
        })
        assert response.status_code == 201

    def test_get_all_publications(self, client: TestClient, sample_publication: dict):
        """Test getting all publications."""
        response = client.get("/api/publications/")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1

    def test_get_publications_by_thinker(self, client: TestClient, sample_publication: dict, sample_thinker: dict):
        """Test getting publications filtered by thinker."""
        response = client.get(f"/api/publications/?thinker_id={sample_thinker['id']}")
        assert response.status_code == 200
        data = response.json()
        assert all(p["thinker_id"] == sample_thinker["id"] for p in data)

    def test_get_publication_by_id(self, client: TestClient, sample_publication: dict):
        """Test getting a specific publication."""
        response = client.get(f"/api/publications/{sample_publication['id']}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == sample_publication["id"]

    def test_get_publication_not_found(self, client: TestClient):
        """Test getting non-existent publication returns 404."""
        fake_id = "00000000-0000-0000-0000-000000000000"
        response = client.get(f"/api/publications/{fake_id}")
        assert response.status_code == 404

    def test_update_publication(self, client: TestClient, sample_publication: dict):
        """Test updating a publication."""
        response = client.put(f"/api/publications/{sample_publication['id']}", json={
            "title": "Updated Title",
            "year": 1960
        })
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "Updated Title"
        assert data["year"] == 1960

    def test_update_publication_not_found(self, client: TestClient):
        """Test updating non-existent publication returns 404."""
        fake_id = "00000000-0000-0000-0000-000000000000"
        response = client.put(f"/api/publications/{fake_id}", json={
            "title": "New Title"
        })
        assert response.status_code == 404

    def test_delete_publication(self, client: TestClient, sample_publication: dict):
        """Test deleting a publication."""
        response = client.delete(f"/api/publications/{sample_publication['id']}")
        assert response.status_code == 204

        # Verify it's gone
        get_response = client.get(f"/api/publications/{sample_publication['id']}")
        assert get_response.status_code == 404

    def test_delete_publication_not_found(self, client: TestClient):
        """Test deleting non-existent publication returns 404."""
        fake_id = "00000000-0000-0000-0000-000000000000"
        response = client.delete(f"/api/publications/{fake_id}")
        assert response.status_code == 404

    def test_get_publication_citations(self, client: TestClient, sample_publication: dict):
        """Test getting citation formats for a publication."""
        response = client.get(f"/api/publications/{sample_publication['id']}/citations")
        assert response.status_code == 200
        data = response.json()
        assert "apa" in data
        assert "mla" in data
        assert "chicago" in data
