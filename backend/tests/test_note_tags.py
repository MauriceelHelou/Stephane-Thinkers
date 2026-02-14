"""Tests for Note Tag API endpoints."""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import IntegrityError

from app.models.note_tag import NoteTag


class TestNoteTagsAPI:
    """Test suite for /api/note-tags endpoints."""

    def test_create_note_tag(self, client: TestClient):
        response = client.post("/api/note-tags/", json={"name": "Exam: General 1", "color": "#64748b"})
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Exam: General 1"
        assert data["color"] == "#64748b"

    def test_create_note_tag_duplicate_case_insensitive_returns_existing(self, client: TestClient):
        first = client.post("/api/note-tags/", json={"name": "Diss: Ch 1"})
        assert first.status_code == 201
        second = client.post("/api/note-tags/", json={"name": "diss: ch 1"})
        assert second.status_code == 201
        assert second.json()["id"] == first.json()["id"]

    def test_create_note_tag_empty_name_rejected(self, client: TestClient):
        response = client.post("/api/note-tags/", json={"name": "   "})
        assert response.status_code == 422

    def test_get_note_tags(self, client: TestClient):
        client.post("/api/note-tags/", json={"name": "A"})
        client.post("/api/note-tags/", json={"name": "B"})
        response = client.get("/api/note-tags/")
        assert response.status_code == 200
        assert isinstance(response.json(), list)
        assert len(response.json()) >= 2

    def test_get_note_tag(self, client: TestClient):
        created = client.post("/api/note-tags/", json={"name": "Exam: General 2"}).json()
        response = client.get(f"/api/note-tags/{created['id']}")
        assert response.status_code == 200
        assert response.json()["id"] == created["id"]

    def test_get_note_tag_not_found(self, client: TestClient):
        response = client.get("/api/note-tags/00000000-0000-0000-0000-000000000000")
        assert response.status_code == 404

    def test_update_note_tag(self, client: TestClient):
        created = client.post("/api/note-tags/", json={"name": "Exam: General 3", "color": "#111111"}).json()
        response = client.put(
            f"/api/note-tags/{created['id']}",
            json={"name": "Exam: General 3 Updated", "color": "#222222"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Exam: General 3 Updated"
        assert data["color"] == "#222222"

    def test_update_note_tag_duplicate_name_rejected(self, client: TestClient):
        a = client.post("/api/note-tags/", json={"name": "Diss: Ch 2"}).json()
        client.post("/api/note-tags/", json={"name": "Diss: Ch 3"})
        response = client.put(f"/api/note-tags/{a['id']}", json={"name": "diss: ch 3"})
        assert response.status_code == 400

    def test_delete_note_tag(self, client: TestClient):
        created = client.post("/api/note-tags/", json={"name": "Delete Me"}).json()
        response = client.delete(f"/api/note-tags/{created['id']}")
        assert response.status_code == 204
        missing = client.get(f"/api/note-tags/{created['id']}")
        assert missing.status_code == 404

    def test_delete_note_tag_unassigns_from_notes(self, client: TestClient, sample_thinker: dict):
        tag = client.post("/api/note-tags/", json={"name": "Exam: General 1"}).json()
        note = client.post(
            "/api/notes/",
            json={
                "title": "Tagged note",
                "content": "Tagged note content.",
                "thinker_id": sample_thinker["id"],
                "tag_ids": [tag["id"]],
            },
        ).json()

        delete_response = client.delete(f"/api/note-tags/{tag['id']}")
        assert delete_response.status_code == 204

        note_response = client.get(f"/api/notes/{note['id']}")
        assert note_response.status_code == 200
        assert note_response.json()["tags"] == []

    def test_note_tag_name_has_db_level_case_insensitive_uniqueness(self, db):
        db.add(NoteTag(name="Exam: General 1"))
        db.commit()
        db.add(NoteTag(name="exam: general 1"))
        with pytest.raises(IntegrityError):
            db.commit()
        db.rollback()

    def test_note_tags_and_tags_endpoints_share_same_rows(self, client: TestClient):
        created_from_note_tags = client.post("/api/note-tags/", json={"name": "Shared Tag A"}).json()
        created_from_tags = client.post("/api/tags/", json={"name": "Shared Tag B"}).json()

        tags_ids = {tag["id"] for tag in client.get("/api/tags/").json()}
        note_tags_ids = {tag["id"] for tag in client.get("/api/note-tags/").json()}

        assert created_from_note_tags["id"] in tags_ids
        assert created_from_tags["id"] in note_tags_ids
