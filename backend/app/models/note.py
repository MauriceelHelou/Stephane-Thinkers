from sqlalchemy import Column, String, Integer, Float, Boolean, Text, TIMESTAMP, ForeignKey, Table
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from app.database import Base
from app.db_types import GUID


# Junction table for note mentions (wiki-style [[Thinker Name]] links)
note_mentions = Table(
    "note_mentions",
    Base.metadata,
    Column("note_id", GUID, ForeignKey("notes.id", ondelete="CASCADE"), primary_key=True),
    Column("mentioned_thinker_id", GUID, ForeignKey("thinkers.id", ondelete="CASCADE"), primary_key=True),
)


class Note(Base):
    """Rich notes with wiki-style linking support."""
    __tablename__ = "notes"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    thinker_id = Column(GUID, ForeignKey("thinkers.id", ondelete="CASCADE"), nullable=True)
    title = Column(String, nullable=True)
    content = Column(Text, nullable=False)  # Markdown/rich text content
    content_html = Column(Text, nullable=True)  # Rendered HTML for display
    note_type = Column(String, default="general")  # general, research, biography, connection

    # Canvas sticky note positioning
    position_x = Column(Float, nullable=True)  # Canvas X coordinate
    position_y = Column(Float, nullable=True)  # Canvas Y coordinate
    color = Column(String, default="yellow")  # Sticky note color: yellow, pink, blue, green
    is_canvas_note = Column(Boolean, default=False)  # True for canvas notes, False for panel-only

    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

    # Relationships
    thinker = relationship("Thinker", back_populates="notes")
    mentioned_thinkers = relationship(
        "Thinker",
        secondary=note_mentions,
        backref="mentioned_in_notes"
    )
    versions = relationship("NoteVersion", back_populates="note", cascade="all, delete-orphan", passive_deletes=True)


class NoteVersion(Base):
    """Version history for notes."""
    __tablename__ = "note_versions"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    note_id = Column(GUID, ForeignKey("notes.id", ondelete="CASCADE"), nullable=False)
    content = Column(Text, nullable=False)
    version_number = Column(Integer, nullable=False)
    created_at = Column(TIMESTAMP, server_default=func.now())

    # Relationships
    note = relationship("Note", back_populates="versions")
