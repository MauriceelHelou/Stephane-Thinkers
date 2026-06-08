"""
Automated backup job logic.

Creates JSON logical backup artifacts with integrity metadata (checksum + signed manifest),
records metadata in the backup_runs / backup_artifacts tables, and enforces retention policy.
"""
import json
import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import Base, SessionLocal
from app.models.backup import BackupRun, BackupArtifact
from app.routes.backup import serialize_row
from app.services.backup_manifest import (
    compute_file_checksum,
    build_manifest,
    sign_manifest,
)

logger = logging.getLogger(__name__)

BACKUP_DIR = os.getenv("BACKUP_DIR", "./data/backups")

# Retention policy defaults
RETENTION_DAILY = int(os.getenv("BACKUP_RETENTION_DAILY", "7"))
RETENTION_WEEKLY = int(os.getenv("BACKUP_RETENTION_WEEKLY", "4"))
RETENTION_MONTHLY = int(os.getenv("BACKUP_RETENTION_MONTHLY", "6"))


def _classify_retention_tag(now: datetime) -> str:
    """Classify a backup's retention tag based on its timestamp.

    - 1st of the month -> "monthly"
    - Monday -> "weekly"
    - everything else -> "daily"
    """
    if now.day == 1:
        return "monthly"
    if now.weekday() == 0:  # Monday
        return "weekly"
    return "daily"


def run_backup(
    trigger: str = "scheduled",
    db: Optional[Session] = None,
) -> dict:
    """Execute a full logical backup.

    Returns a summary dict with run_id, artifact_path, rows, size, and status.
    """
    own_session = db is None
    if own_session:
        db = SessionLocal()

    now = datetime.now(timezone.utc)
    run_id = uuid.uuid4()
    retention_tag = _classify_retention_tag(now)

    backup_run = BackupRun(
        id=run_id,
        trigger=trigger,
        status="running",
        started_at=now,
        retention_tag=retention_tag,
    )
    db.add(backup_run)
    db.commit()

    try:
        # ---- Generate backup data ----
        data = {}
        counts = {}
        for table in Base.metadata.sorted_tables:
            # Skip backup metadata tables themselves to avoid circular dependency
            if table.name in ("backup_runs", "backup_artifacts", "restore_validation_runs"):
                continue
            rows = db.execute(select(table)).fetchall()
            serialized = [serialize_row(row) for row in rows]
            data[table.name] = serialized
            counts[table.name] = len(serialized)

        total_rows = sum(counts.values())

        metadata_envelope = {
            "version": "1.0",
            "type": "automated",
            "trigger": trigger,
            "backup_run_id": str(run_id),
            "exported_at": now.isoformat(),
            "counts": counts,
        }
        backup_payload = {"metadata": metadata_envelope, "data": data}
        json_bytes = json.dumps(backup_payload, indent=2).encode("utf-8")

        # ---- Write to disk ----
        os.makedirs(BACKUP_DIR, exist_ok=True)
        timestamp = now.strftime("%Y%m%d-%H%M%S")
        filename = f"backup-{timestamp}-{str(run_id)[:8]}.json"
        file_path = os.path.join(BACKUP_DIR, filename)

        with open(file_path, "wb") as f:
            f.write(json_bytes)

        size_bytes = len(json_bytes)
        checksum = compute_file_checksum(file_path)

        # ---- Sign manifest ----
        manifest = build_manifest(
            backup_run_id=str(run_id),
            file_path=file_path,
            checksum_sha256=checksum,
            size_bytes=size_bytes,
            total_rows=total_rows,
            exported_at=now.isoformat(),
        )
        signature, key_id = sign_manifest(manifest)

        # ---- Write manifest sidecar ----
        manifest_path = file_path + ".manifest.json"
        manifest_with_sig = {**manifest, "signature": signature, "key_id": key_id}
        with open(manifest_path, "w") as f:
            json.dump(manifest_with_sig, f, indent=2)

        # ---- Record artifact ----
        artifact = BackupArtifact(
            id=uuid.uuid4(),
            backup_run_id=run_id,
            file_path=file_path,
            size_bytes=size_bytes,
            checksum_sha256=checksum,
            manifest_signature=signature,
            signing_key_id=key_id,
            storage_backend="local",
        )
        db.add(artifact)

        # ---- Mark run complete ----
        backup_run.status = "completed"
        backup_run.completed_at = datetime.now(timezone.utc)
        backup_run.total_rows = total_rows
        db.commit()

        logger.info(
            "Backup completed: run_id=%s rows=%d size=%d path=%s",
            run_id, total_rows, size_bytes, file_path,
        )

        return {
            "run_id": str(run_id),
            "status": "completed",
            "artifact_path": file_path,
            "total_rows": total_rows,
            "size_bytes": size_bytes,
            "checksum_sha256": checksum,
            "retention_tag": retention_tag,
        }

    except Exception as exc:
        backup_run.status = "failed"
        backup_run.completed_at = datetime.now(timezone.utc)
        backup_run.error_message = str(exc)[:2000]
        db.commit()
        logger.exception("Backup failed: run_id=%s", run_id)
        raise
    finally:
        if own_session:
            db.close()


def enforce_retention(db: Optional[Session] = None) -> dict:
    """Delete expired backup artifacts according to the retention policy.

    Retention thresholds:
      - daily: keep last N
      - weekly: keep last N
      - monthly: keep last N

    Returns counts of pruned artifacts per tag.
    """
    own_session = db is None
    if own_session:
        db = SessionLocal()

    pruned = {"daily": 0, "weekly": 0, "monthly": 0}

    try:
        for tag, keep_count in [
            ("daily", RETENTION_DAILY),
            ("weekly", RETENTION_WEEKLY),
            ("monthly", RETENTION_MONTHLY),
        ]:
            runs = (
                db.query(BackupRun)
                .filter(BackupRun.retention_tag == tag, BackupRun.status == "completed")
                .order_by(BackupRun.started_at.desc())
                .all()
            )

            if len(runs) <= keep_count:
                continue

            expired_runs = runs[keep_count:]
            for run in expired_runs:
                for artifact in run.artifacts:
                    # Remove files from disk
                    for path in [artifact.file_path, artifact.file_path + ".manifest.json"]:
                        if path and os.path.exists(path):
                            try:
                                os.remove(path)
                            except OSError:
                                logger.warning("Could not delete %s", path)
                    db.delete(artifact)
                db.delete(run)
                pruned[tag] += 1

        db.commit()
        logger.info("Retention enforcement completed: pruned=%s", pruned)
        return pruned
    finally:
        if own_session:
            db.close()


def run_scheduled_cycle(db: Optional[Session] = None) -> dict:
    """Run the scheduled backup cycle: backup creation then retention enforcement."""
    own_session = db is None
    if own_session:
        db = SessionLocal()

    try:
        backup_result = run_backup(trigger="scheduled", db=db)
        pruned = enforce_retention(db=db)
        return {
            "backup": backup_result,
            "retention_pruned": pruned,
        }
    finally:
        if own_session:
            db.close()
