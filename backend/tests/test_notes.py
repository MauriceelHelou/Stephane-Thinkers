"""Tests for Note API endpoints."""
import pytest
from fastapi.testclient import TestClient


class TestNotesAPI:
    """Test suite for /api/notes endpoints."""

    def test_create_note(self, client: TestClient, sample_thinker: dict):
        """Test creating a new note."""
        response = client.post("/api/notes/", json={
            "title": "Research Note",
            "content": "This is the content of the research note.",
            "note_type": "research",
            "thinker_id": sample_thinker["id"]
        })
        assert response.status_code == 201
        data = response.json()
        assert data["title"] == "Research Note"
        assert data["note_type"] == "research"

    def test_create_note_all_types(self, client: TestClient, sample_thinker: dict):
        """Test creating notes with all valid types."""
        # Valid note types: general, research, biography, connection
        note_types = ["general", "research", "biography", "connection"]

        for i, note_type in enumerate(note_types):
            response = client.post("/api/notes/", json={
                "title": f"Test Note {i}",
                "content": f"Content for {note_type}",
                "note_type": note_type,
                "thinker_id": sample_thinker["id"]
            })
            assert response.status_code == 201, f"Failed for type: {note_type}"

    def test_create_note_with_wiki_links(self, client: TestClient, sample_thinker: dict, sample_thinker_2: dict):
        """Test creating note with wiki-style links."""
        response = client.post("/api/notes/", json={
            "title": "Note with Links",
            "content": f"This note mentions [[{sample_thinker_2['name']}]].",
            "note_type": "research",
            "thinker_id": sample_thinker["id"]
        })
        assert response.status_code == 201

    def test_create_note_missing_content(self, client: TestClient, sample_thinker: dict):
        """Test creating note without content fails."""
        response = client.post("/api/notes/", json={
            "title": "No Content",
            "thinker_id": sample_thinker["id"]
        })
        assert response.status_code == 422

    def test_get_all_notes(self, client: TestClient, sample_note: dict):
        """Test getting all notes."""
        response = client.get("/api/notes/")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1

    def test_get_notes_by_thinker(self, client: TestClient, sample_note: dict, sample_thinker: dict):
        """Test getting notes filtered by thinker."""
        response = client.get(f"/api/notes/?thinker_id={sample_thinker['id']}")
        assert response.status_code == 200
        data = response.json()
        assert all(n["thinker_id"] == sample_thinker["id"] for n in data)

    def test_get_notes_by_type(self, client: TestClient, sample_note: dict):
        """Test getting notes filtered by type."""
        response = client.get(f"/api/notes/?note_type={sample_note['note_type']}")
        assert response.status_code == 200

    def test_get_note_by_id(self, client: TestClient, sample_note: dict):
        """Test getting a specific note with mentions."""
        response = client.get(f"/api/notes/{sample_note['id']}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == sample_note["id"]
        assert "mentioned_thinkers" in data

    def test_get_note_not_found(self, client: TestClient):
        """Test getting non-existent note returns 404."""
        fake_id = "00000000-0000-0000-0000-000000000000"
        response = client.get(f"/api/notes/{fake_id}")
        assert response.status_code == 404

    def test_update_note(self, client: TestClient, sample_note: dict):
        """Test updating a note."""
        response = client.put(f"/api/notes/{sample_note['id']}", json={
            "title": "Updated Title",
            "content": "Updated content."
        })
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "Updated Title"
        assert data["content"] == "Updated content."

    def test_update_note_not_found(self, client: TestClient):
        """Test updating non-existent note returns 404."""
        fake_id = "00000000-0000-0000-0000-000000000000"
        response = client.put(f"/api/notes/{fake_id}", json={
            "title": "New Title"
        })
        assert response.status_code == 404

    def test_delete_note(self, client: TestClient, sample_note: dict):
        """Test deleting a note."""
        response = client.delete(f"/api/notes/{sample_note['id']}")
        assert response.status_code == 204

        # Verify it's gone
        get_response = client.get(f"/api/notes/{sample_note['id']}")
        assert get_response.status_code == 404

    def test_delete_note_not_found(self, client: TestClient):
        """Test deleting non-existent note returns 404."""
        fake_id = "00000000-0000-0000-0000-000000000000"
        response = client.delete(f"/api/notes/{fake_id}")
        assert response.status_code == 404

    def test_get_note_versions(self, client: TestClient, sample_note: dict):
        """Test getting note version history."""
        # Update the note to create a version
        client.put(f"/api/notes/{sample_note['id']}", json={
            "content": "Updated content for version test."
        })

        response = client.get(f"/api/notes/{sample_note['id']}/versions")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    def test_get_backlinks(self, client: TestClient, sample_thinker: dict):
        """Test getting backlinks to a thinker."""
        response = client.get(f"/api/notes/backlinks/{sample_thinker['id']}")
        assert response.status_code == 200
        assert isinstance(response.json(), list)
