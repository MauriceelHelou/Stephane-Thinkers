"""add is_manually_positioned to thinkers

Revision ID: add_manual_pos_001
Revises: 
Create Date: 2024-01-01 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_manual_pos_001'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add is_manually_positioned column with default False
    op.add_column('thinkers', sa.Column('is_manually_positioned', sa.Boolean(), nullable=False, server_default='0'))


def downgrade() -> None:
    op.drop_column('thinkers', 'is_manually_positioned')
