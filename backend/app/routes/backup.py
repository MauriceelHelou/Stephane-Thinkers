"""
Database backup and restore endpoints.
Allows exporting the entire database as JSON and importing from a backup file.
"""
import logging
import json
import io
import time
from datetime import datetime, timezone
from uuid import UUID
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import select, inspect
from sqlalchemy.sql.sqltypes import DateTime

from app.database import get_db, Base
from app.constants import API_VERSION
from app.db_types import GUID
from app.security import require_operator_token

router = APIRouter(prefix="/api/backup", tags=["backup"])
logger = logging.getLogger(__name__)
audit_logger = logging.getLogger("audit.backup")

# Hard cap to avoid unbounded memory usage for uploads.
MAX_BACKUP_SIZE_BYTES = 50 * 1024 * 1024


def _require_backup_tables_initialized(db: Session) -> None:
    """Fail with a clear 503 if backup metadata tables are not initialized yet."""
    required = {"backup_runs", "backup_artifacts", "restore_validation_runs"}
    inspector = inspect(db.get_bind())
    existing = set(inspector.get_table_names())
    missing = sorted(required - existing)
    if missing:
        raise HTTPException(
            status_code=503,
            detail=f"Backup subsystem is not initialized. Missing tables: {', '.join(missing)}",
        )


def _get_cloud_backend_or_503():
    """Return configured cloud backend or raise a clear 503."""
    from app.services.cloud_storage import get_cloud_backend
    try:
        return get_cloud_backend()
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Cloud storage backend is not available: {str(exc)}",
        )


def _require_backup_operator(request: Request, operation: str) -> None:
    require_operator_token(
        request,
        token_env_var="BACKUP_OPERATOR_TOKEN",
        scope=operation,
    )


def _load_backup_metadata(file_path: str) -> tuple[str, int, Dict[str, Any]]:
    """Load backup metadata from a JSON artifact."""
    try:
        with open(file_path, "r") as f:
            backup_data = json.load(f)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid backup JSON: {str(exc)}")

    metadata = backup_data.get("metadata", {})
    counts = metadata.get("counts", {}) if isinstance(metadata, dict) else {}
    exported_at = metadata.get("exported_at", "") if isinstance(metadata, dict) else ""
    total_rows = sum(counts.values()) if isinstance(counts, dict) else 0
    return exported_at, total_rows, counts


def serialize_row(row) -> Dict[str, Any]:
    """Convert SQLAlchemy model or Row to JSON-safe dict."""
    if hasattr(row, '__table__'):
        # ORM model instance
        d = {}
        for col in row.__table__.columns:
            val = getattr(row, col.key)
            if isinstance(val, UUID):
                val = str(val)
            elif isinstance(val, datetime):
                val = val.isoformat()
            elif hasattr(val, 'value'):  # Enum
                val = val.value
            d[col.key] = val
        return d
    else:
        # Row from select(table)
        d = dict(row._mapping)
        for k, v in d.items():
            if isinstance(v, UUID):
                d[k] = str(v)
            elif isinstance(v, datetime):
                d[k] = v.isoformat()
            elif hasattr(v, 'value'):  # Enum
                d[k] = v.value
        return d


def topological_sort(records: List[Dict], parent_field: str = "parent_id") -> List[Dict]:
    """Sort records so parents appear before children. Detects cycles."""
    by_id: Dict[str, Dict[str, Any]] = {}
    for idx, record in enumerate(records):
        if not isinstance(record, dict):
            raise HTTPException(
                status_code=400,
                detail=f"Invalid row format for self-referential table at index {idx}"
            )
        record_id = record.get("id")
        if record_id is None:
            raise HTTPException(
                status_code=400,
                detail=f"Missing 'id' for self-referential row at index {idx}"
            )
        key = str(record_id)
        if key in by_id:
            raise HTTPException(
                status_code=400,
                detail=f"Duplicate id '{key}' found in self-referential table"
            )
        by_id[key] = record

    result = []
    visited = set()
    visiting = set()  # Track current path for cycle detection

    def visit(record):
        rid = str(record["id"])
        if rid in visited:
            return
        if rid in visiting:
            raise HTTPException(
                status_code=400,
                detail=f"Circular reference detected in {parent_field} for record {rid}"
            )

        visiting.add(rid)
        parent = record.get(parent_field)
        if parent and str(parent) in by_id:
            visit(by_id[str(parent)])
        visiting.remove(rid)
        visited.add(rid)
        result.append(record)

    for r in records:
        visit(r)
    return result


