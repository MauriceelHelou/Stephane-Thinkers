from sqlalchemy import Column, String, Integer, Text, TIMESTAMP, ForeignKey, Table, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
import enum

from app.database import Base
from app.db_types import GUID


class PublicationType(enum.Enum):
    book = "book"
    article = "article"
    chapter = "chapter"
    thesis = "thesis"
    conference = "conference"
    report = "report"
    other = "other"


class ContributorRole(enum.Enum):
    author = "author"
    editor = "editor"
    translator = "translator"
    commentator = "commentator"
    respondent = "respondent"


# Junction table for publication contributors (links publications to multiple thinkers)
publication_contributors = Table(
    "publication_contributors",
    Base.metadata,
    Column("publication_id", GUID, ForeignKey("publications.id", ondelete="CASCADE"), primary_key=True),
    Column("thinker_id", GUID, ForeignKey("thinkers.id", ondelete="CASCADE"), primary_key=True),
    Column("role", String, default="author"),  # author, editor, translator, commentator, respondent
    Column("order", Integer, default=0),  # For ordering authors
)


class Publication(Base):
    __tablename__ = "publications"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    thinker_id = Column(GUID, ForeignKey("thinkers.id", ondelete="CASCADE"), nullable=False)
    title = Column(String, nullable=False)
    year = Column(Integer, nullable=True)

    # Legacy citation field (for backward compatibility)
    citation = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)

    # Structured citation fields
    publication_type = Column(String, default="article")  # book, article, chapter, thesis, conference, report, other
    authors_text = Column(Text, nullable=True)  # Full author string for display
    journal = Column(String, nullable=True)  # Journal name for articles
    publisher = Column(String, nullable=True)  # Publisher for books
    volume = Column(String, nullable=True)
    issue = Column(String, nullable=True)
    pages = Column(String, nullable=True)  # e.g., "123-145"
    doi = Column(String, nullable=True)
    isbn = Column(String, nullable=True)
    url = Column(String, nullable=True)
    abstract = Column(Text, nullable=True)

    # Book chapter specific
    book_title = Column(String, nullable=True)  # Title of the book containing the chapter
    editors = Column(String, nullable=True)  # Editors of the book

    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

    # Relationships
    thinker = relationship("Thinker", back_populates="publications")
    contributors = relationship(
        "Thinker",
        secondary=publication_contributors,
        backref="contributed_publications"
    )
