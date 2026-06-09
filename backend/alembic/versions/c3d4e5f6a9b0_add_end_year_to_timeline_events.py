"""add end_year to timeline_events

Revision ID: c3d4e5f6a9b0
Revises: b2c3d4e5f6a8
Create Date: 2026-06-08 00:00:00.000000

Pure additive migration: adds a nullable `end_year` column so timeline events
can span a range. No backfill — every existing row stays NULL (point-in-time).

WARNING: `downgrade` drops the column and therefore permanently discards any
user-entered end_year values. This is acceptable for a rollback but is data-loss,
not a no-op.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c3d4e5f6a9b0"
down_revision: Union[str, None] = "b2c3d4e5f6a8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "timeline_events",
        sa.Column("end_year", sa.Integer(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("timeline_events", "end_year")
