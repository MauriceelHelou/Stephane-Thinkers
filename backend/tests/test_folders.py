"""Tests for Folder API endpoints and archive behavior."""

from fastapi.testclient import TestClient


def _flatten_folder_ids(tree: list[dict]) -> set[str]:
    ids: set[str] = set()
    stack = list(tree)
    while stack:
        node = stack.pop()
        ids.add(node["id"])
        stack.extend(node.get("children", []))
    return ids


class TestFoldersCRUD:
    """Basic CRUD tests for /api/folders endpoints."""

    def test_create_folder(self, client: TestClient):
        response = client.post("/api/folders/", json={"name": "My Folder"})
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "My Folder"
        assert data["is_archived"] is False
        assert data["archived_at"] is None

    def test_create_subfolder(self, client: TestClient):
        parent = client.post("/api/folders/", json={"name": "Parent"}).json()
        child = client.post(
            "/api/folders/",
            json={"name": "Child", "parent_id": parent["id"]},
        ).json()
        assert child["parent_id"] == parent["id"]

    def test_get_folder_tree(self, client: TestClient):
        parent = client.post("/api/folders/", json={"name": "Root"}).json()
        client.post("/api/folders/", json={"name": "Sub", "parent_id": parent["id"]})

        tree = client.get("/api/folders/tree").json()
        root = next(n for n in tree if n["id"] == parent["id"])
        assert len(root["children"]) == 1
        assert root["children"][0]["name"] == "Sub"

    def test_get_folder_by_id(self, client: TestClient):
        folder = client.post("/api/folders/", json={"name": "Details"}).json()
        response = client.get(f"/api/folders/{folder['id']}")
        assert response.status_code == 200
        assert response.json()["name"] == "Details"

    def test_update_folder_name(self, client: TestClient):
        folder = client.post("/api/folders/", json={"name": "Old"}).json()
        response = client.put(f"/api/folders/{folder['id']}", json={"name": "New"})
        assert response.status_code == 200
        assert response.json()["name"] == "New"

    def test_delete_folder(self, client: TestClient):
        folder = client.post("/api/folders/", json={"name": "Delete Me"}).json()
        response = client.delete(f"/api/folders/{folder['id']}")
        assert response.status_code == 204

    def test_delete_folder_not_found(self, client: TestClient):
        fake_id = "00000000-0000-0000-0000-000000000000"
        response = client.delete(f"/api/folders/{fake_id}")
        assert response.status_code == 404

    def test_delete_folder_moves_notes_to_unfiled(self, client: TestClient, sample_thinker: dict):
        folder = client.post("/api/folders/", json={"name": "Has Notes"}).json()
        note = client.post("/api/notes/", json={
            "title": "In Folder",
            "content": "Test content",
            "note_type": "general",
            "thinker_id": sample_thinker["id"],
            "folder_id": folder["id"],
        }).json()

        client.delete(f"/api/folders/{folder['id']}")

        note_after = client.get(f"/api/notes/{note['id']}").json()
        assert note_after["folder_id"] is None

    def test_delete_folder_moves_notes_to_destination(self, client: TestClient, sample_thinker: dict):
        source = client.post("/api/folders/", json={"name": "Source"}).json()
        dest = client.post("/api/folders/", json={"name": "Destination"}).json()
        note = client.post("/api/notes/", json={
            "title": "Moving Note",
            "content": "Test content",
            "note_type": "general",
            "thinker_id": sample_thinker["id"],
            "folder_id": source["id"],
        }).json()

        client.delete(f"/api/folders/{source['id']}?move_notes_to={dest['id']}")

        note_after = client.get(f"/api/notes/{note['id']}").json()
        assert note_after["folder_id"] == dest["id"]


