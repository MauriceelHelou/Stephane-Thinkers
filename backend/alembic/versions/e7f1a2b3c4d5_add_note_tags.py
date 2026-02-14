"""add_note_tags

Revision ID: e7f1a2b3c4d5
Revises: d4e5f6a7b8c9
Create Date: 2026-02-14 19:10:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

from app.db_types import GUID


revision: str = "e7f1a2b3c4d5"
down_revision: Union[str, None] = "d4e5f6a7b8c9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "note_tags",
        sa.Column("id", GUID(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("color", sa.String(), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )

    op.create_table(
        "note_tag_assignments",
        sa.Column("note_id", GUID(), nullable=False),
        sa.Column("note_tag_id", GUID(), nullable=False),
        sa.ForeignKeyConstraint(["note_id"], ["notes.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["note_tag_id"], ["note_tags.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("note_id", "note_tag_id"),
    )
    op.create_index(
        "ix_note_tag_assignments_note_tag_id",
        "note_tag_assignments",
        ["note_tag_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_note_tag_assignments_note_tag_id", table_name="note_tag_assignments")
    op.drop_table("note_tag_assignments")
    op.drop_table("note_tags")
