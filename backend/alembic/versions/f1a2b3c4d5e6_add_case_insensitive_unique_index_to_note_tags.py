"""add_case_insensitive_unique_index_to_note_tags

Revision ID: f1a2b3c4d5e6
Revises: e7f1a2b3c4d5
Create Date: 2026-02-14 20:05:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f1a2b3c4d5e6"
down_revision: Union[str, None] = "e7f1a2b3c4d5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _normalize_name(value: str) -> str:
    return (value or "").strip().lower()


def upgrade() -> None:
    bind = op.get_bind()

    # Ensure old mixed-case duplicates are collapsed before adding the index.
    rows = bind.execute(
        sa.text("SELECT id, name FROM note_tags ORDER BY created_at ASC, id ASC")
    ).mappings()
    canonical_by_name: dict[str, str] = {}

    for row in rows:
        tag_id = row["id"]
        normalized = _normalize_name(row["name"])
        canonical_id = canonical_by_name.get(normalized)
        if canonical_id is None:
            canonical_by_name[normalized] = tag_id
            continue

        assignment_rows = bind.execute(
            sa.text("SELECT note_id FROM note_tag_assignments WHERE note_tag_id = :tag_id"),
            {"tag_id": tag_id},
        ).mappings()

        for assignment in assignment_rows:
            note_id = assignment["note_id"]
            already_exists = bind.execute(
                sa.text(
                    """
                    SELECT 1
                    FROM note_tag_assignments
                    WHERE note_id = :note_id AND note_tag_id = :note_tag_id
                    LIMIT 1
                    """
                ),
                {"note_id": note_id, "note_tag_id": canonical_id},
            ).first()
            if not already_exists:
                bind.execute(
                    sa.text(
                        """
                        INSERT INTO note_tag_assignments (note_id, note_tag_id)
                        VALUES (:note_id, :note_tag_id)
                        """
                    ),
                    {"note_id": note_id, "note_tag_id": canonical_id},
                )

        bind.execute(
            sa.text("DELETE FROM note_tag_assignments WHERE note_tag_id = :tag_id"),
            {"tag_id": tag_id},
        )
        bind.execute(sa.text("DELETE FROM note_tags WHERE id = :tag_id"), {"tag_id": tag_id})

    op.create_index(
        "ux_note_tags_name_lower",
        "note_tags",
        [sa.text("lower(name)")],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("ux_note_tags_name_lower", table_name="note_tags")
