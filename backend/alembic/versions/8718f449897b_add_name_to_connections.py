"""add_name_to_connections

Revision ID: 8718f449897b
Revises: 0689bc74c427
Create Date: 2025-11-21 21:00:55.341803

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '8718f449897b'
down_revision: Union[str, None] = '0689bc74c427'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add name column to connections table
    op.add_column('connections', sa.Column('name', sa.String(length=255), nullable=True))


def downgrade() -> None:
    # Remove name column from connections table
    op.drop_column('connections', 'name')
