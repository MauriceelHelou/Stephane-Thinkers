"""
Notion one-way notes mirror API endpoints.

All endpoints enforce standard auth. Sync is always one-way
(Stephane-Thinkers -> Notion). Notion never becomes write-authoritative.
"""
import logging

from fastapi import APIRouter, Depends, Request, HTTPException
from sqlalchemy import inspect
from sqlalchemy.orm import Session

from app.database import get_db
from app.security import require_operator_token

router = APIRouter(prefix="/api/notion", tags=["notion"])
logger = logging.getLogger(__name__)
audit_logger = logging.getLogger("audit.notion")


def _require_notion_operator(request: Request, operation: str) -> None:
    require_operator_token(
        request,
        token_env_var="NOTION_OPERATOR_TOKEN",
        scope=operation,
    )


def _require_notion_tables_initialized(db: Session) -> None:
    required = {"notion_sync_map", "notion_sync_jobs"}
    inspector = inspect(db.get_bind())
    existing = set(inspector.get_table_names())
    missing = sorted(required - existing)
    if missing:
        raise HTTPException(
            status_code=503,
            detail=f"Notion sync subsystem is not initialized. Missing tables: {', '.join(missing)}",
        )


@router.post("/setup")
def notion_setup(request: Request, db: Session = Depends(get_db)):
    """Create the Notion database for notes mirror."""
    _require_notion_operator(request, "Notion setup")
    client_ip = request.client.host if request.client else "unknown"
    audit_logger.info(
        "notion_setup_triggered",
        extra={"event": "notion_setup_triggered", "client_ip": client_ip},
    )

    from app.services.notion_sync import setup_notion_database
    return setup_notion_database(db=db)


@router.post("/sync")
def notion_incremental_sync(request: Request, db: Session = Depends(get_db)):
    """Run incremental sync: only notes updated since last sync."""
    _require_notion_tables_initialized(db)
    client_ip = request.client.host if request.client else "unknown"
    audit_logger.info(
        "notion_incremental_sync_triggered",
        extra={"event": "notion_incremental_sync_triggered", "client_ip": client_ip},
    )

    from app.services.notion_sync import incremental_sync
    return incremental_sync(db=db)


@router.post("/full-sync")
def notion_full_sync(request: Request, db: Session = Depends(get_db)):
    """Run full sync: create or update all notes in Notion."""
    _require_notion_tables_initialized(db)
    _require_notion_operator(request, "Notion full sync")
    client_ip = request.client.host if request.client else "unknown"
    audit_logger.warning(
        "notion_full_sync_triggered",
        extra={"event": "notion_full_sync_triggered", "client_ip": client_ip},
    )

    from app.services.notion_sync import full_sync
    return full_sync(db=db)


@router.post("/update-schema")
def notion_update_schema(request: Request, db: Session = Depends(get_db)):
    """Add any missing mirror properties to an existing Notion database."""
    _require_notion_tables_initialized(db)
    _require_notion_operator(request, "Notion schema update")
    client_ip = request.client.host if request.client else "unknown"
    audit_logger.warning(
        "notion_schema_update_triggered",
        extra={"event": "notion_schema_update_triggered", "client_ip": client_ip},
    )

    from app.services.notion_sync import update_notion_database_schema
    return update_notion_database_schema(db=db)


@router.get("/status")
def notion_status(db: Session = Depends(get_db)):
    """Return current Notion sync status."""
    _require_notion_tables_initialized(db)
    from app.services.notion_sync import get_sync_status
    return get_sync_status(db=db)
