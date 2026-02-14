"""merge note-tags and timeline-bootstrap heads

Revision ID: 78359914a054
Revises: b4c5d6e7f8a9, f5a6b7c8d9e0
Create Date: 2026-02-14 14:45:56.177039

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '78359914a054'
down_revision: Union[str, None] = ('b4c5d6e7f8a9', 'f5a6b7c8d9e0')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