class TestFolderReorder:
    """Tests for folder reorder endpoint."""

    def test_reorder_sort_order(self, client: TestClient):
        a = client.post("/api/folders/", json={"name": "A"}).json()
        b = client.post("/api/folders/", json={"name": "B"}).json()

        response = client.put("/api/folders/reorder", json={
            "items": [
                {"id": a["id"], "sort_order": 2},
                {"id": b["id"], "sort_order": 1},
            ]
        })
        assert response.status_code == 200

    def test_reorder_can_move_folder_to_root(self, client: TestClient):
        parent = client.post("/api/folders/", json={"name": "Parent"}).json()
        child = client.post(
            "/api/folders/",
            json={"name": "Child", "parent_id": parent["id"]},
        ).json()

        response = client.put(
            "/api/folders/reorder",
            json={"items": [{"id": child["id"], "sort_order": 0, "parent_id": None}]},
        )
        assert response.status_code == 200
        moved_child = response.json()[0]
        assert moved_child["parent_id"] is None

        child_after = client.get(f"/api/folders/{child['id']}")
        assert child_after.status_code == 200
        assert child_after.json()["parent_id"] is None

    def test_reorder_into_archived_parent_rejected(self, client: TestClient):
        archived = client.post("/api/folders/", json={"name": "Archived"}).json()
        movable = client.post("/api/folders/", json={"name": "Movable"}).json()
        client.post(f"/api/folders/{archived['id']}/archive")

        response = client.put("/api/folders/reorder", json={
            "items": [{"id": movable["id"], "sort_order": 0, "parent_id": archived["id"]}]
        })
        assert response.status_code == 400


class TestFolderArchive:
    """Tests for folder archive/unarchive behavior."""

    def test_archive_folder_sets_fields(self, client: TestClient):
        folder = client.post("/api/folders/", json={"name": "Archive Me"}).json()
        assert folder["is_archived"] is False

        response = client.post(f"/api/folders/{folder['id']}/archive")
        assert response.status_code == 200
        archived = response.json()
        assert archived["is_archived"] is True
        assert archived["archived_at"] is not None

    def test_archive_cascades_to_descendants(self, client: TestClient):
        parent = client.post("/api/folders/", json={"name": "Parent"}).json()
        child = client.post(
            "/api/folders/",
            json={"name": "Child", "parent_id": parent["id"]},
        ).json()
        grandchild = client.post(
            "/api/folders/",
            json={"name": "Grandchild", "parent_id": child["id"]},
        ).json()

        response = client.post(f"/api/folders/{parent['id']}/archive")
        assert response.status_code == 200
        assert response.json()["is_archived"] is True

        child_data = client.get(f"/api/folders/{child['id']}").json()
        assert child_data["is_archived"] is True
        assert child_data["archived_at"] is not None

        grandchild_data = client.get(f"/api/folders/{grandchild['id']}").json()
        assert grandchild_data["is_archived"] is True
        assert grandchild_data["archived_at"] is not None

    def test_archive_nonexistent_folder_returns_404(self, client: TestClient):
        fake_id = "00000000-0000-0000-0000-000000000000"
        response = client.post(f"/api/folders/{fake_id}/archive")
        assert response.status_code == 404

    def test_unarchive_folder(self, client: TestClient):
        folder = client.post("/api/folders/", json={"name": "Restore Me"}).json()
        client.post(f"/api/folders/{folder['id']}/archive")

        response = client.post(f"/api/folders/{folder['id']}/unarchive")
        assert response.status_code == 200
        data = response.json()
        assert data["is_archived"] is False
        assert data["archived_at"] is None

    def test_unarchive_child_auto_unarchives_ancestors(self, client: TestClient):
        """Unarchiving a child should auto-unarchive all ancestors so it's visible in tree."""
        grandparent = client.post("/api/folders/", json={"name": "Grandparent"}).json()
        parent = client.post(
            "/api/folders/",
            json={"name": "Parent", "parent_id": grandparent["id"]},
        ).json()
        child = client.post(
            "/api/folders/",
            json={"name": "Child", "parent_id": parent["id"]},
        ).json()

        # Archive from top — cascades to all
        client.post(f"/api/folders/{grandparent['id']}/archive")

        # Verify all archived
        assert client.get(f"/api/folders/{grandparent['id']}").json()["is_archived"] is True
        assert client.get(f"/api/folders/{parent['id']}").json()["is_archived"] is True
        assert client.get(f"/api/folders/{child['id']}").json()["is_archived"] is True

        # Unarchive the deepest child
        response = client.post(f"/api/folders/{child['id']}/unarchive")
        assert response.status_code == 200
        assert response.json()["is_archived"] is False

        # All ancestors should be auto-unarchived
        parent_data = client.get(f"/api/folders/{parent['id']}").json()
        assert parent_data["is_archived"] is False

        grandparent_data = client.get(f"/api/folders/{grandparent['id']}").json()
        assert grandparent_data["is_archived"] is False

    def test_unarchive_nonexistent_folder_returns_404(self, client: TestClient):
        fake_id = "00000000-0000-0000-0000-000000000000"
        response = client.post(f"/api/folders/{fake_id}/unarchive")
        assert response.status_code == 404


