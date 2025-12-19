from pydantic import BaseModel, ConfigDict, field_validator
from typing import Optional, List, Literal
from datetime import datetime
from uuid import UUID

QuestionStatusStr = Literal["open", "in_progress", "answered", "abandoned"]
QuestionCategoryStr = Literal["influence", "periodization", "methodology", "biography", "other"]


class RelatedThinker(BaseModel):
    """Minimal thinker info for related thinkers."""
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str


class ResearchQuestionBase(BaseModel):
    title: str
    description: Optional[str] = None
    status: Optional[QuestionStatusStr] = "open"
    priority: Optional[int] = 3
    category: Optional[QuestionCategoryStr] = None
    tags_text: Optional[str] = None
    hypothesis: Optional[str] = None
    evidence_for: Optional[str] = None
    evidence_against: Optional[str] = None
    conclusion: Optional[str] = None
    parent_question_id: Optional[UUID] = None

    @field_validator('title')
    @classmethod
    def validate_title(cls, v):
        if not v or not v.strip():
            raise ValueError('Title cannot be empty')
        return v.strip()

    @field_validator('priority')
    @classmethod
    def validate_priority(cls, v):
        if v is not None and (v < 1 or v > 5):
            raise ValueError('Priority must be between 1 and 5')
        return v


class ResearchQuestionCreate(ResearchQuestionBase):
    related_thinker_ids: Optional[List[UUID]] = None


class ResearchQuestionUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[QuestionStatusStr] = None
    priority: Optional[int] = None
    category: Optional[QuestionCategoryStr] = None
    tags_text: Optional[str] = None
    hypothesis: Optional[str] = None
    evidence_for: Optional[str] = None
    evidence_against: Optional[str] = None
    conclusion: Optional[str] = None
    parent_question_id: Optional[UUID] = None
    related_thinker_ids: Optional[List[UUID]] = None


class ResearchQuestion(ResearchQuestionBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    created_at: datetime
    updated_at: datetime


class ResearchQuestionWithRelations(ResearchQuestion):
    model_config = ConfigDict(from_attributes=True)

    related_thinkers: List[RelatedThinker] = []
    sub_questions: Optional[List['ResearchQuestion']] = []

    @field_validator('sub_questions', mode='before')
    @classmethod
    def ensure_sub_questions_list(cls, v):
        """Ensure sub_questions is always a list, never None."""
        if v is None:
            return []
        return v

    @field_validator('related_thinkers', mode='before')
    @classmethod
    def ensure_related_thinkers_list(cls, v):
        """Ensure related_thinkers is always a list, never None."""
        if v is None:
            return []
        return v


# Rebuild model for forward reference
ResearchQuestionWithRelations.model_rebuild()
