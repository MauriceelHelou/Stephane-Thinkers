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

    def test_detect_thinkers_does_not_modify_content(self, client: TestClient, sample_thinker: dict):
        """Detect thinkers should update mentions/co-occurrence only."""
        note_response = client.post("/api/notes/", json={
            "title": "Detection Scope Test",
            "content": f"{sample_thinker['name']} appears in this note.",
            "note_type": "research",
            "thinker_id": sample_thinker["id"]
        })
        assert note_response.status_code == 201
        note = note_response.json()
        original_content = note["content"]

        detect_response = client.post(f"/api/notes/{note['id']}/detect-thinkers")
        assert detect_response.status_code == 200
        detect_data = detect_response.json()
        assert "content_modified" not in detect_data
        assert len(detect_data["known_thinkers"]) >= 1

        updated_note_response = client.get(f"/api/notes/{note['id']}")
        assert updated_note_response.status_code == 200
        updated_note = updated_note_response.json()
        assert updated_note["content"] == original_content

    def test_annotate_years_updates_note_content(self, client: TestClient, sample_thinker: dict):
        """Year annotation is an explicit action and updates note content/html."""
        note_response = client.post("/api/notes/", json={
            "title": "Annotation Test",
            "content": f"{sample_thinker['name']} appears in this note.",
            "content_html": f"<p>{sample_thinker['name']} appears in this note.</p>",
            "note_type": "research",
            "thinker_id": sample_thinker["id"]
        })
        assert note_response.status_code == 201
        note = note_response.json()

        detect_response = client.post(f"/api/notes/{note['id']}/detect-thinkers")
        assert detect_response.status_code == 200

        annotate_response = client.post(f"/api/notes/{note['id']}/annotate-years")
        assert annotate_response.status_code == 200
        annotate_data = annotate_response.json()
        expected_years = f"[{sample_thinker['birth_year']}-{sample_thinker['death_year']}]"
        assert annotate_data["content_modified"] is True
        assert expected_years in (annotate_data.get("updated_content") or "")
        assert expected_years in (annotate_data.get("updated_content_html") or "")

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

    def test_update_note_empty_content_rejected(self, client: TestClient, sample_note: dict):
        """Test updating a note with empty content fails validation."""
        response = client.put(f"/api/notes/{sample_note['id']}", json={
            "content": "   "
        })
        assert response.status_code == 422

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

    def test_create_note_with_multiple_tags(self, client: TestClient, sample_thinker: dict):
        tag_a = client.post("/api/note-tags/", json={"name": "Exam: General 1"}).json()
        tag_b = client.post("/api/note-tags/", json={"name": "Diss: Ch 1"}).json()

        response = client.post("/api/notes/", json={
            "title": "Tagged Note",
            "content": "A note with two tags.",
            "thinker_id": sample_thinker["id"],
            "tag_ids": [tag_a["id"], tag_b["id"]],
        })
        assert response.status_code == 201
        data = response.json()
        returned_tag_ids = {tag["id"] for tag in data["tags"]}
        assert returned_tag_ids == {tag_a["id"], tag_b["id"]}

    def test_update_note_tags_add_remove(self, client: TestClient, sample_note: dict):
        tag_a = client.post("/api/note-tags/", json={"name": "Exam: General 2"}).json()
        tag_b = client.post("/api/note-tags/", json={"name": "Diss: Ch 2"}).json()
        tag_c = client.post("/api/note-tags/", json={"name": "Course: Seminar 1"}).json()

        first_update = client.put(f"/api/notes/{sample_note['id']}", json={
            "tag_ids": [tag_a["id"], tag_b["id"]],
        })
        assert first_update.status_code == 200
        assert {tag["id"] for tag in first_update.json()["tags"]} == {tag_a["id"], tag_b["id"]}

        second_update = client.put(f"/api/notes/{sample_note['id']}", json={
            "tag_ids": [tag_b["id"], tag_c["id"]],
        })
        assert second_update.status_code == 200
        assert {tag["id"] for tag in second_update.json()["tags"]} == {tag_b["id"], tag_c["id"]}

        clear_update = client.put(f"/api/notes/{sample_note['id']}", json={"tag_ids": []})
        assert clear_update.status_code == 200
        assert clear_update.json()["tags"] == []

    def test_get_notes_filter_by_single_tag(self, client: TestClient, sample_thinker: dict):
        tag_exam = client.post("/api/note-tags/", json={"name": "Exam: General 1"}).json()
        tag_diss = client.post("/api/note-tags/", json={"name": "Diss: Ch 1"}).json()

        note_a = client.post("/api/notes/", json={
            "title": "Exam only",
            "content": "Note A",
            "thinker_id": sample_thinker["id"],
            "tag_ids": [tag_exam["id"]],
        }).json()
        client.post("/api/notes/", json={
            "title": "Diss only",
            "content": "Note B",
            "thinker_id": sample_thinker["id"],
            "tag_ids": [tag_diss["id"]],
        })
        note_c = client.post("/api/notes/", json={
            "title": "Exam + Diss",
            "content": "Note C",
            "thinker_id": sample_thinker["id"],
            "tag_ids": [tag_exam["id"], tag_diss["id"]],
        }).json()

        response = client.get(f"/api/notes/?tag_ids={tag_exam['id']}")
        assert response.status_code == 200
        data = response.json()
        returned_ids = {note["id"] for note in data}
        assert note_a["id"] in returned_ids
        assert note_c["id"] in returned_ids
        assert all(tag_exam["id"] in {tag["id"] for tag in note["tags"]} for note in data)

    def test_get_notes_filter_by_multiple_tags_all_semantics(self, client: TestClient, sample_thinker: dict):
        tag_exam = client.post("/api/note-tags/", json={"name": "Exam: General 3"}).json()
        tag_diss = client.post("/api/note-tags/", json={"name": "Diss: Ch 3"}).json()

        client.post("/api/notes/", json={
            "title": "Exam only",
            "content": "Exam-only note",
            "thinker_id": sample_thinker["id"],
            "tag_ids": [tag_exam["id"]],
        })
        both = client.post("/api/notes/", json={
            "title": "Exam + Diss",
            "content": "Intersection note",
            "thinker_id": sample_thinker["id"],
            "tag_ids": [tag_exam["id"], tag_diss["id"]],
        }).json()

        response = client.get(f"/api/notes/?tag_ids={tag_exam['id']},{tag_diss['id']}")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["id"] == both["id"]

    def test_get_notes_filter_by_folder_and_tag(self, client: TestClient, sample_thinker: dict):
        tag = client.post("/api/note-tags/", json={"name": "Exam: General 4"}).json()
        folder_a = client.post("/api/folders/", json={"name": "Exam Folder"}).json()
        folder_b = client.post("/api/folders/", json={"name": "Other Folder"}).json()

        in_folder = client.post("/api/notes/", json={
            "title": "In folder A",
            "content": "Folder A note",
            "thinker_id": sample_thinker["id"],
            "folder_id": folder_a["id"],
            "tag_ids": [tag["id"]],
        }).json()
        client.post("/api/notes/", json={
            "title": "In folder B",
            "content": "Folder B note",
            "thinker_id": sample_thinker["id"],
            "folder_id": folder_b["id"],
            "tag_ids": [tag["id"]],
        })

        response = client.get(f"/api/notes/?folder_id={folder_a['id']}&tag_ids={tag['id']}")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["id"] == in_folder["id"]

    def test_create_note_unknown_tag_rejected(self, client: TestClient, sample_thinker: dict):
        response = client.post("/api/notes/", json={
            "title": "Bad tag",
            "content": "Should fail",
            "thinker_id": sample_thinker["id"],
            "tag_ids": ["00000000-0000-0000-0000-000000000000"],
        })
        assert response.status_code == 404

    def test_update_note_unknown_tag_rejected(self, client: TestClient, sample_note: dict):
        response = client.put(f"/api/notes/{sample_note['id']}", json={
            "tag_ids": ["00000000-0000-0000-0000-000000000000"],
        })
        assert response.status_code == 404

    def test_get_notes_invalid_tag_uuid_rejected(self, client: TestClient):
        response = client.get("/api/notes/?tag_ids=not-a-uuid")
        assert response.status_code == 422
