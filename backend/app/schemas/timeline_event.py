from pydantic import BaseModel, ConfigDict, field_validator
from typing import Optional
from datetime import datetime
from uuid import UUID

# Valid event types (must match frontend and model)
VALID_EVENT_TYPES = ['council', 'publication', 'war', 'invention', 'cultural', 'political', 'other']

class TimelineEventBase(BaseModel):
    timeline_id: UUID
    name: str
    year: int
    event_type: str
    description: Optional[str] = None

    @field_validator('event_type')
    @classmethod
    def validate_event_type(cls, v: str) -> str:
        if v not in VALID_EVENT_TYPES:
            raise ValueError(f"event_type must be one of: {', '.join(VALID_EVENT_TYPES)}")
        return v

class TimelineEventCreate(TimelineEventBase):
    pass

class TimelineEventUpdate(BaseModel):
    timeline_id: Optional[UUID] = None
    name: Optional[str] = None
    year: Optional[int] = None
    event_type: Optional[str] = None
    description: Optional[str] = None

    @field_validator('event_type')
    @classmethod
    def validate_event_type(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in VALID_EVENT_TYPES:
            raise ValueError(f"event_type must be one of: {', '.join(VALID_EVENT_TYPES)}")
        return v

class TimelineEvent(TimelineEventBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    created_at: datetime
    updated_at: datetime
