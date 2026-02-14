"""Add timeline bootstrap tables and ingestion job type constraint

Revision ID: f5a6b7c8d9e0
Revises: d4e5f6a7b8c9
Create Date: 2026-02-14 11:30:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

from app.db_types import GUID


# revision identifiers, used by Alembic.
revision: str = "f5a6b7c8d9e0"
down_revision: Union[str, None] = "d4e5f6a7b8c9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("ingestion_jobs") as batch_op:
        batch_op.create_check_constraint(
            "ck_ingestion_jobs_job_type",
            "job_type IN ('transcript', 'pdf_highlights', 'text_to_timeline_preview')",
        )

    op.create_table(
        "timeline_bootstrap_sessions",
        sa.Column("id", GUID(), nullable=False),
        sa.Column("ingestion_job_id", GUID(), nullable=False),
        sa.Column("source_artifact_id", GUID(), nullable=True),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("timeline_name_suggested", sa.String(), nullable=True),
        sa.Column("summary_markdown", sa.Text(), nullable=True),
        sa.Column("preview_json", sa.Text(), nullable=False, server_default=sa.text("'{}'")),
        sa.Column("validation_json", sa.Text(), nullable=False, server_default=sa.text("'{}'")),
        sa.Column("committed_timeline_id", GUID(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("expires_at", sa.TIMESTAMP(), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.TIMESTAMP(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.ForeignKeyConstraint(["ingestion_job_id"], ["ingestion_jobs.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["source_artifact_id"], ["source_artifacts.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["committed_timeline_id"], ["timelines.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_timeline_bootstrap_sessions_ingestion_job_id", "timeline_bootstrap_sessions", ["ingestion_job_id"])
    op.create_index("ix_timeline_bootstrap_sessions_source_artifact_id", "timeline_bootstrap_sessions", ["source_artifact_id"])
    op.create_index("ix_timeline_bootstrap_sessions_status", "timeline_bootstrap_sessions", ["status"])
    op.create_index("ix_timeline_bootstrap_sessions_committed_timeline_id", "timeline_bootstrap_sessions", ["committed_timeline_id"])
    op.create_index("ix_timeline_bootstrap_sessions_expires_at", "timeline_bootstrap_sessions", ["expires_at"])
    op.create_index("ix_timeline_bootstrap_sessions_created_at", "timeline_bootstrap_sessions", ["created_at"])
    op.create_index("ix_timeline_bootstrap_sessions_updated_at", "timeline_bootstrap_sessions", ["updated_at"])

    op.create_table(
        "timeline_bootstrap_candidates",
        sa.Column("id", GUID(), nullable=False),
        sa.Column("session_id", GUID(), nullable=False),
        sa.Column("entity_type", sa.String(), nullable=False),
        sa.Column("candidate_id", sa.String(), nullable=False),
        sa.Column("payload_json", sa.Text(), nullable=False, server_default=sa.text("'{}'")),
        sa.Column("dependency_keys_json", sa.Text(), nullable=False, server_default=sa.text("'[]'")),
        sa.Column("sort_key", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("created_at", sa.TIMESTAMP(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.TIMESTAMP(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.ForeignKeyConstraint(["session_id"], ["timeline_bootstrap_sessions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("session_id", "entity_type", "candidate_id", name="uq_timeline_bootstrap_candidate_key"),
    )
    op.create_index("ix_timeline_bootstrap_candidates_session_id", "timeline_bootstrap_candidates", ["session_id"])
    op.create_index("ix_timeline_bootstrap_candidates_entity_type", "timeline_bootstrap_candidates", ["entity_type"])
    op.create_index("ix_timeline_bootstrap_candidates_candidate_id", "timeline_bootstrap_candidates", ["candidate_id"])
    op.create_index("ix_timeline_bootstrap_candidates_sort_key", "timeline_bootstrap_candidates", ["sort_key"])
    op.create_index("ix_timeline_bootstrap_candidates_created_at", "timeline_bootstrap_candidates", ["created_at"])
    op.create_index("ix_timeline_bootstrap_candidates_updated_at", "timeline_bootstrap_candidates", ["updated_at"])

    op.create_table(
        "timeline_bootstrap_candidate_evidence",
        sa.Column("id", GUID(), nullable=False),
        sa.Column("candidate_row_id", GUID(), nullable=False),
        sa.Column("source_artifact_id", GUID(), nullable=False),
        sa.Column("chunk_index", sa.Integer(), nullable=False),
        sa.Column("char_start", sa.Integer(), nullable=False),
        sa.Column("char_end", sa.Integer(), nullable=False),
        sa.Column("excerpt", sa.Text(), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.ForeignKeyConstraint(["candidate_row_id"], ["timeline_bootstrap_candidates.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["source_artifact_id"], ["source_artifacts.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_timeline_bootstrap_candidate_evidence_candidate_row_id",
        "timeline_bootstrap_candidate_evidence",
        ["candidate_row_id"],
    )
    op.create_index(
        "ix_timeline_bootstrap_candidate_evidence_source_artifact_id",
        "timeline_bootstrap_candidate_evidence",
        ["source_artifact_id"],
    )
    op.create_index(
        "ix_timeline_bootstrap_candidate_evidence_created_at",
        "timeline_bootstrap_candidate_evidence",
        ["created_at"],
    )

    op.create_table(
        "timeline_bootstrap_commit_audits",
        sa.Column("id", GUID(), nullable=False),
        sa.Column("session_id", GUID(), nullable=False),
        sa.Column("created_counts_json", sa.Text(), nullable=False, server_default=sa.text("'{}'")),
        sa.Column("skipped_counts_json", sa.Text(), nullable=False, server_default=sa.text("'{}'")),
        sa.Column("warnings_json", sa.Text(), nullable=False, server_default=sa.text("'[]'")),
        sa.Column("id_mappings_json", sa.Text(), nullable=False, server_default=sa.text("'{}'")),
        sa.Column("committed_by", sa.String(), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.ForeignKeyConstraint(["session_id"], ["timeline_bootstrap_sessions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_timeline_bootstrap_commit_audits_session_id", "timeline_bootstrap_commit_audits", ["session_id"])
    op.create_index("ix_timeline_bootstrap_commit_audits_created_at", "timeline_bootstrap_commit_audits", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_timeline_bootstrap_commit_audits_created_at", table_name="timeline_bootstrap_commit_audits")
    op.drop_index("ix_timeline_bootstrap_commit_audits_session_id", table_name="timeline_bootstrap_commit_audits")
    op.drop_table("timeline_bootstrap_commit_audits")

    op.drop_index(
        "ix_timeline_bootstrap_candidate_evidence_created_at",
        table_name="timeline_bootstrap_candidate_evidence",
    )
    op.drop_index(
        "ix_timeline_bootstrap_candidate_evidence_source_artifact_id",
        table_name="timeline_bootstrap_candidate_evidence",
    )
    op.drop_index(
        "ix_timeline_bootstrap_candidate_evidence_candidate_row_id",
        table_name="timeline_bootstrap_candidate_evidence",
    )
    op.drop_table("timeline_bootstrap_candidate_evidence")

    op.drop_index("ix_timeline_bootstrap_candidates_updated_at", table_name="timeline_bootstrap_candidates")
    op.drop_index("ix_timeline_bootstrap_candidates_created_at", table_name="timeline_bootstrap_candidates")
    op.drop_index("ix_timeline_bootstrap_candidates_sort_key", table_name="timeline_bootstrap_candidates")
    op.drop_index("ix_timeline_bootstrap_candidates_candidate_id", table_name="timeline_bootstrap_candidates")
    op.drop_index("ix_timeline_bootstrap_candidates_entity_type", table_name="timeline_bootstrap_candidates")
    op.drop_index("ix_timeline_bootstrap_candidates_session_id", table_name="timeline_bootstrap_candidates")
    op.drop_table("timeline_bootstrap_candidates")

    op.drop_index("ix_timeline_bootstrap_sessions_updated_at", table_name="timeline_bootstrap_sessions")
    op.drop_index("ix_timeline_bootstrap_sessions_created_at", table_name="timeline_bootstrap_sessions")
    op.drop_index("ix_timeline_bootstrap_sessions_expires_at", table_name="timeline_bootstrap_sessions")
    op.drop_index("ix_timeline_bootstrap_sessions_committed_timeline_id", table_name="timeline_bootstrap_sessions")
    op.drop_index("ix_timeline_bootstrap_sessions_status", table_name="timeline_bootstrap_sessions")
    op.drop_index("ix_timeline_bootstrap_sessions_source_artifact_id", table_name="timeline_bootstrap_sessions")
    op.drop_index("ix_timeline_bootstrap_sessions_ingestion_job_id", table_name="timeline_bootstrap_sessions")
    op.drop_table("timeline_bootstrap_sessions")

    with op.batch_alter_table("ingestion_jobs") as batch_op:
        batch_op.drop_constraint("ck_ingestion_jobs_job_type", type_="check")
