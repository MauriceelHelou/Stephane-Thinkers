from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from typing import Optional
from datetime import datetime
from uuid import UUID

# Valid event types (must match frontend and model)
VALID_EVENT_TYPES = ['council', 'publication', 'war', 'invention', 'cultural', 'political', 'other']

# Year bounds shared with the frontend (zod) validation.
YEAR_MIN = -10000
YEAR_MAX = 10000

class TimelineEventBase(BaseModel):
    timeline_id: UUID
    name: str
    year: int
    end_year: Optional[int] = Field(default=None, ge=YEAR_MIN, le=YEAR_MAX)
    event_type: str
    description: Optional[str] = None

    @field_validator('event_type')
    @classmethod
    def validate_event_type(cls, v: str) -> str:
        if v not in VALID_EVENT_TYPES:
            raise ValueError(f"event_type must be one of: {', '.join(VALID_EVENT_TYPES)}")
        return v

    @model_validator(mode='after')
    def validate_end_year_not_before_year(self):
        if self.end_year is not None and self.end_year < self.year:
            raise ValueError("end_year must be greater than or equal to year")
        return self

class TimelineEventCreate(TimelineEventBase):
    pass

class TimelineEventUpdate(BaseModel):
    timeline_id: Optional[UUID] = None
    name: Optional[str] = None
    year: Optional[int] = None
    end_year: Optional[int] = Field(default=None, ge=YEAR_MIN, le=YEAR_MAX)
    event_type: Optional[str] = None
    description: Optional[str] = None

    @field_validator('event_type')
    @classmethod
    def validate_event_type(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in VALID_EVENT_TYPES:
            raise ValueError(f"event_type must be one of: {', '.join(VALID_EVENT_TYPES)}")
        return v

    # NOTE: the end_year >= year rule for updates is enforced once, in the update
    # route, which validates the effective (payload-merged-with-persisted) pair.
    # Duplicating a both-present check here would be redundant with that.

class TimelineEvent(TimelineEventBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    created_at: datetime
    updated_at: datetime