def _validate_file_size(content: bytes) -> None:
    if len(content) > MAX_BACKUP_SIZE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Backup file too large. Maximum supported size is {MAX_BACKUP_SIZE_BYTES // (1024 * 1024)} MB."
        )


def _coerce_value(table_name: str, column_name: str, column_type: Any, value: Any) -> Any:
    if value is None:
        return None

    # Validate UUIDs eagerly so malformed backups fail before writing partial garbage.
    if isinstance(column_type, GUID):
        try:
            return str(UUID(str(value)))
        except (TypeError, ValueError, AttributeError):
            raise HTTPException(
                status_code=400,
                detail=f"Invalid UUID value for {table_name}.{column_name}"
            )

    # Validate datetimes when backups store them as ISO strings.
    if isinstance(column_type, DateTime) and isinstance(value, str):
        normalized = value.replace("Z", "+00:00") if value.endswith("Z") else value
        try:
            return datetime.fromisoformat(normalized)
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid datetime value for {table_name}.{column_name}"
            )

    # Validate SQLAlchemy Enum values when present.
    enum_values = getattr(column_type, "enums", None)
    if enum_values and isinstance(value, str) and value not in enum_values:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid enum value for {table_name}.{column_name}: '{value}'"
        )

    return value


def _normalize_rows_for_table(table: Any, table_rows: Any) -> List[Dict[str, Any]]:
    if table_rows is None:
        return []
    if not isinstance(table_rows, list):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid backup format for table '{table.name}': expected a list of rows"
        )

    normalized_rows: List[Dict[str, Any]] = []
    columns = {column.name: column for column in table.columns}

    for idx, row in enumerate(table_rows):
        if not isinstance(row, dict):
            raise HTTPException(
                status_code=400,
                detail=f"Invalid row format in table '{table.name}' at index {idx}"
            )

        normalized_row: Dict[str, Any] = {}
        for column_name, column in columns.items():
            if column_name not in row:
                continue
            normalized_row[column_name] = _coerce_value(
                table.name,
                column_name,
                column.type,
                row[column_name],
            )

        normalized_rows.append(normalized_row)

    return normalized_rows


@router.get("/export")
def export_database(request: Request, db: Session = Depends(get_db)):
    """
    Export the entire database as a JSON file.
    Returns a downloadable JSON file with all tables in dependency order.
    """
    start_time = time.monotonic()
    client_ip = request.client.host if request.client else "unknown"
    audit_logger.info(
        "backup_export_started",
        extra={"event": "backup_export_started", "client_ip": client_ip},
    )
    try:
        # Collect all data in dependency order
        data = {}
        counts = {}

        for table in Base.metadata.sorted_tables:
            # Query all rows from the table
            rows = db.execute(select(table)).fetchall()
            serialized = [serialize_row(row) for row in rows]
            data[table.name] = serialized
            counts[table.name] = len(serialized)

        # Build metadata envelope
        metadata = {
            "version": "1.0",  # Backup format version
            "api_version": API_VERSION,  # Current API version
            "exported_at": datetime.now(timezone.utc).isoformat(),
            "database_type": "sqlite" if str(db.get_bind().url).startswith("sqlite") else "postgresql",
            "counts": counts
        }

        # Create the full backup structure
        backup = {
            "metadata": metadata,
            "data": data
        }

        # Serialize to JSON
        json_str = json.dumps(backup, indent=2)
        json_bytes = json_str.encode('utf-8')

        # Create filename with timestamp
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
        filename = f"backup-{timestamp}.json"

        total_rows = sum(counts.values())
        elapsed = time.monotonic() - start_time
        audit_logger.info(
            "backup_export_completed",
            extra={
                "event": "backup_export_completed",
                "client_ip": client_ip,
                "total_rows": total_rows,
                "size_bytes": len(json_bytes),
                "elapsed_seconds": round(elapsed, 3),
            },
        )

        # Return as streaming response
        return StreamingResponse(
            io.BytesIO(json_bytes),
            media_type="application/json",
            headers={
                "Content-Disposition": f"attachment; filename=\"{filename}\""
            }
        )

    except Exception:
        elapsed = time.monotonic() - start_time
        audit_logger.error(
            "backup_export_failed",
            extra={
                "event": "backup_export_failed",
                "client_ip": client_ip,
                "elapsed_seconds": round(elapsed, 3),
            },
        )
        logger.exception("Database export failed")
        raise HTTPException(status_code=500, detail="Export failed")


