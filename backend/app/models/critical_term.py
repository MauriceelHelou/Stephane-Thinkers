from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, Text, TIMESTAMP
from sqlalchemy.orm import backref, relationship
from sqlalchemy.sql import func
import uuid

from app.database import Base
from app.db_types import GUID


class CriticalTerm(Base):
    """A term Stephanie wants to track across notes."""

    __tablename__ = "critical_terms"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False, unique=True)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

    occurrences = relationship(
        "TermOccurrence",
        back_populates="term",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class TermOccurrence(Base):
    """A single occurrence of a critical term in a note."""

    __tablename__ = "term_occurrences"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    term_id = Column(GUID, ForeignKey("critical_terms.id", ondelete="CASCADE"), nullable=False, index=True)
    note_id = Column(GUID, ForeignKey("notes.id", ondelete="CASCADE"), nullable=False, index=True)
    context_snippet = Column(Text, nullable=False)
    paragraph_index = Column(Integer, nullable=True)
    char_offset = Column(Integer, nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.now())

    term = relationship("CriticalTerm", back_populates="occurrences")
    note = relationship(
        "Note",
        backref=backref(
            "term_occurrences",
            cascade="all, delete-orphan",
            passive_deletes=True,
        ),
        passive_deletes=True,
    )
