from pydantic import BaseModel, ConfigDict, field_validator
from typing import Optional, List, Literal
from datetime import datetime
from uuid import UUID

# Publication type options
PublicationTypeStr = Literal["book", "article", "chapter", "thesis", "conference", "report", "other"]


class PublicationBase(BaseModel):
    title: str
    year: Optional[int] = None
    citation: Optional[str] = None
    notes: Optional[str] = None

    # Structured citation fields
    publication_type: Optional[PublicationTypeStr] = "article"
    authors_text: Optional[str] = None
    journal: Optional[str] = None
    publisher: Optional[str] = None
    volume: Optional[str] = None
    issue: Optional[str] = None
    pages: Optional[str] = None
    doi: Optional[str] = None
    isbn: Optional[str] = None
    url: Optional[str] = None
    abstract: Optional[str] = None

    # Book chapter specific
    book_title: Optional[str] = None
    editors: Optional[str] = None

    @field_validator('title')
    @classmethod
    def validate_title(cls, v):
        if not v or not v.strip():
            raise ValueError('Title cannot be empty')
        return v.strip()


class PublicationCreate(PublicationBase):
    thinker_id: UUID


class PublicationUpdate(BaseModel):
    title: Optional[str] = None
    year: Optional[int] = None
    citation: Optional[str] = None
    notes: Optional[str] = None
    publication_type: Optional[PublicationTypeStr] = None
    authors_text: Optional[str] = None
    journal: Optional[str] = None
    publisher: Optional[str] = None
    volume: Optional[str] = None
    issue: Optional[str] = None
    pages: Optional[str] = None
    doi: Optional[str] = None
    isbn: Optional[str] = None
    url: Optional[str] = None
    abstract: Optional[str] = None
    book_title: Optional[str] = None
    editors: Optional[str] = None


class Publication(PublicationBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    thinker_id: UUID
    created_at: datetime
    updated_at: Optional[datetime] = None


class PublicationWithFormatted(Publication):
    """Publication with auto-generated citations in multiple formats"""
    model_config = ConfigDict(from_attributes=True)

    citation_chicago: Optional[str] = None
    citation_mla: Optional[str] = None
    citation_apa: Optional[str] = None
