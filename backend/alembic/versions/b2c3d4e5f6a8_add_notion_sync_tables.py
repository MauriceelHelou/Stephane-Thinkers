"""add notion_sync_map and notion_sync_jobs tables

Revision ID: b2c3d4e5f6a8
Revises: a1b2c3d4e5f7
Create Date: 2026-02-14 21:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

from app.db_types import GUID


# revision identifiers, used by Alembic.
revision: str = "b2c3d4e5f6a8"
down_revision: Union[str, None] = "a1b2c3d4e5f7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "notion_sync_map",
        sa.Column("id", GUID(), primary_key=True),
        sa.Column("local_id", GUID(), nullable=False),
        sa.Column("entity_type", sa.String(50), nullable=False),
        sa.Column("notion_page_id", sa.String(100), nullable=False),
        sa.Column("last_synced_at", sa.DateTime, nullable=False),
        sa.Column("content_hash", sa.String(64), nullable=True),
        sa.UniqueConstraint("entity_type", "local_id", name="uq_notion_sync_map_entity_local"),
        sa.UniqueConstraint("notion_page_id", name="uq_notion_sync_map_notion_page"),
    )
    op.create_index("ix_notion_sync_map_local_id", "notion_sync_map", ["local_id"])
    op.create_index("ix_notion_sync_map_notion_page_id", "notion_sync_map", ["notion_page_id"])
    op.create_index("ix_notion_sync_map_entity_type", "notion_sync_map", ["entity_type"])

    op.create_table(
        "notion_sync_jobs",
        sa.Column("id", GUID(), primary_key=True),
        sa.Column("job_type", sa.String(30), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="running"),
        sa.Column("started_at", sa.DateTime, nullable=False),
        sa.Column("completed_at", sa.DateTime, nullable=True),
        sa.Column("pages_created", sa.Integer, nullable=True, server_default="0"),
        sa.Column("pages_updated", sa.Integer, nullable=True, server_default="0"),
        sa.Column("pages_skipped", sa.Integer, nullable=True, server_default="0"),
        sa.Column("error_message", sa.Text, nullable=True),
        sa.Column("idempotency_key", sa.String(100), nullable=True),
        sa.UniqueConstraint("idempotency_key", name="uq_notion_sync_jobs_idempotency_key"),
    )
    op.create_index("ix_notion_sync_jobs_status_started", "notion_sync_jobs", ["status", "started_at"])


def downgrade() -> None:
    op.drop_table("notion_sync_jobs")
    op.drop_table("notion_sync_map")
