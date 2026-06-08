"""add backup_runs, backup_artifacts, restore_validation_runs tables

Revision ID: a1b2c3d4e5f7
Revises: 78359914a054
Create Date: 2026-02-14 20:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from app.db_types import GUID


# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f7"
down_revision: Union[str, None] = "78359914a054"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "backup_runs",
        sa.Column("id", GUID(), primary_key=True),
        sa.Column("trigger", sa.String(50), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="running"),
        sa.Column("started_at", sa.DateTime, nullable=False),
        sa.Column("completed_at", sa.DateTime, nullable=True),
        sa.Column("error_message", sa.Text, nullable=True),
        sa.Column("total_rows", sa.Integer, nullable=True),
        sa.Column("retention_tag", sa.String(20), nullable=True),
    )

    op.create_table(
        "backup_artifacts",
        sa.Column("id", GUID(), primary_key=True),
        sa.Column("backup_run_id", GUID(), sa.ForeignKey("backup_runs.id"), nullable=False),
        sa.Column("file_path", sa.Text, nullable=False),
        sa.Column("size_bytes", sa.BigInteger, nullable=False),
        sa.Column("checksum_sha256", sa.String(64), nullable=False),
        sa.Column("manifest_signature", sa.Text, nullable=True),
        sa.Column("signing_key_id", sa.String(100), nullable=True),
        sa.Column("storage_backend", sa.String(20), nullable=False, server_default="local"),
        sa.Column("cloud_key", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=False),
    )

    op.create_table(
        "restore_validation_runs",
        sa.Column("id", GUID(), primary_key=True),
        sa.Column("artifact_id", GUID(), sa.ForeignKey("backup_artifacts.id"), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="running"),
        sa.Column("started_at", sa.DateTime, nullable=False),
        sa.Column("completed_at", sa.DateTime, nullable=True),
        sa.Column("row_count_match", sa.Integer, nullable=True),
        sa.Column("checksum_valid", sa.Integer, nullable=True),
        sa.Column("signature_valid", sa.Integer, nullable=True),
        sa.Column("elapsed_seconds", sa.Integer, nullable=True),
        sa.Column("error_message", sa.Text, nullable=True),
    )


def downgrade() -> None:
    op.drop_table("restore_validation_runs")
    op.drop_table("backup_artifacts")
    op.drop_table("backup_runs")
