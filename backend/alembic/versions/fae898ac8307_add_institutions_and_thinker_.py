"""Add institutions and thinker_institutions tables

Revision ID: fae898ac8307
Revises: e0120692be37
Create Date: 2025-12-17 00:54:52.372065

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from app.db_types import GUID


revision: str = 'fae898ac8307'
down_revision: Union[str, None] = 'e0120692be37'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('institutions',
        sa.Column('id', GUID(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('city', sa.String(), nullable=True),
        sa.Column('country', sa.String(), nullable=True),
        sa.Column('latitude', sa.Float(), nullable=True),
        sa.Column('longitude', sa.Float(), nullable=True),
        sa.Column('founded_year', sa.Integer(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=True),
        sa.Column('updated_at', sa.TIMESTAMP(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name')
    )
    op.create_table('thinker_institutions',
        sa.Column('id', GUID(), nullable=False),
        sa.Column('thinker_id', GUID(), nullable=False),
        sa.Column('institution_id', GUID(), nullable=False),
        sa.Column('role', sa.String(), nullable=True),
        sa.Column('department', sa.String(), nullable=True),
        sa.Column('start_year', sa.Integer(), nullable=True),
        sa.Column('end_year', sa.Integer(), nullable=True),
        sa.Column('is_phd_institution', sa.Integer(), nullable=True),
        sa.Column('phd_advisor_id', GUID(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=True),
        sa.Column('updated_at', sa.TIMESTAMP(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=True),
        sa.ForeignKeyConstraint(['institution_id'], ['institutions.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['phd_advisor_id'], ['thinkers.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['thinker_id'], ['thinkers.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    op.drop_table('thinker_institutions')
    op.drop_table('institutions')
