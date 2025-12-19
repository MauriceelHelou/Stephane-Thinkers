"""Add research_questions table

Revision ID: ffe9b3e22351
Revises: 501c2a8295c7
Create Date: 2025-12-17 01:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from app.db_types import GUID


revision: str = 'ffe9b3e22351'
down_revision: Union[str, None] = '501c2a8295c7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create research_questions table
    op.create_table('research_questions',
        sa.Column('id', GUID(), nullable=False),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('status', sa.String(), nullable=True),
        sa.Column('priority', sa.Integer(), nullable=True),
        sa.Column('category', sa.String(), nullable=True),
        sa.Column('tags_text', sa.String(), nullable=True),
        sa.Column('hypothesis', sa.Text(), nullable=True),
        sa.Column('evidence_for', sa.Text(), nullable=True),
        sa.Column('evidence_against', sa.Text(), nullable=True),
        sa.Column('conclusion', sa.Text(), nullable=True),
        sa.Column('parent_question_id', GUID(), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=True),
        sa.Column('updated_at', sa.TIMESTAMP(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=True),
        sa.ForeignKeyConstraint(['parent_question_id'], ['research_questions.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )

    # Create junction table for linking questions to thinkers
    op.create_table('research_question_thinkers',
        sa.Column('question_id', GUID(), nullable=False),
        sa.Column('thinker_id', GUID(), nullable=False),
        sa.ForeignKeyConstraint(['question_id'], ['research_questions.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['thinker_id'], ['thinkers.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('question_id', 'thinker_id')
    )


def downgrade() -> None:
    op.drop_table('research_question_thinkers')
    op.drop_table('research_questions')
