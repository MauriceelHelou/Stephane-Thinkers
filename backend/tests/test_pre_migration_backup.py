"""Tests for the pre-migration safety backup.

The backup runs BEFORE `alembic upgrade head`, so the live database can be
missing columns that the ORM models already declare (e.g. a freshly-added
column whose migration hasn't applied yet). The backup must dump whatever the
current schema actually has instead of failing on the not-yet-existing column.
"""
import json

from sqlalchemy import create_engine, text

import pre_migration_backup


def test_backup_skips_columns_missing_from_db(tmp_path, monkeypatch):
    """A column declared on the ORM model but absent from the live DB (pre
    migration) must be omitted from the backup, not crash it."""
    db_path = tmp_path / "legacy.db"
    engine = create_engine(f"sqlite:///{db_path}")

    # Recreate timeline_events as it exists in production BEFORE the end_year
    # migration: i.e. WITHOUT the end_year column the ORM now declares.
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                CREATE TABLE timeline_events (
                    id TEXT PRIMARY KEY,
                    timeline_id TEXT,
                    name TEXT,
                    year INTEGER,
                    event_type TEXT,
                    description TEXT,
                    created_at TEXT,
                    updated_at TEXT
                )
                """
            )
        )
        conn.execute(
            text(
                "INSERT INTO timeline_events (id, name, year) "
                "VALUES ('11111111-1111-1111-1111-111111111111', 'Peloponnesian War', -431)"
            )
        )

    monkeypatch.setattr(pre_migration_backup, "BACKUP_DIR", str(tmp_path / "backups"))

    filepath = pre_migration_backup._create_backup(f"sqlite:///{db_path}")

    with open(filepath) as f:
        backup = json.load(f)

    events = backup["data"]["timeline_events"]
    assert len(events) == 1
    assert events[0]["name"] == "Peloponnesian War"
    assert events[0]["year"] == -431
    # end_year is on the ORM model but not in this DB yet → must be omitted.
    assert "end_year" not in events[0]
    assert backup["metadata"]["counts"]["timeline_events"] == 1
