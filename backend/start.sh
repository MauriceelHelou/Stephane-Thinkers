#!/bin/bash
set -e

# ---------------------------------------------------------------------------
# Pre-migration safety backup (fail-closed by default)
# ---------------------------------------------------------------------------
# Set ALLOW_MIGRATION_WITHOUT_BACKUP=true in the environment only for
# break-glass incident recovery. Normal deployments MUST have a successful
# backup before migrations run.

ALLOW_MIGRATION_WITHOUT_BACKUP="${ALLOW_MIGRATION_WITHOUT_BACKUP:-false}"
PYTHON_BIN="${PYTHON_BIN:-python3}"

if ! command -v "$PYTHON_BIN" >/dev/null 2>&1; then
    PYTHON_BIN="python"
fi

if ! command -v "$PYTHON_BIN" >/dev/null 2>&1; then
    echo "ERROR: No Python interpreter found for pre-migration backup step."
    exit 1
fi

echo "Running pre-migration backup..."
if "$PYTHON_BIN" pre_migration_backup.py; then
    echo "Pre-migration backup succeeded."
else
    if [ "$ALLOW_MIGRATION_WITHOUT_BACKUP" = "true" ]; then
        echo "WARNING: Pre-migration backup FAILED but ALLOW_MIGRATION_WITHOUT_BACKUP=true. Proceeding (break-glass override)."
    else
        echo "ERROR: Pre-migration backup failed. Aborting deployment."
        echo "Set ALLOW_MIGRATION_WITHOUT_BACKUP=true to override (incident use only)."
        exit 1
    fi
fi

echo "Running database migrations..."
alembic upgrade head

echo "Starting server..."
exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8010}
