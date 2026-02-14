"""
Test utilities endpoints - only available in development mode.
"""
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.database import Base, get_db
import os

router = APIRouter(prefix="/api/test", tags=["test"])


@router.post("/reset")
def reset_database(db: Session = Depends(get_db)):
    """
    Reset database by clearing all data.
    Only available in development mode for testing.
    """
    # Safety check - only allow in explicit test mode
    if os.getenv("ENVIRONMENT", "development") != "test":
        raise HTTPException(
            status_code=403,
            detail="Database reset is only allowed in test environment"
        )

    try:
        bind = db.get_bind()
        is_sqlite = bind.dialect.name == "sqlite"

        if is_sqlite:
            db.execute(text("PRAGMA foreign_keys = OFF;"))

        # Delete from all application tables in reverse dependency order.
        table_names = [table.name for table in reversed(Base.metadata.sorted_tables)]
        for table_name in table_names:
            db.execute(text(f'DELETE FROM "{table_name}";'))

        # Reset sqlite autoincrement counters when present.
        if is_sqlite:
            has_sqlite_sequence = db.execute(
                text("SELECT name FROM sqlite_master WHERE type='table' AND name='sqlite_sequence';")
            ).scalar()
            if has_sqlite_sequence:
                db.execute(text("DELETE FROM sqlite_sequence;"))

            db.execute(text("PRAGMA foreign_keys = ON;"))

        db.commit()

        return {"message": "Database reset successfully", "tables_cleared": len(table_names)}

    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Database reset failed")