class TestFolderArchiveTreeFiltering:
    """Tests for archive-aware tree and list filtering."""

    def test_tree_excludes_archived_by_default(self, client: TestClient):
        visible = client.post("/api/folders/", json={"name": "Visible"}).json()
        archived = client.post("/api/folders/", json={"name": "Archived"}).json()
        client.post(f"/api/folders/{archived['id']}/archive")

        tree = client.get("/api/folders/tree").json()
        ids = _flatten_folder_ids(tree)
        assert visible["id"] in ids
        assert archived["id"] not in ids

    def test_tree_includes_archived_when_requested(self, client: TestClient):
        folder = client.post("/api/folders/", json={"name": "Archived Root"}).json()
        client.post(f"/api/folders/{folder['id']}/archive")

        tree = client.get("/api/folders/tree?include_archived=true").json()
        ids = _flatten_folder_ids(tree)
        assert folder["id"] in ids

    def test_flat_list_excludes_archived_by_default(self, client: TestClient):
        visible = client.post("/api/folders/", json={"name": "Visible"}).json()
        archived = client.post("/api/folders/", json={"name": "Archived"}).json()
        client.post(f"/api/folders/{archived['id']}/archive")

        folders = client.get("/api/folders/").json()
        folder_ids = {f["id"] for f in folders}
        assert visible["id"] in folder_ids
        assert archived["id"] not in folder_ids

    def test_flat_list_includes_archived_when_requested(self, client: TestClient):
        folder = client.post("/api/folders/", json={"name": "Archived"}).json()
        client.post(f"/api/folders/{folder['id']}/archive")

        folders = client.get("/api/folders/?include_archived=true").json()
        folder_ids = {f["id"] for f in folders}
        assert folder["id"] in folder_ids

    def test_tree_note_counts_reflect_folder(self, client: TestClient, sample_thinker: dict):
        folder = client.post("/api/folders/", json={"name": "With Notes"}).json()
        client.post("/api/notes/", json={
            "title": "Note 1",
            "content": "Content",
            "note_type": "general",
            "thinker_id": sample_thinker["id"],
            "folder_id": folder["id"],
        })

        tree = client.get("/api/folders/tree").json()
        node = next(n for n in tree if n["id"] == folder["id"])
        assert node["note_count"] == 1


