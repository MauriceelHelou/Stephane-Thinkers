"""add_year_to_quotes

Revision ID: 8c7b729ee4f8
Revises: ffe9b3e22351
Create Date: 2025-12-17 21:05:37.055480

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '8c7b729ee4f8'
down_revision: Union[str, None] = 'ffe9b3e22351'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add year column to quotes table
    op.add_column('quotes', sa.Column('year', sa.Integer(), nullable=True))


def downgrade() -> None:
    # Remove year column from quotes table
    op.drop_column('quotes', 'year')
