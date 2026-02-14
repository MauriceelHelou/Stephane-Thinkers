from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, TIMESTAMP, UniqueConstraint
from sqlalchemy.orm import backref, relationship
from sqlalchemy.sql import func
import uuid

from app.database import Base
from app.db_types import GUID


class ThinkerMention(Base):
    """A detected or manually-added mention of a thinker in a note."""

    __tablename__ = "thinker_mentions"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    note_id = Column(GUID, ForeignKey("notes.id", ondelete="CASCADE"), nullable=False, index=True)
    thinker_id = Column(GUID, ForeignKey("thinkers.id", ondelete="CASCADE"), nullable=False, index=True)
    paragraph_index = Column(Integer, nullable=True)
    char_offset = Column(Integer, nullable=True)
    mention_text = Column(String, nullable=False)
    is_auto_detected = Column(Boolean, default=False)
    created_at = Column(TIMESTAMP, server_default=func.now())

    note = relationship(
        "Note",
        backref=backref(
            "thinker_mention_records",
            cascade="all, delete-orphan",
            passive_deletes=True,
        ),
        passive_deletes=True,
    )
    thinker = relationship(
        "Thinker",
        backref=backref(
            "mention_records",
            cascade="all, delete-orphan",
            passive_deletes=True,
        ),
        passive_deletes=True,
    )


class ThinkerCoOccurrence(Base):
    """Pairwise thinker co-occurrence records derived from note mentions."""

    __tablename__ = "thinker_co_occurrences"
    __table_args__ = (
        UniqueConstraint(
            "thinker_a_id",
            "thinker_b_id",
            "note_id",
            "paragraph_index",
            name="uq_co_occurrence_pair_note_paragraph",
        ),
    )

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    thinker_a_id = Column(GUID, ForeignKey("thinkers.id", ondelete="CASCADE"), nullable=False, index=True)
    thinker_b_id = Column(GUID, ForeignKey("thinkers.id", ondelete="CASCADE"), nullable=False, index=True)
    note_id = Column(GUID, ForeignKey("notes.id", ondelete="CASCADE"), nullable=False, index=True)
    paragraph_index = Column(Integer, nullable=True)
    co_occurrence_type = Column(String, default="same_note")
    created_at = Column(TIMESTAMP, server_default=func.now())

    thinker_a = relationship(
        "Thinker",
        foreign_keys=[thinker_a_id],
        backref=backref(
            "co_occurrences_as_a",
            cascade="all, delete-orphan",
            passive_deletes=True,
        ),
        passive_deletes=True,
    )
    thinker_b = relationship(
        "Thinker",
        foreign_keys=[thinker_b_id],
        backref=backref(
            "co_occurrences_as_b",
            cascade="all, delete-orphan",
            passive_deletes=True,
        ),
        passive_deletes=True,
    )
    note = relationship(
        "Note",
        backref=backref(
            "thinker_co_occurrences",
            cascade="all, delete-orphan",
            passive_deletes=True,
        ),
        passive_deletes=True,
    )
