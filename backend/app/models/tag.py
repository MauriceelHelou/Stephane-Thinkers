from sqlalchemy import Column, String, TIMESTAMP, Table, ForeignKey, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from app.database import Base
from app.db_types import GUID

thinker_tags = Table(
    'thinker_tags',
    Base.metadata,
    Column('thinker_id', GUID, ForeignKey('thinkers.id'), primary_key=True),
    Column('tag_id', GUID, ForeignKey('tags.id'), primary_key=True)
)

note_tag_assignments = Table(
    'note_tag_assignments',
    Base.metadata,
    Column('note_id', GUID, ForeignKey('notes.id', ondelete='CASCADE'), primary_key=True),
    # Keep the historic column name for smoother data migration/backups.
    Column('note_tag_id', GUID, ForeignKey('tags.id', ondelete='CASCADE'), primary_key=True),
)

class Tag(Base):
    __tablename__ = "tags"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    name = Column(String, unique=True, nullable=False)
    color = Column(String, nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.now())
    __table_args__ = (
        Index("ux_tags_name_lower", func.lower(name), unique=True),
    )

    thinkers = relationship("Thinker", secondary=thinker_tags, back_populates="tags")
    notes = relationship("Note", secondary=note_tag_assignments, back_populates="tags")
