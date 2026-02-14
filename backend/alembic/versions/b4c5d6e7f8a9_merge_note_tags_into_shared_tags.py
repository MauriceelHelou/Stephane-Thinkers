"""Merge note_tags into shared tags table.

Revision ID: b4c5d6e7f8a9
Revises: f1a2b3c4d5e6
Create Date: 2026-02-14 22:20:00.000000
"""

from typing import Optional, Sequence, Union
import warnings

from alembic import op
import sqlalchemy as sa
from sqlalchemy.exc import SAWarning

from app.db_types import GUID


revision: str = "b4c5d6e7f8a9"
down_revision: Union[str, None] = "f1a2b3c4d5e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _normalize_name(value: Optional[str]) -> str:
    return (value or "").strip().lower()


def _get_index_names(bind: sa.engine.Connection, table_name: str) -> set[str]:
    inspector = sa.inspect(bind)
    if not inspector.has_table(table_name):
        return set()
    with warnings.catch_warnings():
        warnings.filterwarnings(
            "ignore",
            message="Skipped unsupported reflection of expression-based index .*",
            category=SAWarning,
        )
        return {index["name"] for index in inspector.get_indexes(table_name)}


def _table_exists(bind: sa.engine.Connection, table_name: str) -> bool:
    return sa.inspect(bind).has_table(table_name)


