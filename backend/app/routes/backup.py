"""
Database backup and restore endpoints.
Allows exporting the entire database as JSON and importing from a backup file.
"""
import logging
import json
import io
from datetime import datetime
from uuid import UUID
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import select
from sqlalchemy.sql.sqltypes import DateTime

from app.database import get_db, Base
from app.constants import API_VERSION
from app.db_types import GUID

router = APIRouter(prefix="/api/backup", tags=["backup"])
logger = logging.getLogger(__name__)

# Hard cap to avoid unbounded memory usage for uploads.
MAX_BACKUP_SIZE_BYTES = 50 * 1024 * 1024


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
def export_database(db: Session = Depends(get_db)):
    """
    Export the entire database as a JSON file.
    Returns a downloadable JSON file with all tables in dependency order.
    """
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
            "exported_at": datetime.utcnow().isoformat(),
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
        timestamp = datetime.utcnow().strftime("%Y%m%d-%H%M%S")
        filename = f"backup-{timestamp}.json"

        # Return as streaming response
        return StreamingResponse(
            io.BytesIO(json_bytes),
            media_type="application/json",
            headers={
                "Content-Disposition": f"attachment; filename=\"{filename}\""
            }
        )

    except Exception:
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
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Import/restore the database from a JSON backup file.
    This REPLACES all existing data (full wipe + restore).
    Uses a single transaction for atomicity.
    """
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

        return {
            "success": True,
            "message": f"Successfully imported database from backup (version {backup_version})",
            "counts": imported_counts
        }

    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON format")
    except HTTPException:
        raise  # Re-raise HTTP exceptions
    except Exception:
        logger.exception("Database import failed")
        raise HTTPException(status_code=500, detail="Import failed")
