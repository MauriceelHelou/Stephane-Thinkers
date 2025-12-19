"""add_canvas_fields_to_notes

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2025-12-17 23:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add canvas positioning fields to notes table
    op.add_column('notes', sa.Column('position_x', sa.Float(), nullable=True))
    op.add_column('notes', sa.Column('position_y', sa.Float(), nullable=True))
    op.add_column('notes', sa.Column('color', sa.String(), server_default='yellow', nullable=True))
    op.add_column('notes', sa.Column('is_canvas_note', sa.Boolean(), server_default='false', nullable=True))


def downgrade() -> None:
    # Remove canvas positioning fields from notes table
    op.drop_column('notes', 'is_canvas_note')
    op.drop_column('notes', 'color')
    op.drop_column('notes', 'position_y')
    op.drop_column('notes', 'position_x')
