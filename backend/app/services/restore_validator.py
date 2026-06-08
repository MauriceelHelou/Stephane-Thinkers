"""
Restore validation service.

Performs automated restore drills by loading a backup artifact into an
isolated in-memory SQLite database and validating row counts, checksums,
and manifest signatures.
"""
import json
import logging
import os
import time
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.database import Base, SessionLocal
from app.models.backup import BackupArtifact, RestoreValidationRun
from app.services.backup_manifest import (
    build_manifest,
    verify_file_checksum,
    verify_manifest_signature,
)

logger = logging.getLogger(__name__)


def validate_artifact(artifact_id: str, db: Optional[Session] = None) -> dict:
    """Run a full restore validation drill for a specific backup artifact.

    1. Verify file checksum
    2. Verify manifest signature
    3. Restore into an isolated in-memory SQLite database
    4. Compare row counts against backup metadata

    Returns a summary dict and records the result in restore_validation_runs.
    """
    own_session = db is None
    if own_session:
        db = SessionLocal()

    start_time = time.monotonic()
    validation_id = uuid.uuid4()

    try:
        artifact = db.query(BackupArtifact).filter(
            BackupArtifact.id == uuid.UUID(artifact_id) if isinstance(artifact_id, str) else artifact_id
        ).first()

        if not artifact:
            return {"status": "failed", "error": "Artifact not found"}

        validation = RestoreValidationRun(
            id=validation_id,
            artifact_id=artifact.id,
            status="running",
            started_at=datetime.now(timezone.utc),
        )
        db.add(validation)
        db.commit()

        # ---- Step 1: Verify file exists and checksum ----
        if not os.path.exists(artifact.file_path):
            validation.status = "failed"
            validation.error_message = "Backup file not found on disk"
            validation.completed_at = datetime.now(timezone.utc)
            validation.elapsed_seconds = int(time.monotonic() - start_time)
            db.commit()
            return {"status": "failed", "error": "Backup file not found on disk"}

        checksum_valid = verify_file_checksum(artifact.file_path, artifact.checksum_sha256)
        validation.checksum_valid = 1 if checksum_valid else 0

        if not checksum_valid:
            validation.status = "failed"
            validation.error_message = "Checksum mismatch"
            validation.completed_at = datetime.now(timezone.utc)
            validation.elapsed_seconds = int(time.monotonic() - start_time)
            db.commit()
            return {"status": "failed", "error": "Checksum mismatch", "checksum_valid": False}

        # ---- Step 2: Verify manifest signature ----
        signature_valid = False
        # Load backup payload once for exported_at + counts
        with open(artifact.file_path, "r") as f:
            backup_data = json.load(f)

        metadata = backup_data.get("metadata", {}) if isinstance(backup_data, dict) else {}
        backup_counts = metadata.get("counts", {}) if isinstance(metadata, dict) else {}
        exported_at = metadata.get("exported_at", "") if isinstance(metadata, dict) else ""
        total_rows = sum(backup_counts.values()) if isinstance(backup_counts, dict) else 0

        if artifact.manifest_signature:
            manifest = build_manifest(
                backup_run_id=str(artifact.backup_run_id),
                file_path=artifact.file_path,
                checksum_sha256=artifact.checksum_sha256,
                size_bytes=artifact.size_bytes,
                total_rows=total_rows,
                exported_at=exported_at,
            )
            try:
                signature_valid = verify_manifest_signature(
                    manifest,
                    artifact.manifest_signature,
                    key_id=artifact.signing_key_id,
                )
            except RuntimeError:
                signature_valid = False

        validation.signature_valid = 1 if signature_valid else 0

        # ---- Step 3: Restore into isolated in-memory SQLite ----
        data = backup_data.get("data", {}) if isinstance(backup_data, dict) else {}

        # Create isolated in-memory database
        test_engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(test_engine)
        TestSession = sessionmaker(bind=test_engine)
        test_db = TestSession()

        try:
            from app.routes.backup import _normalize_rows_for_table, topological_sort

            restored_counts = {}
            for table in Base.metadata.sorted_tables:
                # Skip backup metadata tables
                if table.name in ("backup_runs", "backup_artifacts", "restore_validation_runs"):
                    continue

                table_data = data.get(table.name, [])

                if table.name in ["folders", "research_questions"]:
                    table_data = topological_sort(
                        table_data,
                        "parent_id" if table.name == "folders" else "parent_question_id"
                    )

                normalized_rows = _normalize_rows_for_table(table, table_data)
                restored_counts[table.name] = len(normalized_rows)

                if normalized_rows:
                    test_db.execute(table.insert(), normalized_rows)

            test_db.commit()

            # ---- Step 4: Compare row counts ----
            row_count_match = True
            for table_name, expected_count in backup_counts.items():
                actual = restored_counts.get(table_name, 0)
                if actual != expected_count:
                    row_count_match = False
                    logger.warning(
                        "Row count mismatch for %s: expected=%d actual=%d",
                        table_name, expected_count, actual,
                    )

            validation.row_count_match = 1 if row_count_match else 0

        except Exception as exc:
            validation.status = "failed"
            validation.error_message = f"Restore drill failed: {str(exc)[:500]}"
            validation.completed_at = datetime.now(timezone.utc)
            validation.elapsed_seconds = int(time.monotonic() - start_time)
            db.commit()
            return {"status": "failed", "error": str(exc)[:500]}
        finally:
            test_db.close()

        # ---- Mark validation complete ----
        elapsed = int(time.monotonic() - start_time)
        all_passed = checksum_valid and signature_valid and row_count_match
        validation.status = "passed" if all_passed else "failed"
        validation.completed_at = datetime.now(timezone.utc)
        validation.elapsed_seconds = elapsed
        db.commit()

        logger.info(
            "Restore validation %s: checksum=%s signature=%s rows=%s elapsed=%ds",
            "PASSED" if all_passed else "FAILED",
            checksum_valid, signature_valid, row_count_match, elapsed,
        )

        return {
            "validation_id": str(validation_id),
            "artifact_id": artifact_id,
            "status": validation.status,
            "checksum_valid": checksum_valid,
            "signature_valid": signature_valid,
            "row_count_match": row_count_match,
            "elapsed_seconds": elapsed,
        }

    except Exception as exc:
        logger.exception("Restore validation failed")
        return {"status": "failed", "error": str(exc)[:500]}
    finally:
        if own_session:
            db.close()