@router.post("/import/preview")
async def preview_import(file: UploadFile = File(...)):
    """
    Validate a backup file and return metadata + record counts without importing.
    Used by frontend to show a confirmation dialog.
    """
    try:
        # Read and parse the file
        content = await file.read()
        _validate_file_size(content)
        backup = json.loads(content)

        # Validate structure
        if "metadata" not in backup or "data" not in backup:
            return {
                "valid": False,
                "warnings": ["Invalid backup file: missing 'metadata' or 'data'"]
            }

        metadata = backup["metadata"]

        # Validate version compatibility (major version must match)
        backup_version = metadata.get("api_version", "0.0.0")
        current_version = API_VERSION

        backup_major = backup_version.split(".")[0]
        current_major = current_version.split(".")[0]

        warnings = []
        if backup_major != current_major:
            warnings.append(
                f"Version mismatch: backup is from v{backup_version}, "
                f"current API is v{current_version}. Import may fail."
            )

        return {
            "valid": True,
            "metadata": metadata,
            "warnings": warnings
        }

    except HTTPException as exc:
        return {
            "valid": False,
            "warnings": [exc.detail]
        }
    except json.JSONDecodeError:
        return {
            "valid": False,
            "warnings": ["Invalid JSON format"]
        }
    except Exception:
        logger.exception("Backup preview failed")
        return {
            "valid": False,
            "warnings": ["Preview failed"]
        }


