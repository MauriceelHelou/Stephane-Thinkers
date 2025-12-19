"""Add notes and note_versions tables

Revision ID: 501c2a8295c7
Revises: f4e0c7f9e83f
Create Date: 2025-12-17 01:05:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from app.db_types import GUID


revision: str = '501c2a8295c7'
down_revision: Union[str, None] = 'f4e0c7f9e83f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create notes table
    op.create_table('notes',
        sa.Column('id', GUID(), nullable=False),
        sa.Column('thinker_id', GUID(), nullable=True),
        sa.Column('title', sa.String(), nullable=True),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('content_html', sa.Text(), nullable=True),
        sa.Column('note_type', sa.String(), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=True),
        sa.Column('updated_at', sa.TIMESTAMP(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=True),
        sa.ForeignKeyConstraint(['thinker_id'], ['thinkers.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    # Create note_mentions junction table (for wiki-style [[Thinker]] links)
    op.create_table('note_mentions',
        sa.Column('note_id', GUID(), nullable=False),
        sa.Column('mentioned_thinker_id', GUID(), nullable=False),
        sa.ForeignKeyConstraint(['note_id'], ['notes.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['mentioned_thinker_id'], ['thinkers.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('note_id', 'mentioned_thinker_id')
    )

    # Create note_versions table (for version history)
    op.create_table('note_versions',
        sa.Column('id', GUID(), nullable=False),
        sa.Column('note_id', GUID(), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('version_number', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.TIMESTAMP(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=True),
        sa.ForeignKeyConstraint(['note_id'], ['notes.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    op.drop_table('note_versions')
    op.drop_table('note_mentions')
    op.drop_table('notes')
