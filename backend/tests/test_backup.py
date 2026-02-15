"""
Tests for database backup and restore functionality.
"""
import json
from fastapi.testclient import TestClient


class TestBackupExport:
    """Tests for database export endpoint."""

    def test_export_empty_database(self, client: TestClient):
        """Test exporting an empty database returns valid JSON with counts=0."""
        response = client.get("/api/backup/export")
        assert response.status_code == 200
        assert response.headers["content-type"] == "application/json"
        assert "attachment" in response.headers["content-disposition"]

        # Parse the downloaded JSON
        backup = json.loads(response.content)
        assert "metadata" in backup
        assert "data" in backup
        assert backup["metadata"]["version"] == "1.0"

        # All counts should be 0 for empty database
        for table_name, count in backup["metadata"]["counts"].items():
            assert count == 0

    def test_export_with_data(self, client: TestClient, sample_thinker: dict, sample_connection: dict):
        """Test exporting database with actual data."""
        response = client.get("/api/backup/export")
        assert response.status_code == 200

        backup = json.loads(response.content)
        counts = backup["metadata"]["counts"]

        # Should have at least one timeline, one thinker, and one connection
        assert counts["timelines"] >= 1
        assert counts["thinkers"] >= 1
        assert counts["connections"] >= 1

        # Data should contain the actual records
        assert len(backup["data"]["thinkers"]) >= 1
        assert len(backup["data"]["connections"]) >= 1


class TestBackupImportPreview:
    """Tests for backup import preview endpoint."""

    def test_preview_valid_backup(self, client: TestClient, sample_thinker: dict):
        """Test preview endpoint with a valid backup file."""
        # Export first
        export_response = client.get("/api/backup/export")
        backup_content = export_response.content

        # Preview the export
        files = {"file": ("backup.json", backup_content, "application/json")}
        response = client.post("/api/backup/import/preview", files=files)

        assert response.status_code == 200
        data = response.json()
        assert data["valid"] is True
        assert "metadata" in data
        assert len(data.get("warnings", [])) == 0

    def test_preview_invalid_json(self, client: TestClient):
        """Test preview with invalid JSON returns error."""
        files = {"file": ("backup.json", b"not valid json", "application/json")}
        response = client.post("/api/backup/import/preview", files=files)

        assert response.status_code == 200
        data = response.json()
        assert data["valid"] is False
        assert len(data["warnings"]) > 0
        assert "Invalid JSON" in data["warnings"][0]

    def test_preview_missing_structure(self, client: TestClient):
        """Test preview with JSON missing required structure."""
        invalid_backup = json.dumps({"some": "data"})
        files = {"file": ("backup.json", invalid_backup.encode(), "application/json")}
        response = client.post("/api/backup/import/preview", files=files)

        assert response.status_code == 200
        data = response.json()
        assert data["valid"] is False
        assert any("missing" in w.lower() for w in data["warnings"])


