"""add_combined_timeline_views

Revision ID: e0120692be37
Revises: 8718f449897b
Create Date: 2025-11-21 21:56:38.605209

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'e0120692be37'
down_revision: Union[str, None] = '8718f449897b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create combined_timeline_views table
    op.create_table('combined_timeline_views',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('description', sa.String(), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=True),
        sa.Column('updated_at', sa.TIMESTAMP(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )

    # Create combined_view_members table
    op.create_table('combined_view_members',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('view_id', sa.UUID(), nullable=False),
        sa.Column('timeline_id', sa.UUID(), nullable=False),
        sa.Column('display_order', sa.Integer(), nullable=False),
        sa.Column('y_offset', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.TIMESTAMP(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['view_id'], ['combined_timeline_views.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['timeline_id'], ['timelines.id'], ondelete='CASCADE')
    )


def downgrade() -> None:
    op.drop_table('combined_view_members')
    op.drop_table('combined_timeline_views')
