"""add_quiz_tables

Revision ID: 8df30e2dcf6c
Revises: 8c7b729ee4f8
Create Date: 2025-12-17 22:12:04.483586

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


revision: str = '8df30e2dcf6c'
down_revision: Union[str, None] = '8c7b729ee4f8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create quiz_questions table
    op.create_table('quiz_questions',
        sa.Column('id', UUID(as_uuid=True), nullable=False),
        sa.Column('question_text', sa.Text(), nullable=False),
        sa.Column('question_type', sa.String(length=20), nullable=False),
        sa.Column('category', sa.String(length=20), nullable=False),
        sa.Column('correct_answer', sa.Text(), nullable=False),
        sa.Column('options', sa.JSON(), nullable=True),
        sa.Column('difficulty', sa.String(length=10), nullable=False),
        sa.Column('explanation', sa.Text(), nullable=True),
        sa.Column('related_thinker_ids', sa.JSON(), nullable=True),
        sa.Column('timeline_id', UUID(as_uuid=True), nullable=True),
        sa.Column('times_asked', sa.Integer(), nullable=True, default=0),
        sa.Column('times_correct', sa.Integer(), nullable=True, default=0),
        sa.Column('created_at', sa.TIMESTAMP(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=True),
        sa.Column('updated_at', sa.TIMESTAMP(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=True),
        sa.ForeignKeyConstraint(['timeline_id'], ['timelines.id']),
        sa.PrimaryKeyConstraint('id')
    )

    # Create quiz_sessions table
    op.create_table('quiz_sessions',
        sa.Column('id', UUID(as_uuid=True), nullable=False),
        sa.Column('timeline_id', UUID(as_uuid=True), nullable=True),
        sa.Column('difficulty', sa.String(length=10), nullable=False),
        sa.Column('question_count', sa.Integer(), nullable=False),
        sa.Column('score', sa.Integer(), nullable=True, default=0),
        sa.Column('completed', sa.Boolean(), nullable=True, default=False),
        sa.Column('time_spent_seconds', sa.Integer(), nullable=True),
        sa.Column('question_categories', sa.JSON(), nullable=True),
        sa.Column('current_question_index', sa.Integer(), nullable=True, default=0),
        sa.Column('created_at', sa.TIMESTAMP(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=True),
        sa.Column('completed_at', sa.TIMESTAMP(), nullable=True),
        sa.ForeignKeyConstraint(['timeline_id'], ['timelines.id']),
        sa.PrimaryKeyConstraint('id')
    )

    # Create quiz_answers table
    op.create_table('quiz_answers',
        sa.Column('id', UUID(as_uuid=True), nullable=False),
        sa.Column('session_id', UUID(as_uuid=True), nullable=False),
        sa.Column('question_id', UUID(as_uuid=True), nullable=False),
        sa.Column('user_answer', sa.Text(), nullable=False),
        sa.Column('is_correct', sa.Boolean(), nullable=False),
        sa.Column('time_taken_seconds', sa.Integer(), nullable=True),
        sa.Column('answered_at', sa.TIMESTAMP(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=True),
        sa.ForeignKeyConstraint(['question_id'], ['quiz_questions.id']),
        sa.ForeignKeyConstraint(['session_id'], ['quiz_sessions.id']),
        sa.PrimaryKeyConstraint('id')
    )

    # Create spaced_repetition_queue table
    op.create_table('spaced_repetition_queue',
        sa.Column('id', UUID(as_uuid=True), nullable=False),
        sa.Column('question_id', UUID(as_uuid=True), nullable=False),
        sa.Column('last_answered_at', sa.TIMESTAMP(), nullable=True),
        sa.Column('next_review_at', sa.TIMESTAMP(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=True),
        sa.Column('ease_factor', sa.Float(), nullable=True, default=2.5),
        sa.Column('interval_days', sa.Integer(), nullable=True, default=1),
        sa.Column('repetitions', sa.Integer(), nullable=True, default=0),
        sa.Column('created_at', sa.TIMESTAMP(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=True),
        sa.ForeignKeyConstraint(['question_id'], ['quiz_questions.id']),
        sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    op.drop_table('spaced_repetition_queue')
    op.drop_table('quiz_answers')
    op.drop_table('quiz_sessions')
    op.drop_table('quiz_questions')