class TestBackupImport:
    """Tests for database import endpoint."""

    def test_round_trip_import(self, client: TestClient, sample_thinker: dict, sample_connection: dict):
        """Test export → import round-trip preserves data."""
        # Get original data
        original_thinker = client.get(f"/api/thinkers/{sample_thinker['id']}").json()
        original_connection = client.get(f"/api/connections/{sample_connection['id']}").json()

        # Export
        export_response = client.get("/api/backup/export")
        backup_content = export_response.content

        # Import
        files = {"file": ("backup.json", backup_content, "application/json")}
        import_response = client.post("/api/backup/import", files=files)

        assert import_response.status_code == 200
        import_data = import_response.json()
        assert import_data["success"] is True

        # Verify data is preserved
        restored_thinker = client.get(f"/api/thinkers/{sample_thinker['id']}").json()
        restored_connection = client.get(f"/api/connections/{sample_connection['id']}").json()

        assert restored_thinker["name"] == original_thinker["name"]
        assert restored_thinker["birth_year"] == original_thinker["birth_year"]
        assert restored_connection["connection_type"] == original_connection["connection_type"]

    def test_import_invalid_json(self, client: TestClient):
        """Test import with invalid JSON returns 400 error."""
        files = {"file": ("backup.json", b"not valid json", "application/json")}
        response = client.post("/api/backup/import", files=files)

        assert response.status_code == 400
        assert "Invalid JSON" in response.json()["detail"]

    def test_import_missing_structure(self, client: TestClient):
        """Test import with JSON missing required structure returns 400."""
        invalid_backup = json.dumps({"some": "data"})
        files = {"file": ("backup.json", invalid_backup.encode(), "application/json")}
        response = client.post("/api/backup/import", files=files)

        assert response.status_code == 400
        assert "Invalid backup file" in response.json()["detail"]

    def test_import_version_mismatch(self, client: TestClient):
        """Test import with wrong major version is rejected."""
        backup = {
            "metadata": {
                "version": "1.0",
                "api_version": "99.0.0",  # Wrong major version
                "exported_at": "2026-01-01T00:00:00",
                "counts": {}
            },
            "data": {}
        }
        backup_json = json.dumps(backup).encode()
        files = {"file": ("backup.json", backup_json, "application/json")}
        response = client.post("/api/backup/import", files=files)

        assert response.status_code == 400
        assert "Version mismatch" in response.json()["detail"]

    def test_import_self_referential(self, client: TestClient):
        """Test import handles self-referential tables (folders) correctly."""
        # Create nested folders
        parent_folder = client.post("/api/folders/", json={
            "name": "Parent Folder"
        }).json()

        child_folder = client.post("/api/folders/", json={
            "name": "Child Folder",
            "parent_id": parent_folder["id"]
        }).json()

        # Export
        export_response = client.get("/api/backup/export")
        backup_content = export_response.content

        # Import
        files = {"file": ("backup.json", backup_content, "application/json")}
        import_response = client.post("/api/backup/import", files=files)

        assert import_response.status_code == 200

        # Verify parent-child relationship preserved
        restored_child = client.get(f"/api/folders/{child_folder['id']}").json()
        assert restored_child["parent_id"] == parent_folder["id"]

    def test_import_circular_reference(self, client: TestClient):
        """Test import detects circular references in folders."""
        # Create a backup with circular reference
        folder_id_1 = "11111111-1111-1111-1111-111111111111"
        folder_id_2 = "22222222-2222-2222-2222-222222222222"

        backup = {
            "metadata": {
                "version": "1.0",
                "api_version": "1.0.1",
                "exported_at": "2026-01-01T00:00:00",
                "counts": {"folders": 2}
            },
            "data": {
                "timelines": [],
                "tags": [],
                "institutions": [],
                "combined_timeline_views": [],
                "critical_terms": [],
                "thinkers": [],
                "combined_view_members": [],
                "timeline_events": [],
                "connections": [],
                "publications": [],
                "quotes": [],
                "thinker_institutions": [],
                "quiz_questions": [],
                "quiz_sessions": [],
                "folders": [
                    {"id": folder_id_1, "name": "Folder 1", "parent_id": folder_id_2},
                    {"id": folder_id_2, "name": "Folder 2", "parent_id": folder_id_1}
                ],
                "research_questions": [],
                "notes": [],
                "quiz_answers": [],
                "spaced_repetition_queue": [],
                "note_versions": [],
                "term_occurrences": [],
                "thinker_mentions": [],
                "thinker_co_occurrences": [],
                "thinker_tags": [],
                "publication_contributors": [],
                "note_mentions": [],
                "research_question_thinkers": []
            }
        }

        backup_json = json.dumps(backup).encode()
        files = {"file": ("backup.json", backup_json, "application/json")}
        response = client.post("/api/backup/import", files=files)

        assert response.status_code == 400
        assert "Circular reference" in response.json()["detail"]

    def test_import_older_backup_missing_tables(self, client: TestClient, sample_thinker: dict):
        """Test import from older backup (fewer tables) succeeds."""
        # Export current database
        export_response = client.get("/api/backup/export")
        backup = json.loads(export_response.content)

        # Simulate an older backup by removing some tables
        del backup["data"]["critical_terms"]
        del backup["data"]["term_occurrences"]

        backup_json = json.dumps(backup).encode()
        files = {"file": ("backup.json", backup_json, "application/json")}
        response = client.post("/api/backup/import", files=files)

        # Should succeed despite missing tables
        assert response.status_code == 200
        assert response.json()["success"] is True

    def test_rollback_on_failure(self, client: TestClient, sample_thinker: dict):
        """Test that failed import preserves existing data via rollback."""
        # Get original thinker count
        original_response = client.get("/api/thinkers/")
        original_count = len(original_response.json())

        # Create a corrupted backup (valid JSON, but will fail during insert)
        backup = {
            "metadata": {
                "version": "1.0",
                "api_version": "1.0.1",
                "exported_at": "2026-01-01T00:00:00",
                "counts": {}
            },
            "data": {
                "timelines": [],
                "tags": [],
                "institutions": [],
                "combined_timeline_views": [],
                "critical_terms": [],
                "thinkers": [
                    {"id": "invalid-uuid", "name": "Test"}  # Invalid UUID will cause error
                ],
                "combined_view_members": [],
                "timeline_events": [],
                "connections": [],
                "publications": [],
                "quotes": [],
                "thinker_institutions": [],
                "quiz_questions": [],
                "quiz_sessions": [],
                "folders": [],
                "research_questions": [],
                "notes": [],
                "quiz_answers": [],
                "spaced_repetition_queue": [],
                "note_versions": [],
                "term_occurrences": [],
                "thinker_mentions": [],
                "thinker_co_occurrences": [],
                "thinker_tags": [],
                "publication_contributors": [],
                "note_mentions": [],
                "research_question_thinkers": []
            }
        }

        backup_json = json.dumps(backup).encode()
        files = {"file": ("backup.json", backup_json, "application/json")}
        response = client.post("/api/backup/import", files=files)

        # Import should fail validation
        assert response.status_code == 400
        assert "Invalid UUID" in response.json()["detail"]

        # Original data should still be intact (rollback worked)
        after_response = client.get("/api/thinkers/")
        after_count = len(after_response.json())
        assert after_count == original_count