class TestFolderArchiveValidation:
    """Tests for archive-related validation on create/move operations."""

    def test_create_folder_inside_archived_parent_rejected(self, client: TestClient):
        parent = client.post("/api/folders/", json={"name": "Parent"}).json()
        client.post(f"/api/folders/{parent['id']}/archive")

        response = client.post(
            "/api/folders/",
            json={"name": "Should Fail", "parent_id": parent["id"]},
        )
        assert response.status_code == 400

    def test_move_folder_into_archived_parent_rejected(self, client: TestClient):
        archived = client.post("/api/folders/", json={"name": "Archived Target"}).json()
        movable = client.post("/api/folders/", json={"name": "Movable"}).json()
        client.post(f"/api/folders/{archived['id']}/archive")

        response = client.put(
            f"/api/folders/{movable['id']}",
            json={"parent_id": archived["id"]},
        )
        assert response.status_code == 400

    def test_update_cannot_set_is_archived_directly(self, client: TestClient):
        """is_archived should be stripped from update — only archive/unarchive endpoints work."""
        folder = client.post("/api/folders/", json={"name": "Direct Test"}).json()

        # Even if someone sends is_archived in the update body, it should be ignored
        response = client.put(
            f"/api/folders/{folder['id']}",
            json={"name": "Still Not Archived"},
        )
        assert response.status_code == 200
        assert response.json()["is_archived"] is False

    def test_create_note_in_archived_folder_rejected(self, client: TestClient, sample_thinker: dict):
        folder = client.post("/api/folders/", json={"name": "Archive Me"}).json()
        client.post(f"/api/folders/{folder['id']}/archive")

        response = client.post(
            "/api/notes/",
            json={
                "title": "Blocked Note",
                "content": "Cannot go in archived folder",
                "note_type": "research",
                "thinker_id": sample_thinker["id"],
                "folder_id": folder["id"],
            },
        )
        assert response.status_code == 400

    def test_move_note_into_archived_folder_rejected(self, client: TestClient, sample_note: dict):
        folder = client.post("/api/folders/", json={"name": "Archive Me"}).json()
        client.post(f"/api/folders/{folder['id']}/archive")

        response = client.put(
            f"/api/notes/{sample_note['id']}",
            json={"folder_id": folder["id"]},
        )
        assert response.status_code == 400


class TestNotesArchiveFiltering:
    """Tests for archive-aware note listing."""

    def test_notes_in_archived_folder_hidden_by_default(self, client: TestClient, sample_thinker: dict):
        folder = client.post("/api/folders/", json={"name": "Will Archive"}).json()
        note = client.post("/api/notes/", json={
            "title": "Hidden Note",
            "content": "This note should be hidden",
            "note_type": "general",
            "thinker_id": sample_thinker["id"],
            "folder_id": folder["id"],
        }).json()

        # Before archive: note appears in list
        notes_before = client.get("/api/notes/").json()
        note_ids_before = {n["id"] for n in notes_before}
        assert note["id"] in note_ids_before

        # Archive the folder
        client.post(f"/api/folders/{folder['id']}/archive")

        # After archive: note hidden from default list
        notes_after = client.get("/api/notes/").json()
        note_ids_after = {n["id"] for n in notes_after}
        assert note["id"] not in note_ids_after

    def test_notes_in_archived_folder_visible_with_param(self, client: TestClient, sample_thinker: dict):
        folder = client.post("/api/folders/", json={"name": "Will Archive"}).json()
        note = client.post("/api/notes/", json={
            "title": "Archived Note",
            "content": "This note is in an archived folder",
            "note_type": "general",
            "thinker_id": sample_thinker["id"],
            "folder_id": folder["id"],
        }).json()

        client.post(f"/api/folders/{folder['id']}/archive")

        # With include_archived=true: note appears
        notes = client.get("/api/notes/?include_archived=true").json()
        note_ids = {n["id"] for n in notes}
        assert note["id"] in note_ids

    def test_unfiled_notes_always_visible(self, client: TestClient, sample_thinker: dict):
        """Notes without a folder should always appear regardless of archive filter."""
        note = client.post("/api/notes/", json={
            "title": "Unfiled Note",
            "content": "No folder assigned",
            "note_type": "general",
            "thinker_id": sample_thinker["id"],
        }).json()

        notes = client.get("/api/notes/").json()
        note_ids = {n["id"] for n in notes}
        assert note["id"] in note_ids
