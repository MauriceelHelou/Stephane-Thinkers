"""
Pre-migration backup script.

Invoked by start.sh before alembic upgrade head.
Creates a JSON backup of the database and writes it to a timestamped file.

Exit codes:
  0 - backup succeeded (or no pending migrations)
  1 - backup failed
"""
import json
import os
import sys
from datetime import datetime, timezone

from dotenv import load_dotenv

load_dotenv()

from sqlalchemy import create_engine, select, inspect
from sqlalchemy.orm import sessionmaker, Session

# Ensure app modules are importable
sys.path.insert(0, os.path.dirname(__file__))

from app.database import Base
import app.models  # noqa: F401 - register metadata
from app.routes.backup import serialize_row


BACKUP_DIR = os.getenv("PRE_MIGRATION_BACKUP_DIR", "./data/backups/pre-migration")


def _needs_migration() -> bool:
    """Return True if alembic detects pending migrations."""
    try:
        from alembic.config import Config
        from alembic.script import ScriptDirectory
        from alembic.migration import MigrationContext

        alembic_cfg = Config("alembic.ini")
        script = ScriptDirectory.from_config(alembic_cfg)

        database_url = os.getenv("DATABASE_URL", "")
        if database_url.startswith("postgres://"):
            database_url = database_url.replace("postgres://", "postgresql://", 1)

        engine = create_engine(database_url)
        with engine.connect() as conn:
            migration_ctx = MigrationContext.configure(conn)
            current_rev = migration_ctx.get_current_revision()

        head_rev = script.get_current_head()
        return current_rev != head_rev
    except Exception as exc:
        # If we can't determine migration state, assume migrations are pending
        # to be safe (fail-closed).
        print(f"[pre-migration-backup] WARNING: Could not check migration state: {exc}", file=sys.stderr)
        return True


def _create_backup(database_url: str) -> str:
    """Create a JSON backup of the database. Returns the output file path."""
    if database_url.startswith("postgres://"):
        database_url = database_url.replace("postgres://", "postgresql://", 1)

    engine = create_engine(database_url)
    SessionLocal = sessionmaker(bind=engine)
    db: Session = SessionLocal()

    try:
        inspector = inspect(engine)
        existing_tables = set(inspector.get_table_names())

        data = {}
        counts = {}
        for table in Base.metadata.sorted_tables:
            # During pending-migration deploys, code metadata can include tables
            # that do not exist yet in the current database schema. Skip them.
            if table.name not in existing_tables:
                continue
            # ...and can include COLUMNS the pending migration hasn't added yet
            # (e.g. a freshly-declared column). Selecting those would raise
            # UndefinedColumn and abort the backup, so back up only the columns
            # that actually exist in the live schema.
            db_columns = {col["name"] for col in inspector.get_columns(table.name)}
            existing_cols = [col for col in table.columns if col.name in db_columns]
            if not existing_cols:
                continue
            rows = db.execute(select(*existing_cols)).fetchall()
            serialized = [serialize_row(row) for row in rows]
            data[table.name] = serialized
            counts[table.name] = len(serialized)

        metadata = {
            "version": "1.0",
            "type": "pre-migration",
            "exported_at": datetime.now(timezone.utc).isoformat(),
            "database_type": "sqlite" if database_url.startswith("sqlite") else "postgresql",
            "counts": counts,
        }

        backup = {"metadata": metadata, "data": data}

        os.makedirs(BACKUP_DIR, exist_ok=True)
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
        filename = f"pre-migration-{timestamp}.json"
        filepath = os.path.join(BACKUP_DIR, filename)

        with open(filepath, "w") as f:
            json.dump(backup, f, indent=2)

        return filepath
    finally:
        db.close()


def main() -> int:
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        print("[pre-migration-backup] ERROR: DATABASE_URL is not set", file=sys.stderr)
        return 1

    # Check whether there are pending migrations
    if not _needs_migration():
        print("[pre-migration-backup] No pending migrations detected. Skipping backup.")
        return 0

    print("[pre-migration-backup] Pending migrations detected. Creating safety backup...")

    try:
        filepath = _create_backup(database_url)
        total_rows = 0
        with open(filepath, "r") as f:
            backup_data = json.load(f)
            for table_name, count in backup_data.get("metadata", {}).get("counts", {}).items():
                total_rows += count

        size_kb = os.path.getsize(filepath) / 1024
        print(f"[pre-migration-backup] SUCCESS: Backup created at {filepath} ({size_kb:.1f} KB, {total_rows} rows)")
        return 0
    except Exception as exc:
        print(f"[pre-migration-backup] ERROR: Backup failed: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
