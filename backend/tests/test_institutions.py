"""Tests for Institution API endpoints."""
import pytest
from fastapi.testclient import TestClient


class TestInstitutionsAPI:
    """Test suite for /api/institutions endpoints."""

    def test_create_institution(self, client: TestClient):
        """Test creating a new institution."""
        response = client.post("/api/institutions/", json={
            "name": "Harvard University",
            "city": "Cambridge",
            "country": "USA",
            "founded_year": 1636
        })
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Harvard University"
        assert data["country"] == "USA"

    def test_create_institution_minimal(self, client: TestClient):
        """Test creating institution with minimal data."""
        response = client.post("/api/institutions/", json={
            "name": "Minimal Institute"
        })
        assert response.status_code == 201

    def test_create_institution_missing_name(self, client: TestClient):
        """Test creating institution without name fails."""
        response = client.post("/api/institutions/", json={
            "city": "Boston"
        })
        assert response.status_code == 422

    def test_get_all_institutions(self, client: TestClient, sample_institution: dict):
        """Test getting all institutions."""
        response = client.get("/api/institutions/")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1

    def test_get_institutions_by_country(self, client: TestClient, sample_institution: dict):
        """Test getting institutions filtered by country."""
        response = client.get(f"/api/institutions/?country={sample_institution['country']}")
        assert response.status_code == 200
        data = response.json()
        assert all(i["country"] == sample_institution["country"] for i in data)

    def test_get_institution_by_id(self, client: TestClient, sample_institution: dict):
        """Test getting a specific institution."""
        response = client.get(f"/api/institutions/{sample_institution['id']}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == sample_institution["id"]

    def test_get_institution_not_found(self, client: TestClient):
        """Test getting non-existent institution returns 404."""
        fake_id = "00000000-0000-0000-0000-000000000000"
        response = client.get(f"/api/institutions/{fake_id}")
        assert response.status_code == 404

    def test_update_institution(self, client: TestClient, sample_institution: dict):
        """Test updating an institution."""
        response = client.put(f"/api/institutions/{sample_institution['id']}", json={
            "name": "Updated University",
            "city": "New City"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated University"
        assert data["city"] == "New City"

    def test_update_institution_not_found(self, client: TestClient):
        """Test updating non-existent institution returns 404."""
        fake_id = "00000000-0000-0000-0000-000000000000"
        response = client.put(f"/api/institutions/{fake_id}", json={
            "name": "New Name"
        })
        assert response.status_code == 404

    def test_delete_institution(self, client: TestClient, sample_institution: dict):
        """Test deleting an institution."""
        response = client.delete(f"/api/institutions/{sample_institution['id']}")
        assert response.status_code == 204

        # Verify it's gone
        get_response = client.get(f"/api/institutions/{sample_institution['id']}")
        assert get_response.status_code == 404

    def test_delete_institution_not_found(self, client: TestClient):
        """Test deleting non-existent institution returns 404."""
        fake_id = "00000000-0000-0000-0000-000000000000"
        response = client.delete(f"/api/institutions/{fake_id}")
        assert response.status_code == 404


class TestThinkerInstitutionsAPI:
    """Test suite for institution affiliation endpoints."""

    def test_create_affiliation(self, client: TestClient, sample_thinker: dict, sample_institution: dict):
        """Test creating a thinker-institution affiliation."""
        response = client.post("/api/institutions/affiliations", json={
            "thinker_id": sample_thinker["id"],
            "institution_id": sample_institution["id"],
            "role": "Professor",
            "start_year": 1950,
            "end_year": 1970
        })
        assert response.status_code == 201
        data = response.json()
        assert data["thinker_id"] == sample_thinker["id"]
        assert data["institution_id"] == sample_institution["id"]
        assert data["role"] == "Professor"

    def test_create_affiliation_nonexistent_thinker(self, client: TestClient, sample_institution: dict):
        """Test creating affiliation with non-existent thinker fails."""
        fake_id = "00000000-0000-0000-0000-000000000000"
        response = client.post("/api/institutions/affiliations", json={
            "thinker_id": fake_id,
            "institution_id": sample_institution["id"],
            "role": "Professor"
        })
        assert response.status_code == 404

    def test_get_affiliations(self, client: TestClient, sample_thinker: dict, sample_institution: dict):
        """Test getting affiliations."""
        # Create an affiliation first
        client.post("/api/institutions/affiliations", json={
            "thinker_id": sample_thinker["id"],
            "institution_id": sample_institution["id"],
            "role": "Professor"
        })

        response = client.get("/api/institutions/affiliations")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    def test_get_affiliations_by_thinker(self, client: TestClient, sample_thinker: dict, sample_institution: dict):
        """Test getting affiliations filtered by thinker."""
        # Create an affiliation first
        client.post("/api/institutions/affiliations", json={
            "thinker_id": sample_thinker["id"],
            "institution_id": sample_institution["id"],
            "role": "Professor"
        })

        response = client.get(f"/api/institutions/affiliations?thinker_id={sample_thinker['id']}")
        assert response.status_code == 200
        data = response.json()
        assert all(a["thinker_id"] == sample_thinker["id"] for a in data)
