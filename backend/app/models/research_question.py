from sqlalchemy import Column, String, Integer, Text, TIMESTAMP, ForeignKey, Table
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from app.database import Base
from app.db_types import GUID


# Junction table for linking research questions to thinkers
research_question_thinkers = Table(
    "research_question_thinkers",
    Base.metadata,
    Column("question_id", GUID, ForeignKey("research_questions.id", ondelete="CASCADE"), primary_key=True),
    Column("thinker_id", GUID, ForeignKey("thinkers.id", ondelete="CASCADE"), primary_key=True),
)


class ResearchQuestion(Base):
    """Research questions and hypotheses for tracking intellectual investigations."""
    __tablename__ = "research_questions"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)

    # Status tracking
    status = Column(String, default="open")  # open, in_progress, answered, abandoned
    priority = Column(Integer, default=3)  # 1=critical, 2=high, 3=medium, 4=low, 5=someday

    # Categorization
    category = Column(String, nullable=True)  # influence, periodization, methodology, biography, other
    tags_text = Column(String, nullable=True)  # Comma-separated tags

    # Hypothesis support
    hypothesis = Column(Text, nullable=True)  # The working hypothesis
    evidence_for = Column(Text, nullable=True)  # Evidence supporting the hypothesis
    evidence_against = Column(Text, nullable=True)  # Counterevidence
    conclusion = Column(Text, nullable=True)  # Final conclusion/answer

    # Links
    parent_question_id = Column(GUID, ForeignKey("research_questions.id", ondelete="SET NULL"), nullable=True)

    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

    # Relationships
    related_thinkers = relationship(
        "Thinker",
        secondary=research_question_thinkers,
        backref="related_questions"
    )
    sub_questions = relationship(
        "ResearchQuestion",
        backref="parent_question",
        remote_side=[id]
    )