class TestAutomatedBackupEndpoints:
    """Tests for Phase 1 automated backup endpoints."""

    def test_status_empty(self, client: TestClient):
        response = client.get("/api/backup/status")
        assert response.status_code == 200
        payload = response.json()
        assert payload["latest_run"] is None
        assert payload["total_artifacts"] == 0
        assert payload["completed_runs"] == 0
        assert payload["failed_runs"] == 0

    def test_trigger_and_verify_signature(
        self,
        client: TestClient,
        monkeypatch,
        tmp_path,
    ):
        monkeypatch.setenv("BACKUP_SIGNING_SECRET", "test-signing-secret")
        monkeypatch.setenv("BACKUP_SIGNING_KEY_ID", "test-v1")

        import app.services.backup_jobs as backup_jobs

        backup_jobs.BACKUP_DIR = str(tmp_path)

        trigger_response = client.post("/api/backup/trigger")
        assert trigger_response.status_code == 200
        trigger_payload = trigger_response.json()
        assert trigger_payload["status"] == "completed"
        assert trigger_payload["artifact_path"].startswith(str(tmp_path))

        verify_response = client.get("/api/backup/verify")
        assert verify_response.status_code == 200
        verify_payload = verify_response.json()
        assert verify_payload["checksum_valid"] is True
        assert verify_payload["signature_valid"] is True

    def test_trigger_requires_operator_token_when_configured(self, client: TestClient, monkeypatch):
        monkeypatch.setenv("BACKUP_OPERATOR_TOKEN", "ops-token")

        missing_token = client.post("/api/backup/trigger")
        assert missing_token.status_code == 403

        bad_token = client.post(
            "/api/backup/trigger",
            headers={"X-Operator-Token": "wrong-token"},
        )
        assert bad_token.status_code == 403

    def test_retention_enforce(self, client: TestClient):
        response = client.post("/api/backup/retention/enforce")
        assert response.status_code == 200
        payload = response.json()
        assert "pruned" in payload
        assert payload["pruned"]["daily"] >= 0
        assert payload["pruned"]["weekly"] >= 0
        assert payload["pruned"]["monthly"] >= 0

    def test_reindex_chroma_endpoint(self, client: TestClient, monkeypatch):
        import app.services.chroma_reindex as chroma_reindex

        monkeypatch.setattr(
            chroma_reindex,
            "reindex_chroma",
            lambda db=None: {"status": "completed", "indexed_count": 123},
        )

        response = client.post("/api/backup/reindex-chroma")
        assert response.status_code == 200
        payload = response.json()
        assert payload["status"] == "completed"
        assert payload["indexed_count"] == 123


class TestOffsiteSyncEndpoints:
    """Tests for Phase 2 offsite sync and restore validation endpoints."""

    def test_sync_push_status_list(self, client: TestClient, monkeypatch, tmp_path):
        monkeypatch.setenv("BACKUP_SIGNING_SECRET", "test-signing-secret")
        monkeypatch.setenv("BACKUP_SIGNING_KEY_ID", "test-v1")
        monkeypatch.setenv("BACKUP_CLOUD_BACKEND", "local")
        monkeypatch.setenv("BACKUP_CLOUD_LOCAL_DIR", str(tmp_path / "offsite"))

        import app.services.backup_jobs as backup_jobs

        backup_jobs.BACKUP_DIR = str(tmp_path / "local")

        trigger_response = client.post("/api/backup/trigger")
        assert trigger_response.status_code == 200

        push_response = client.post("/api/backup/sync/push")
        assert push_response.status_code == 200
        push_payload = push_response.json()
        assert push_payload["backend"] == "local"
        assert push_payload["remote_key"].startswith("backups/")

        status_response = client.get("/api/backup/sync/status")
        assert status_response.status_code == 200
        status_payload = status_response.json()
        assert status_payload["synced"] is True
        assert status_payload["latest_cloud_artifact"]["cloud_key"] == push_payload["remote_key"]

        list_response = client.get("/api/backup/sync/list")
        assert list_response.status_code == 200
        list_payload = list_response.json()
        assert list_payload["count"] >= 1
        assert any(obj["key"] == push_payload["remote_key"] for obj in list_payload["objects"])

    def test_restore_validate(self, client: TestClient, monkeypatch, tmp_path):
        monkeypatch.setenv("BACKUP_SIGNING_SECRET", "test-signing-secret")
        monkeypatch.setenv("BACKUP_SIGNING_KEY_ID", "test-v1")

        import app.services.backup_jobs as backup_jobs

        backup_jobs.BACKUP_DIR = str(tmp_path)

        trigger_response = client.post("/api/backup/trigger")
        assert trigger_response.status_code == 200
        verify_response = client.get("/api/backup/verify")
        assert verify_response.status_code == 200
        artifact_id = verify_response.json()["artifact_id"]

        validate_response = client.post(f"/api/backup/restore/validate/{artifact_id}")
        assert validate_response.status_code == 200
        validate_payload = validate_response.json()
        assert validate_payload["status"] == "passed"
        assert validate_payload["checksum_valid"] is True
        assert validate_payload["signature_valid"] is True
        assert validate_payload["row_count_match"] is True