@router.post("/import")
async def import_database(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """
    Import/restore the database from a JSON backup file.
    This REPLACES all existing data (full wipe + restore).
    Uses a single transaction for atomicity.
    """
    start_time = time.monotonic()
    client_ip = request.client.host if request.client else "unknown"
    _require_backup_operator(request, "backup import")
    audit_logger.warning(
        "backup_import_started",
        extra={
            "event": "backup_import_started",
            "client_ip": client_ip,
            "backup_filename": file.filename,
        },
    )
    try:
        # Read and parse the file
        content = await file.read()
        _validate_file_size(content)
        backup = json.loads(content)

        # Validate structure
        if "metadata" not in backup or "data" not in backup:
            raise HTTPException(
                status_code=400,
                detail="Invalid backup file: missing 'metadata' or 'data'"
            )

        metadata = backup["metadata"]
        data = backup["data"]

        # Validate version compatibility (major version must match)
        backup_version = metadata.get("api_version", "0.0.0")
        current_version = API_VERSION

        backup_major = backup_version.split(".")[0]
        current_major = current_version.split(".")[0]

        if backup_major != current_major:
            raise HTTPException(
                status_code=400,
                detail=f"Version mismatch: backup is from v{backup_version}, "
                       f"current API is v{current_version}. Major versions must match."
            )

        imported_counts: Dict[str, int] = {}

        try:
            # Delete all data in reverse FK order
            for table in reversed(Base.metadata.sorted_tables):
                db.execute(table.delete())

            # Insert data in forward FK order
            for table in Base.metadata.sorted_tables:
                table_data = data.get(table.name, [])

                # Handle self-referential tables before normalization/inserts
                if table.name in ["folders", "research_questions"]:
                    table_data = topological_sort(
                        table_data,
                        "parent_id" if table.name == "folders" else "parent_question_id"
                    )

                normalized_rows = _normalize_rows_for_table(table, table_data)
                imported_counts[table.name] = len(normalized_rows)

                if normalized_rows:
                    db.execute(table.insert(), normalized_rows)

            db.commit()
        except HTTPException:
            db.rollback()
            raise
        except Exception:
            db.rollback()
            logger.exception("Database import failed")
            raise HTTPException(status_code=500, detail="Import failed")

        total_rows = sum(imported_counts.values())
        elapsed = time.monotonic() - start_time
        audit_logger.warning(
            "backup_import_completed",
            extra={
                "event": "backup_import_completed",
                "client_ip": client_ip,
                "backup_filename": file.filename,
                "backup_version": backup_version,
                "total_rows": total_rows,
                "elapsed_seconds": round(elapsed, 3),
            },
        )

        return {
            "success": True,
            "message": f"Successfully imported database from backup (version {backup_version})",
            "counts": imported_counts
        }

    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON format")
    except HTTPException:
        elapsed = time.monotonic() - start_time
        audit_logger.error(
            "backup_import_failed",
            extra={
                "event": "backup_import_failed",
                "client_ip": client_ip,
                "elapsed_seconds": round(elapsed, 3),
            },
        )
        raise
    except Exception:
        elapsed = time.monotonic() - start_time
        audit_logger.error(
            "backup_import_failed",
            extra={
                "event": "backup_import_failed",
                "client_ip": client_ip,
                "elapsed_seconds": round(elapsed, 3),
            },
        )
        logger.exception("Database import failed")
        raise HTTPException(status_code=500, detail="Import failed")


# ---------------------------------------------------------------------------
# Phase 1: Automated backup endpoints
# ---------------------------------------------------------------------------


@router.get("/status")
def backup_status(db: Session = Depends(get_db)):
    """Return the most recent backup run status and overall health summary."""
    from app.models.backup import BackupRun, BackupArtifact
    _require_backup_tables_initialized(db)

    latest_run = (
        db.query(BackupRun)
        .order_by(BackupRun.started_at.desc())
        .first()
    )

    total_artifacts = db.query(BackupArtifact).count()
    completed_runs = (
        db.query(BackupRun)
        .filter(BackupRun.status == "completed")
        .count()
    )
    failed_runs = (
        db.query(BackupRun)
        .filter(BackupRun.status == "failed")
        .count()
    )

    latest = None
    if latest_run:
        latest = {
            "run_id": str(latest_run.id),
            "trigger": latest_run.trigger,
            "status": latest_run.status,
            "started_at": latest_run.started_at.isoformat() if latest_run.started_at else None,
            "completed_at": latest_run.completed_at.isoformat() if latest_run.completed_at else None,
            "total_rows": latest_run.total_rows,
            "retention_tag": latest_run.retention_tag,
            "error_message": latest_run.error_message,
        }

    return {
        "latest_run": latest,
        "total_artifacts": total_artifacts,
        "completed_runs": completed_runs,
        "failed_runs": failed_runs,
    }


@router.post("/trigger")
def trigger_backup(request: Request, db: Session = Depends(get_db)):
    """Manually trigger a backup run."""
    _require_backup_tables_initialized(db)
    _require_backup_operator(request, "manual backup trigger")
    client_ip = request.client.host if request.client else "unknown"
    audit_logger.info(
        "backup_trigger_manual",
        extra={"event": "backup_trigger_manual", "client_ip": client_ip},
    )

    from app.services.backup_jobs import run_backup
    result = run_backup(trigger="manual", db=db)
    return result


@router.get("/verify")
def verify_latest_backup(db: Session = Depends(get_db)):
    """Verify the integrity of the latest backup artifact (checksum + signature)."""
    from app.models.backup import BackupRun, BackupArtifact
    from app.services.backup_manifest import (
        verify_file_checksum,
        verify_manifest_signature,
        build_manifest,
    )
    _require_backup_tables_initialized(db)

    latest_artifact = (
        db.query(BackupArtifact)
        .join(BackupRun)
        .filter(BackupRun.status == "completed")
        .order_by(BackupArtifact.created_at.desc())
        .first()
    )

    if not latest_artifact:
        raise HTTPException(status_code=404, detail="No backup artifacts found")

    # Verify checksum
    import os
    if not os.path.exists(latest_artifact.file_path):
        return {
            "artifact_id": str(latest_artifact.id),
            "checksum_valid": False,
            "signature_valid": False,
            "error": "Backup file not found on disk",
        }

    checksum_valid = verify_file_checksum(
        latest_artifact.file_path, latest_artifact.checksum_sha256
    )

    # Verify signature
    signature_valid = False
    if latest_artifact.manifest_signature:
        exported_at = ""
        total_rows = 0

        try:
            with open(latest_artifact.file_path, "r", encoding="utf-8") as backup_file:
                backup_payload = json.load(backup_file)
            metadata = backup_payload.get("metadata", {}) if isinstance(backup_payload, dict) else {}
            exported_at = str(metadata.get("exported_at") or "")
            counts = metadata.get("counts", {})
            if isinstance(counts, dict):
                total_rows = sum(value for value in counts.values() if isinstance(value, int))
        except Exception:
            run = db.query(BackupRun).filter(BackupRun.id == latest_artifact.backup_run_id).first()
            exported_at = run.started_at.isoformat() if run and run.started_at else ""
            total_rows = run.total_rows if run and isinstance(run.total_rows, int) else 0

        run = db.query(BackupRun).filter(BackupRun.id == latest_artifact.backup_run_id).first()
        manifest = build_manifest(
            backup_run_id=str(latest_artifact.backup_run_id),
            file_path=latest_artifact.file_path,
            checksum_sha256=latest_artifact.checksum_sha256,
            size_bytes=latest_artifact.size_bytes,
            total_rows=total_rows if total_rows else (run.total_rows if run and run.total_rows else 0),
            exported_at=exported_at or (run.started_at.isoformat() if run and run.started_at else ""),
        )
        try:
            signature_valid = verify_manifest_signature(
                manifest,
                latest_artifact.manifest_signature,
                key_id=latest_artifact.signing_key_id,
            )
        except RuntimeError:
            signature_valid = False

    return {
        "artifact_id": str(latest_artifact.id),
        "file_path": latest_artifact.file_path,
        "checksum_valid": checksum_valid,
        "signature_valid": signature_valid,
        "size_bytes": latest_artifact.size_bytes,
        "created_at": latest_artifact.created_at.isoformat() if latest_artifact.created_at else None,
    }


@router.post("/reindex-chroma")
def reindex_chroma_endpoint(request: Request, db: Session = Depends(get_db)):
    """Rebuild ChromaDB collection from canonical note_embeddings data."""
    _require_backup_operator(request, "chroma reindex")
    client_ip = request.client.host if request.client else "unknown"
    audit_logger.info(
        "chroma_reindex_triggered",
        extra={"event": "chroma_reindex_triggered", "client_ip": client_ip},
    )

    from app.services.chroma_reindex import reindex_chroma
    result = reindex_chroma(db=db)
    return result


@router.post("/retention/enforce")
def enforce_retention_endpoint(request: Request, db: Session = Depends(get_db)):
    """Manually trigger retention policy enforcement to prune old backups."""
    _require_backup_tables_initialized(db)
    _require_backup_operator(request, "backup retention enforcement")
    client_ip = request.client.host if request.client else "unknown"
    audit_logger.info(
        "retention_enforce_triggered",
        extra={"event": "retention_enforce_triggered", "client_ip": client_ip},
    )

    from app.services.backup_jobs import enforce_retention
    result = enforce_retention(db=db)
    return {"pruned": result}


# ---------------------------------------------------------------------------
# Phase 2: Offsite sync and restore validation endpoints
# ---------------------------------------------------------------------------


@router.post("/sync/push")
def sync_push_latest(request: Request, db: Session = Depends(get_db)):
    """Push the latest backup artifact to offsite cloud storage."""
    from app.models.backup import BackupRun, BackupArtifact
    from app.services.backup_manifest import verify_file_checksum, verify_manifest_signature, build_manifest

    _require_backup_tables_initialized(db)
    _require_backup_operator(request, "offsite backup sync push")
    client_ip = request.client.host if request.client else "unknown"
    audit_logger.info(
        "backup_sync_push",
        extra={"event": "backup_sync_push", "client_ip": client_ip},
    )

    latest_artifact = (
        db.query(BackupArtifact)
        .join(BackupRun)
        .filter(BackupRun.status == "completed")
        .order_by(BackupArtifact.created_at.desc())
        .first()
    )

    if not latest_artifact:
        raise HTTPException(status_code=404, detail="No backup artifacts to sync")

    import os
    if not os.path.exists(latest_artifact.file_path):
        raise HTTPException(status_code=404, detail="Backup file not found on disk")

    exported_at, total_rows, _counts = _load_backup_metadata(latest_artifact.file_path)

    checksum_valid = verify_file_checksum(
        latest_artifact.file_path, latest_artifact.checksum_sha256
    )
    if not checksum_valid:
        raise HTTPException(status_code=409, detail="Backup artifact checksum mismatch")

    signature_valid = False
    if latest_artifact.manifest_signature:
        manifest = build_manifest(
            backup_run_id=str(latest_artifact.backup_run_id),
            file_path=latest_artifact.file_path,
            checksum_sha256=latest_artifact.checksum_sha256,
            size_bytes=latest_artifact.size_bytes,
            total_rows=total_rows,
            exported_at=exported_at,
        )
        try:
            signature_valid = verify_manifest_signature(
                manifest,
                latest_artifact.manifest_signature,
                key_id=latest_artifact.signing_key_id,
            )
        except RuntimeError:
            signature_valid = False

    if not signature_valid:
        raise HTTPException(status_code=409, detail="Backup artifact signature invalid")

    backend = _get_cloud_backend_or_503()
    filename = os.path.basename(latest_artifact.file_path)
    remote_key = f"backups/{filename}"

    result = backend.push(latest_artifact.file_path, remote_key)

    # Also push the manifest sidecar if it exists
    manifest_path = latest_artifact.file_path + ".manifest.json"
    if os.path.exists(manifest_path):
        backend.push(manifest_path, remote_key + ".manifest.json")

    # Update artifact with cloud metadata
    latest_artifact.storage_backend = result.get("backend", "local")
    latest_artifact.cloud_key = remote_key
    db.commit()

    return {
        "artifact_id": str(latest_artifact.id),
        "remote_key": remote_key,
        **result,
    }


@router.get("/sync/status")
def sync_status(db: Session = Depends(get_db)):
    """Check offsite sync status — latest synced artifact and cloud health."""
    from app.models.backup import BackupArtifact

    _require_backup_tables_initialized(db)
    synced = (
        db.query(BackupArtifact)
        .filter(BackupArtifact.cloud_key.isnot(None))
        .order_by(BackupArtifact.created_at.desc())
        .first()
    )

    if not synced:
        return {"synced": False, "latest_cloud_artifact": None}

    return {
        "synced": True,
        "latest_cloud_artifact": {
            "artifact_id": str(synced.id),
            "cloud_key": synced.cloud_key,
            "storage_backend": synced.storage_backend,
            "size_bytes": synced.size_bytes,
            "created_at": synced.created_at.isoformat() if synced.created_at else None,
        },
    }


@router.get("/sync/list")
def sync_list(request: Request, db: Session = Depends(get_db)):
    """List all objects in the offsite cloud storage."""
    _require_backup_tables_initialized(db)
    _require_backup_operator(request, "offsite backup object listing")
    backend = _get_cloud_backend_or_503()
    objects = backend.list_objects(prefix="backups/")
    return {"objects": objects, "count": len(objects)}


@router.post("/restore/validate/{artifact_id}")
def validate_restore(artifact_id: str, request: Request, db: Session = Depends(get_db)):
    """Run a full restore validation drill for a specific backup artifact."""
    _require_backup_tables_initialized(db)
    _require_backup_operator(request, "restore validation drill")
    client_ip = request.client.host if request.client else "unknown"
    audit_logger.info(
        "restore_validation_started",
        extra={
            "event": "restore_validation_started",
            "client_ip": client_ip,
            "artifact_id": artifact_id,
        },
    )

    from app.services.restore_validator import validate_artifact
    result = validate_artifact(artifact_id=artifact_id, db=db)
    return result
