"""Add research notes system tables

Revision ID: 9a8b7c6d5e4f
Revises: 1c2d3e4f5a6b
Create Date: 2026-02-13 01:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

from app.db_types import GUID


revision: str = "9a8b7c6d5e4f"
down_revision: Union[str, None] = "1c2d3e4f5a6b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "folders",
        sa.Column("id", GUID(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("parent_id", GUID(), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=True),
        sa.Column("color", sa.String(), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=True),
        sa.Column("updated_at", sa.TIMESTAMP(), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=True),
        sa.ForeignKeyConstraint(["parent_id"], ["folders.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "critical_terms",
        sa.Column("id", GUID(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=True),
        sa.Column("updated_at", sa.TIMESTAMP(), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )

    op.create_table(
        "term_occurrences",
        sa.Column("id", GUID(), nullable=False),
        sa.Column("term_id", GUID(), nullable=False),
        sa.Column("note_id", GUID(), nullable=False),
        sa.Column("context_snippet", sa.Text(), nullable=False),
        sa.Column("paragraph_index", sa.Integer(), nullable=True),
        sa.Column("char_offset", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=True),
        sa.ForeignKeyConstraint(["note_id"], ["notes.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["term_id"], ["critical_terms.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index("ix_term_occurrences_term_id", "term_occurrences", ["term_id"], unique=False)
    op.create_index("ix_term_occurrences_note_id", "term_occurrences", ["note_id"], unique=False)

    op.create_table(
        "thinker_mentions",
        sa.Column("id", GUID(), nullable=False),
        sa.Column("note_id", GUID(), nullable=False),
        sa.Column("thinker_id", GUID(), nullable=False),
        sa.Column("paragraph_index", sa.Integer(), nullable=True),
        sa.Column("char_offset", sa.Integer(), nullable=True),
        sa.Column("mention_text", sa.String(), nullable=False),
        sa.Column("is_auto_detected", sa.Boolean(), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=True),
        sa.ForeignKeyConstraint(["note_id"], ["notes.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["thinker_id"], ["thinkers.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index("ix_thinker_mentions_note_id", "thinker_mentions", ["note_id"], unique=False)
    op.create_index("ix_thinker_mentions_thinker_id", "thinker_mentions", ["thinker_id"], unique=False)

    op.create_table(
        "thinker_co_occurrences",
        sa.Column("id", GUID(), nullable=False),
        sa.Column("thinker_a_id", GUID(), nullable=False),
        sa.Column("thinker_b_id", GUID(), nullable=False),
        sa.Column("note_id", GUID(), nullable=False),
        sa.Column("paragraph_index", sa.Integer(), nullable=True),
        sa.Column("co_occurrence_type", sa.String(), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=True),
        sa.ForeignKeyConstraint(["note_id"], ["notes.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["thinker_a_id"], ["thinkers.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["thinker_b_id"], ["thinkers.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "thinker_a_id",
            "thinker_b_id",
            "note_id",
            "paragraph_index",
            name="uq_co_occurrence_pair_note_paragraph",
        ),
    )

    op.create_index(
        "ix_thinker_co_occurrences_thinker_a_id",
        "thinker_co_occurrences",
        ["thinker_a_id"],
        unique=False,
    )
    op.create_index(
        "ix_thinker_co_occurrences_thinker_b_id",
        "thinker_co_occurrences",
        ["thinker_b_id"],
        unique=False,
    )
    op.create_index("ix_thinker_co_occurrences_note_id", "thinker_co_occurrences", ["note_id"], unique=False)

    with op.batch_alter_table("notes", schema=None) as batch_op:
        batch_op.add_column(sa.Column("folder_id", GUID(), nullable=True))
        batch_op.create_foreign_key(
            "fk_notes_folder_id_folders",
            "folders",
            ["folder_id"],
            ["id"],
            ondelete="SET NULL",
        )
        batch_op.create_index("ix_notes_folder_id", ["folder_id"], unique=False)


def downgrade() -> None:
    with op.batch_alter_table("notes", schema=None) as batch_op:
        batch_op.drop_index("ix_notes_folder_id")
        batch_op.drop_constraint("fk_notes_folder_id_folders", type_="foreignkey")
        batch_op.drop_column("folder_id")

    op.drop_index("ix_thinker_co_occurrences_note_id", table_name="thinker_co_occurrences")
    op.drop_index("ix_thinker_co_occurrences_thinker_b_id", table_name="thinker_co_occurrences")
    op.drop_index("ix_thinker_co_occurrences_thinker_a_id", table_name="thinker_co_occurrences")
    op.drop_table("thinker_co_occurrences")

    op.drop_index("ix_thinker_mentions_thinker_id", table_name="thinker_mentions")
    op.drop_index("ix_thinker_mentions_note_id", table_name="thinker_mentions")
    op.drop_table("thinker_mentions")

    op.drop_index("ix_term_occurrences_note_id", table_name="term_occurrences")
    op.drop_index("ix_term_occurrences_term_id", table_name="term_occurrences")
    op.drop_table("term_occurrences")

    op.drop_table("critical_terms")
    op.drop_table("folders")
