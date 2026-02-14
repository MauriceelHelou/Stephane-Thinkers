"""Add connection uniqueness and quiz indexes

Revision ID: 1c2d3e4f5a6b
Revises: add_manual_pos_001
Create Date: 2026-02-13 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "1c2d3e4f5a6b"
down_revision: Union[str, None] = "add_manual_pos_001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("connections", schema=None) as batch_op:
        batch_op.create_unique_constraint(
            "uq_connections_from_to", ["from_thinker_id", "to_thinker_id"]
        )
        batch_op.create_index(
            "ix_connections_from_thinker_id", ["from_thinker_id"], unique=False
        )
        batch_op.create_index(
            "ix_connections_to_thinker_id", ["to_thinker_id"], unique=False
        )

    with op.batch_alter_table("quiz_questions", schema=None) as batch_op:
        batch_op.create_index("ix_quiz_questions_category", ["category"], unique=False)
        batch_op.create_index("ix_quiz_questions_difficulty", ["difficulty"], unique=False)
        batch_op.create_index("ix_quiz_questions_timeline_id", ["timeline_id"], unique=False)

    with op.batch_alter_table("quiz_sessions", schema=None) as batch_op:
        batch_op.create_index("ix_quiz_sessions_timeline_id", ["timeline_id"], unique=False)

    with op.batch_alter_table("quiz_answers", schema=None) as batch_op:
        batch_op.create_index("ix_quiz_answers_session_id", ["session_id"], unique=False)
        batch_op.create_index("ix_quiz_answers_question_id", ["question_id"], unique=False)

    with op.batch_alter_table("spaced_repetition_queue", schema=None) as batch_op:
        batch_op.create_unique_constraint(
            "uq_spaced_repetition_queue_question_id", ["question_id"]
        )
        batch_op.create_index(
            "ix_spaced_repetition_queue_next_review_at", ["next_review_at"], unique=False
        )
        batch_op.create_index(
            "ix_spaced_repetition_queue_question_id", ["question_id"], unique=False
        )


def downgrade() -> None:
    with op.batch_alter_table("spaced_repetition_queue", schema=None) as batch_op:
        batch_op.drop_index("ix_spaced_repetition_queue_question_id")
        batch_op.drop_index("ix_spaced_repetition_queue_next_review_at")
        batch_op.drop_constraint("uq_spaced_repetition_queue_question_id", type_="unique")

    with op.batch_alter_table("quiz_answers", schema=None) as batch_op:
        batch_op.drop_index("ix_quiz_answers_question_id")
        batch_op.drop_index("ix_quiz_answers_session_id")

    with op.batch_alter_table("quiz_sessions", schema=None) as batch_op:
        batch_op.drop_index("ix_quiz_sessions_timeline_id")

    with op.batch_alter_table("quiz_questions", schema=None) as batch_op:
        batch_op.drop_index("ix_quiz_questions_timeline_id")
        batch_op.drop_index("ix_quiz_questions_difficulty")
        batch_op.drop_index("ix_quiz_questions_category")

    with op.batch_alter_table("connections", schema=None) as batch_op:
        batch_op.drop_index("ix_connections_to_thinker_id")
        batch_op.drop_index("ix_connections_from_thinker_id")
        batch_op.drop_constraint("uq_connections_from_to", type_="unique")
