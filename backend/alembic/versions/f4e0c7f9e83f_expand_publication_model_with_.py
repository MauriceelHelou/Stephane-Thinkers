"""Expand publication model with structured citation fields

Revision ID: f4e0c7f9e83f
Revises: fae898ac8307
Create Date: 2025-12-17 01:00:38.687470

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from app.db_types import GUID


revision: str = 'f4e0c7f9e83f'
down_revision: Union[str, None] = 'fae898ac8307'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create publication_contributors junction table
    op.create_table('publication_contributors',
        sa.Column('publication_id', GUID(), nullable=False),
        sa.Column('thinker_id', GUID(), nullable=False),
        sa.Column('role', sa.String(), nullable=True),
        sa.Column('order', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['publication_id'], ['publications.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['thinker_id'], ['thinkers.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('publication_id', 'thinker_id')
    )

    # Add new columns to publications table
    op.add_column('publications', sa.Column('publication_type', sa.String(), nullable=True))
    op.add_column('publications', sa.Column('authors_text', sa.Text(), nullable=True))
    op.add_column('publications', sa.Column('journal', sa.String(), nullable=True))
    op.add_column('publications', sa.Column('publisher', sa.String(), nullable=True))
    op.add_column('publications', sa.Column('volume', sa.String(), nullable=True))
    op.add_column('publications', sa.Column('issue', sa.String(), nullable=True))
    op.add_column('publications', sa.Column('pages', sa.String(), nullable=True))
    op.add_column('publications', sa.Column('doi', sa.String(), nullable=True))
    op.add_column('publications', sa.Column('isbn', sa.String(), nullable=True))
    op.add_column('publications', sa.Column('url', sa.String(), nullable=True))
    op.add_column('publications', sa.Column('abstract', sa.Text(), nullable=True))
    op.add_column('publications', sa.Column('book_title', sa.String(), nullable=True))
    op.add_column('publications', sa.Column('editors', sa.String(), nullable=True))
    op.add_column('publications', sa.Column('updated_at', sa.TIMESTAMP(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=True))


def downgrade() -> None:
    op.drop_column('publications', 'updated_at')
    op.drop_column('publications', 'editors')
    op.drop_column('publications', 'book_title')
    op.drop_column('publications', 'abstract')
    op.drop_column('publications', 'url')
    op.drop_column('publications', 'isbn')
    op.drop_column('publications', 'doi')
    op.drop_column('publications', 'pages')
    op.drop_column('publications', 'issue')
    op.drop_column('publications', 'volume')
    op.drop_column('publications', 'publisher')
    op.drop_column('publications', 'journal')
    op.drop_column('publications', 'authors_text')
    op.drop_column('publications', 'publication_type')
    op.drop_table('publication_contributors')