def upgrade() -> None:
    bind = op.get_bind()

    # Collapse case-only duplicates in tags so we can enforce case-insensitive uniqueness.
    tag_rows = bind.execute(
        sa.text("SELECT id, name FROM tags ORDER BY created_at ASC, id ASC")
    ).mappings()
    canonical_by_name: dict[str, str] = {}

    for row in tag_rows:
        tag_id = row["id"]
        normalized = _normalize_name(row["name"])
        canonical_id = canonical_by_name.get(normalized)
        if canonical_id is None:
            canonical_by_name[normalized] = tag_id
            continue

        thinker_rows = bind.execute(
            sa.text("SELECT thinker_id FROM thinker_tags WHERE tag_id = :tag_id"),
            {"tag_id": tag_id},
        ).mappings()
        for thinker_row in thinker_rows:
            thinker_id = thinker_row["thinker_id"]
            exists = bind.execute(
                sa.text(
                    """
                    SELECT 1
                    FROM thinker_tags
                    WHERE thinker_id = :thinker_id AND tag_id = :tag_id
                    LIMIT 1
                    """
                ),
                {"thinker_id": thinker_id, "tag_id": canonical_id},
            ).first()
            if not exists:
                bind.execute(
                    sa.text(
                        """
                        INSERT INTO thinker_tags (thinker_id, tag_id)
                        VALUES (:thinker_id, :tag_id)
                        """
                    ),
                    {"thinker_id": thinker_id, "tag_id": canonical_id},
                )

        bind.execute(sa.text("DELETE FROM thinker_tags WHERE tag_id = :tag_id"), {"tag_id": tag_id})
        bind.execute(sa.text("DELETE FROM tags WHERE id = :tag_id"), {"tag_id": tag_id})

    note_tag_id_to_shared_tag_id: dict[str, str] = {}

    if _table_exists(bind, "note_tags"):
        note_tag_rows = bind.execute(
            sa.text("SELECT id, name, color, created_at FROM note_tags ORDER BY created_at ASC, id ASC")
        ).mappings()

        for row in note_tag_rows:
            note_tag_id = row["id"]
            normalized = _normalize_name(row["name"])
            existing_tag = bind.execute(
                sa.text(
                    """
                    SELECT id
                    FROM tags
                    WHERE lower(name) = :normalized
                    ORDER BY created_at ASC, id ASC
                    LIMIT 1
                    """
                ),
                {"normalized": normalized},
            ).first()

            if existing_tag:
                target_tag_id = existing_tag[0]
            else:
                bind.execute(
                    sa.text(
                        """
                        INSERT INTO tags (id, name, color, created_at)
                        VALUES (:id, :name, :color, :created_at)
                        """
                    ),
                    {
                        "id": note_tag_id,
                        "name": row["name"],
                        "color": row["color"],
                        "created_at": row["created_at"],
                    },
                )
                target_tag_id = note_tag_id

            note_tag_id_to_shared_tag_id[note_tag_id] = target_tag_id

    op.create_table(
        "note_tag_assignments_new",
        sa.Column("note_id", GUID(), nullable=False),
        sa.Column("note_tag_id", GUID(), nullable=False),
        sa.ForeignKeyConstraint(["note_id"], ["notes.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["note_tag_id"], ["tags.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("note_id", "note_tag_id"),
    )

    if _table_exists(bind, "note_tag_assignments"):
        assignment_rows = bind.execute(
            sa.text("SELECT note_id, note_tag_id FROM note_tag_assignments")
        ).mappings()

        inserted: set[tuple[str, str]] = set()
        for row in assignment_rows:
            mapped_tag_id = note_tag_id_to_shared_tag_id.get(row["note_tag_id"], row["note_tag_id"])
            has_tag = bind.execute(
                sa.text("SELECT 1 FROM tags WHERE id = :tag_id LIMIT 1"),
                {"tag_id": mapped_tag_id},
            ).first()
            if not has_tag:
                continue

            key = (row["note_id"], mapped_tag_id)
            if key in inserted:
                continue
            inserted.add(key)

            bind.execute(
                sa.text(
                    """
                    INSERT INTO note_tag_assignments_new (note_id, note_tag_id)
                    VALUES (:note_id, :note_tag_id)
                    """
                ),
                {"note_id": row["note_id"], "note_tag_id": mapped_tag_id},
            )

        existing_indexes = _get_index_names(bind, "note_tag_assignments")
        if "ix_note_tag_assignments_note_tag_id" in existing_indexes:
            op.drop_index("ix_note_tag_assignments_note_tag_id", table_name="note_tag_assignments")
        op.drop_table("note_tag_assignments")

    op.rename_table("note_tag_assignments_new", "note_tag_assignments")
    op.create_index(
        "ix_note_tag_assignments_note_tag_id",
        "note_tag_assignments",
        ["note_tag_id"],
        unique=False,
    )

    if _table_exists(bind, "note_tags"):
        bind.execute(sa.text("DROP INDEX IF EXISTS ux_note_tags_name_lower"))
        op.drop_table("note_tags")

    bind.execute(sa.text("CREATE UNIQUE INDEX IF NOT EXISTS ux_tags_name_lower ON tags (lower(name))"))


def downgrade() -> None:
    bind = op.get_bind()

    bind.execute(sa.text("DROP INDEX IF EXISTS ux_tags_name_lower"))

    op.create_table(
        "note_tags",
        sa.Column("id", GUID(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("color", sa.String(), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )

    if _table_exists(bind, "note_tag_assignments"):
        note_tag_rows = bind.execute(
            sa.text(
                """
                SELECT DISTINCT t.id, t.name, t.color, t.created_at
                FROM tags AS t
                JOIN note_tag_assignments AS nta ON nta.note_tag_id = t.id
                ORDER BY t.created_at ASC, t.id ASC
                """
            )
        ).mappings()
        for row in note_tag_rows:
            bind.execute(
                sa.text(
                    """
                    INSERT INTO note_tags (id, name, color, created_at)
                    VALUES (:id, :name, :color, :created_at)
                    """
                ),
                {
                    "id": row["id"],
                    "name": row["name"],
                    "color": row["color"],
                    "created_at": row["created_at"],
                },
            )

    op.create_table(
        "note_tag_assignments_old",
        sa.Column("note_id", GUID(), nullable=False),
        sa.Column("note_tag_id", GUID(), nullable=False),
        sa.ForeignKeyConstraint(["note_id"], ["notes.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["note_tag_id"], ["note_tags.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("note_id", "note_tag_id"),
    )

    if _table_exists(bind, "note_tag_assignments"):
        assignment_rows = bind.execute(
            sa.text(
                """
                SELECT nta.note_id, nta.note_tag_id
                FROM note_tag_assignments AS nta
                JOIN note_tags AS nt ON nt.id = nta.note_tag_id
                """
            )
        ).mappings()
        for row in assignment_rows:
            bind.execute(
                sa.text(
                    """
                    INSERT INTO note_tag_assignments_old (note_id, note_tag_id)
                    VALUES (:note_id, :note_tag_id)
                    """
                ),
                {"note_id": row["note_id"], "note_tag_id": row["note_tag_id"]},
            )

        assignment_indexes = _get_index_names(bind, "note_tag_assignments")
        if "ix_note_tag_assignments_note_tag_id" in assignment_indexes:
            op.drop_index("ix_note_tag_assignments_note_tag_id", table_name="note_tag_assignments")
        op.drop_table("note_tag_assignments")

    op.rename_table("note_tag_assignments_old", "note_tag_assignments")
    op.create_index(
        "ix_note_tag_assignments_note_tag_id",
        "note_tag_assignments",
        ["note_tag_id"],
        unique=False,
    )
    op.create_index(
        "ux_note_tags_name_lower",
        "note_tags",
        [sa.text("lower(name)")],
        unique=True,
    )
