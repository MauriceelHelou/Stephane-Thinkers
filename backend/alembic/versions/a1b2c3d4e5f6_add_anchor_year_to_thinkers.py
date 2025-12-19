"""add_anchor_year_to_thinkers

Revision ID: a1b2c3d4e5f6
Revises: 8df30e2dcf6c
Create Date: 2025-12-17 23:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '8df30e2dcf6c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add anchor_year column to thinkers table
    # This column stores the year a thinker is "pinned" to on the timeline,
    # allowing their position to persist when timeline bounds change
    op.add_column('thinkers', sa.Column('anchor_year', sa.Integer(), nullable=True))


def downgrade() -> None:
    # Remove anchor_year column from thinkers table
    op.drop_column('thinkers', 'anchor_year')
