"""
Quiz system models for spaced repetition and knowledge testing.

Tables:
- quiz_questions: Reusable question pool
- quiz_sessions: Track quiz attempts
- quiz_answers: Individual answer records
- spaced_repetition_queue: SM-2 algorithm tracking
"""
from sqlalchemy import Column, String, Integer, Float, Text, Boolean, TIMESTAMP, ForeignKey, Enum, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
import enum

from app.database import Base
from app.db_types import GUID


class QuestionCategory(str, enum.Enum):
    """Types of quiz questions."""
    BIRTH_YEAR = "birth_year"
    DEATH_YEAR = "death_year"
    QUOTE = "quote"
    QUOTE_COMPLETION = "quote_completion"
    PUBLICATION = "publication"
    CONNECTION = "connection"
    FIELD = "field"
    BIOGRAPHY = "biography"


class QuestionType(str, enum.Enum):
    """Question format types."""
    MULTIPLE_CHOICE = "multiple_choice"
    SHORT_ANSWER = "short_answer"


class Difficulty(str, enum.Enum):
    """Question difficulty levels."""
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"


class QuizQuestion(Base):
    """
    Reusable question pool - stores generated questions for reuse.
    """
    __tablename__ = "quiz_questions"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    question_text = Column(Text, nullable=False)
    question_type = Column(String(20), nullable=False)  # multiple_choice, short_answer
    category = Column(String(20), nullable=False)  # birth_year, death_year, quote, etc.
    correct_answer = Column(Text, nullable=False)
    options = Column(JSON, nullable=True)  # For multiple choice options
    difficulty = Column(String(10), nullable=False, default="medium")
    explanation = Column(Text, nullable=True)
    related_thinker_ids = Column(JSON, nullable=True)  # Array of thinker UUIDs as strings
    timeline_id = Column(GUID, ForeignKey("timelines.id"), nullable=True)  # Optional timeline scope
    times_asked = Column(Integer, default=0)
    times_correct = Column(Integer, default=0)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

    # Relationships
    timeline = relationship("Timeline")
    answers = relationship("QuizAnswer", back_populates="question", cascade="all, delete-orphan")
    spaced_repetition_entries = relationship("SpacedRepetitionQueue", back_populates="question", cascade="all, delete-orphan")

    @property
    def accuracy_rate(self) -> float:
        """Calculate accuracy rate for this question."""
        if self.times_asked == 0:
            return 0.0
        return (self.times_correct / self.times_asked) * 100


class QuizSession(Base):
    """
    Track quiz attempts/sessions.
    """
    __tablename__ = "quiz_sessions"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    timeline_id = Column(GUID, ForeignKey("timelines.id"), nullable=True)
    difficulty = Column(String(10), nullable=False, default="medium")
    question_count = Column(Integer, nullable=False)
    score = Column(Integer, default=0)  # Number of correct answers
    completed = Column(Boolean, default=False)
    time_spent_seconds = Column(Integer, nullable=True)
    question_categories = Column(JSON, nullable=True)  # Array of categories used
    current_question_index = Column(Integer, default=0)  # For resuming
    created_at = Column(TIMESTAMP, server_default=func.now())
    completed_at = Column(TIMESTAMP, nullable=True)

    # Relationships
    timeline = relationship("Timeline")
    answers = relationship("QuizAnswer", back_populates="session", cascade="all, delete-orphan")


class QuizAnswer(Base):
    """
    Individual answer records for each question in a session.
    """
    __tablename__ = "quiz_answers"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    session_id = Column(GUID, ForeignKey("quiz_sessions.id"), nullable=False)
    question_id = Column(GUID, ForeignKey("quiz_questions.id"), nullable=False)
    user_answer = Column(Text, nullable=False)
    is_correct = Column(Boolean, nullable=False)
    time_taken_seconds = Column(Integer, nullable=True)
    answered_at = Column(TIMESTAMP, server_default=func.now())

    # Relationships
    session = relationship("QuizSession", back_populates="answers")
    question = relationship("QuizQuestion", back_populates="answers")


class SpacedRepetitionQueue(Base):
    """
    SM-2 spaced repetition algorithm tracking.
    Tracks questions for future review based on performance.
    """
    __tablename__ = "spaced_repetition_queue"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    question_id = Column(GUID, ForeignKey("quiz_questions.id"), nullable=False)
    last_answered_at = Column(TIMESTAMP, nullable=True)
    next_review_at = Column(TIMESTAMP, server_default=func.now())
    ease_factor = Column(Float, default=2.5)  # SM-2 ease factor
    interval_days = Column(Integer, default=1)  # Current interval
    repetitions = Column(Integer, default=0)  # Number of successful reviews
    created_at = Column(TIMESTAMP, server_default=func.now())

    # Relationships
    question = relationship("QuizQuestion", back_populates="spaced_repetition_entries")
