from pydantic import BaseModel, ConfigDict, model_validator
from typing import Optional
from datetime import datetime
from uuid import UUID

class TimelineBase(BaseModel):
    name: str
    start_year: Optional[int] = None
    end_year: Optional[int] = None
    description: Optional[str] = None

    @model_validator(mode='after')
    def validate_year_range(self):
        if self.start_year is not None and self.end_year is not None:
            if self.start_year > self.end_year:
                raise ValueError(f'start_year ({self.start_year}) cannot be greater than end_year ({self.end_year})')
        return self

class TimelineCreate(TimelineBase):
    pass

class TimelineUpdate(BaseModel):
    name: Optional[str] = None
    start_year: Optional[int] = None
    end_year: Optional[int] = None
    description: Optional[str] = None

    @model_validator(mode='after')
    def validate_year_range(self):
        if self.start_year is not None and self.end_year is not None:
            if self.start_year > self.end_year:
                raise ValueError(f'start_year ({self.start_year}) cannot be greater than end_year ({self.end_year})')
        return self

class Timeline(TimelineBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    created_at: datetime
    updated_at: datetime

class TimelineWithRelations(Timeline):
    pass
