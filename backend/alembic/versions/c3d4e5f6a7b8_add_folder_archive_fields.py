"""Add folder archive fields

Revision ID: c3d4e5f6a7b8
Revises: 9a8b7c6d5e4f
Create Date: 2026-02-13 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c3d4e5f6a7b8"
down_revision: Union[str, None] = "9a8b7c6d5e4f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "folders",
        sa.Column("is_archived", sa.Boolean(), nullable=False, server_default="0"),
    )
    op.add_column(
        "folders",
        sa.Column("archived_at", sa.TIMESTAMP(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("folders", "archived_at")
    op.drop_column("folders", "is_archived")
