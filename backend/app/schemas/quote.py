from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime
from uuid import UUID

class QuoteBase(BaseModel):
    text: str
    source: Optional[str] = None
    year: Optional[int] = None
    context_notes: Optional[str] = None

class QuoteCreate(QuoteBase):
    thinker_id: UUID

class QuoteUpdate(BaseModel):
    text: Optional[str] = None
    source: Optional[str] = None
    year: Optional[int] = None
    context_notes: Optional[str] = None

class Quote(QuoteBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    thinker_id: UUID
    created_at: datetime
