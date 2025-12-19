"""
Test utilities endpoints - only available in development mode.
"""
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy import text, inspect
from sqlalchemy.orm import Session
from app.database import get_db
import os

router = APIRouter(prefix="/api/test", tags=["test"])


@router.post("/reset")
def reset_database(db: Session = Depends(get_db)):
    """
    Reset database by clearing all data.
    Only available in development mode for testing.
    """
    # Safety check - only allow in development
    if os.getenv("ENVIRONMENT", "development") == "production":
        raise HTTPException(
            status_code=403,
            detail="Database reset is not allowed in production"
        )

    try:
        # Disable foreign key checks temporarily (SQLite syntax)
        db.execute(text("PRAGMA foreign_keys = OFF;"))

        # Delete all data from tables in reverse dependency order
        tables = [
            'combined_view_members',
            'combined_timeline_views',
            'thinker_tags',
            'connections',
            'quotes',
            'publications',
            'timeline_events',
            'thinkers',
            'tags',
            'timelines'
        ]

        for table in tables:
            # Use DELETE instead of TRUNCATE for SQLite compatibility
            try:
                db.execute(text(f"DELETE FROM {table};"))
            except Exception:
                pass  # Table may not exist

        # Check if sqlite_sequence exists before trying to delete from it
        inspector = inspect(db.get_bind())
        all_tables = inspector.get_table_names()
        if 'sqlite_sequence' in all_tables:
            db.execute(text("DELETE FROM sqlite_sequence;"))

        # Re-enable foreign key checks
        db.execute(text("PRAGMA foreign_keys = ON;"))

        db.commit()

        return {"message": "Database reset successfully", "tables_cleared": len(tables)}

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database reset failed: {str(e)}")
