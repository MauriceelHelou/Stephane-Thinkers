"""Add Plan 9 notes AI tables

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-02-13 17:45:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

from app.db_types import GUID


# revision identifiers, used by Alembic.
revision: str = "d4e5f6a7b8c9"
down_revision: Union[str, None] = "c3d4e5f6a7b8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "synthesis_runs",
        sa.Column("id", GUID(), nullable=False),
        sa.Column("term_id", GUID(), nullable=False),
        sa.Column("mode", sa.String(), nullable=False),
        sa.Column("folder_id", GUID(), nullable=True),
        sa.Column("thinker_id", GUID(), nullable=True),
        sa.Column("filter_context", sa.String(), nullable=False),
        sa.Column("synthesis_text", sa.Text(), nullable=False),
        sa.Column("coverage_rate", sa.Float(), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.ForeignKeyConstraint(["term_id"], ["critical_terms.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["folder_id"], ["folders.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["thinker_id"], ["thinkers.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_synthesis_runs_term_id", "synthesis_runs", ["term_id"])
    op.create_index("ix_synthesis_runs_mode", "synthesis_runs", ["mode"])
    op.create_index("ix_synthesis_runs_created_at", "synthesis_runs", ["created_at"])

    op.create_table(
        "synthesis_run_citations",
        sa.Column("id", GUID(), nullable=False),
        sa.Column("run_id", GUID(), nullable=False),
        sa.Column("occurrence_id", GUID(), nullable=True),
        sa.Column("citation_key", sa.String(), nullable=False),
        sa.Column("note_id", GUID(), nullable=False),
        sa.Column("note_title", sa.String(), nullable=False),
        sa.Column("folder_name", sa.String(), nullable=True),
        sa.Column("context_snippet", sa.Text(), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.ForeignKeyConstraint(["run_id"], ["synthesis_runs.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["occurrence_id"], ["term_occurrences.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["note_id"], ["notes.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_synthesis_run_citations_run_id", "synthesis_run_citations", ["run_id"])
    op.create_index("ix_synthesis_run_citations_note_id", "synthesis_run_citations", ["note_id"])

    op.create_table(
        "synthesis_snapshots",
        sa.Column("id", GUID(), nullable=False),
        sa.Column("run_id", GUID(), nullable=False),
        sa.Column("snapshot_hash", sa.String(), nullable=False),
        sa.Column("payload_json", sa.Text(), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.ForeignKeyConstraint(["run_id"], ["synthesis_runs.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_synthesis_snapshots_run_id", "synthesis_snapshots", ["run_id"])
    op.create_index("ix_synthesis_snapshots_snapshot_hash", "synthesis_snapshots", ["snapshot_hash"])

    op.create_table(
        "quality_reports",
        sa.Column("id", GUID(), nullable=False),
        sa.Column("run_id", GUID(), nullable=False),
        sa.Column("coverage_rate", sa.Float(), nullable=False),
        sa.Column("unsupported_claim_count", sa.Integer(), nullable=False),
        sa.Column("contradiction_count", sa.Integer(), nullable=False),
        sa.Column("uncertainty_label", sa.String(), nullable=False),
        sa.Column("details_json", sa.Text(), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.ForeignKeyConstraint(["run_id"], ["synthesis_runs.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_quality_reports_run_id", "quality_reports", ["run_id"])

    op.create_table(
        "claim_candidates",
        sa.Column("id", GUID(), nullable=False),
        sa.Column("term_id", GUID(), nullable=False),
        sa.Column("run_id", GUID(), nullable=True),
        sa.Column("claim_text", sa.Text(), nullable=False),
        sa.Column("support_summary", sa.Text(), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.ForeignKeyConstraint(["term_id"], ["critical_terms.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["run_id"], ["synthesis_runs.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_claim_candidates_term_id", "claim_candidates", ["term_id"])

    op.create_table(
        "argument_maps",
        sa.Column("id", GUID(), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("source_type", sa.String(), nullable=False),
        sa.Column("source_id", sa.String(), nullable=True),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_argument_maps_source_id", "argument_maps", ["source_id"])

    op.create_table(
        "argument_map_nodes",
        sa.Column("id", GUID(), nullable=False),
        sa.Column("map_id", GUID(), nullable=False),
        sa.Column("node_type", sa.String(), nullable=False),
        sa.Column("label", sa.Text(), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=False),
        sa.Column("metadata_json", sa.Text(), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.ForeignKeyConstraint(["map_id"], ["argument_maps.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_argument_map_nodes_map_id", "argument_map_nodes", ["map_id"])

    op.create_table(
        "argument_map_edges",
        sa.Column("id", GUID(), nullable=False),
        sa.Column("map_id", GUID(), nullable=False),
        sa.Column("from_node_id", GUID(), nullable=False),
        sa.Column("to_node_id", GUID(), nullable=False),
        sa.Column("edge_type", sa.String(), nullable=False),
        sa.Column("weight", sa.Float(), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.ForeignKeyConstraint(["map_id"], ["argument_maps.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["from_node_id"], ["argument_map_nodes.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["to_node_id"], ["argument_map_nodes.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_argument_map_edges_map_id", "argument_map_edges", ["map_id"])

    op.create_table(
        "term_aliases",
        sa.Column("id", GUID(), nullable=False),
        sa.Column("term_id", GUID(), nullable=False),
        sa.Column("alias_name", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("approved_at", sa.TIMESTAMP(), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.ForeignKeyConstraint(["term_id"], ["critical_terms.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("term_id", "alias_name", name="uq_term_aliases_term_alias"),
    )
    op.create_index("ix_term_aliases_term_id", "term_aliases", ["term_id"])

    op.create_table(
        "term_relationships",
        sa.Column("id", GUID(), nullable=False),
        sa.Column("source_term_id", GUID(), nullable=False),
        sa.Column("target_term_id", GUID(), nullable=False),
        sa.Column("relationship_type", sa.String(), nullable=False),
        sa.Column("score", sa.Float(), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.ForeignKeyConstraint(["source_term_id"], ["critical_terms.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["target_term_id"], ["critical_terms.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "note_embeddings",
        sa.Column("id", GUID(), nullable=False),
        sa.Column("note_id", GUID(), nullable=False),
        sa.Column("embedding_model", sa.String(), nullable=False),
        sa.Column("vector_json", sa.Text(), nullable=False),
        sa.Column("updated_at", sa.TIMESTAMP(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.ForeignKeyConstraint(["note_id"], ["notes.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("note_id", name="uq_note_embeddings_note_id"),
    )
    op.create_index("ix_note_embeddings_note_id", "note_embeddings", ["note_id"])

    op.create_table(
        "planner_runs",
        sa.Column("id", GUID(), nullable=False),
        sa.Column("run_type", sa.String(), nullable=False),
        sa.Column("input_context", sa.Text(), nullable=False),
        sa.Column("output_markdown", sa.Text(), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "weekly_digests",
        sa.Column("id", GUID(), nullable=False),
        sa.Column("period_start", sa.String(), nullable=False),
        sa.Column("period_end", sa.String(), nullable=False),
        sa.Column("digest_markdown", sa.Text(), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "ingestion_jobs",
        sa.Column("id", GUID(), nullable=False),
        sa.Column("job_type", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("payload_json", sa.Text(), nullable=False),
        sa.Column("result_json", sa.Text(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.TIMESTAMP(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_ingestion_jobs_status", "ingestion_jobs", ["status"])

    op.create_table(
        "source_artifacts",
        sa.Column("id", GUID(), nullable=False),
        sa.Column("job_id", GUID(), nullable=False),
        sa.Column("file_name", sa.String(), nullable=False),
        sa.Column("file_type", sa.String(), nullable=False),
        sa.Column("raw_text", sa.Text(), nullable=False),
        sa.Column("metadata_json", sa.Text(), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.ForeignKeyConstraint(["job_id"], ["ingestion_jobs.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("source_artifacts")
    op.drop_index("ix_ingestion_jobs_status", table_name="ingestion_jobs")
    op.drop_table("ingestion_jobs")
    op.drop_table("weekly_digests")
    op.drop_table("planner_runs")
    op.drop_index("ix_note_embeddings_note_id", table_name="note_embeddings")
    op.drop_table("note_embeddings")
    op.drop_table("term_relationships")
    op.drop_index("ix_term_aliases_term_id", table_name="term_aliases")
    op.drop_table("term_aliases")
    op.drop_index("ix_argument_map_edges_map_id", table_name="argument_map_edges")
    op.drop_table("argument_map_edges")
    op.drop_index("ix_argument_map_nodes_map_id", table_name="argument_map_nodes")
    op.drop_table("argument_map_nodes")
    op.drop_index("ix_argument_maps_source_id", table_name="argument_maps")
    op.drop_table("argument_maps")
    op.drop_index("ix_claim_candidates_term_id", table_name="claim_candidates")
    op.drop_table("claim_candidates")
    op.drop_index("ix_quality_reports_run_id", table_name="quality_reports")
    op.drop_table("quality_reports")
    op.drop_index("ix_synthesis_snapshots_snapshot_hash", table_name="synthesis_snapshots")
    op.drop_index("ix_synthesis_snapshots_run_id", table_name="synthesis_snapshots")
    op.drop_table("synthesis_snapshots")
    op.drop_index("ix_synthesis_run_citations_note_id", table_name="synthesis_run_citations")
    op.drop_index("ix_synthesis_run_citations_run_id", table_name="synthesis_run_citations")
    op.drop_table("synthesis_run_citations")
    op.drop_index("ix_synthesis_runs_created_at", table_name="synthesis_runs")
    op.drop_index("ix_synthesis_runs_mode", table_name="synthesis_runs")
    op.drop_index("ix_synthesis_runs_term_id", table_name="synthesis_runs")
    op.drop_table("synthesis_runs")
