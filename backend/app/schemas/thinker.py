from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from typing import Optional, List
from datetime import datetime
from uuid import UUID

# Reasonable year bounds for historical figures
MIN_YEAR = -5000  # Ancient civilizations
MAX_YEAR = 2200   # Allow some future


class ThinkerBase(BaseModel):
    name: str
    birth_year: Optional[int] = None
    death_year: Optional[int] = None
    active_period: Optional[str] = None
    field: Optional[str] = None
    biography_notes: Optional[str] = None
    position_x: Optional[float] = None
    position_y: Optional[float] = None
    anchor_year: Optional[int] = None  # Year the thinker is pinned to on timeline
    is_manually_positioned: Optional[bool] = False  # True if user manually dragged this thinker
    timeline_id: Optional[UUID] = None

    @field_validator('name')
    @classmethod
    def validate_name(cls, v):
        if not v or not v.strip():
            raise ValueError('Name cannot be empty')
        if len(v.strip()) < 1:
            raise ValueError('Name must be at least 1 character')
        return v.strip()

    @field_validator('birth_year', 'death_year', 'anchor_year')
    @classmethod
    def validate_year(cls, v):
        if v is not None and (v < MIN_YEAR or v > MAX_YEAR):
            raise ValueError(f'Year must be between {MIN_YEAR} and {MAX_YEAR}')
        return v

    @model_validator(mode='after')
    def validate_year_order(self):
        if self.birth_year is not None and self.death_year is not None:
            if self.birth_year > self.death_year:
                raise ValueError('Birth year must be before or equal to death year')
        return self


class ThinkerCreate(ThinkerBase):
    pass


class ThinkerUpdate(BaseModel):
    name: Optional[str] = None
    birth_year: Optional[int] = None
    death_year: Optional[int] = None
    active_period: Optional[str] = None
    field: Optional[str] = None
    biography_notes: Optional[str] = None
    position_x: Optional[float] = None
    position_y: Optional[float] = None
    anchor_year: Optional[int] = None  # Year the thinker is pinned to on timeline
    is_manually_positioned: Optional[bool] = None  # True if user manually dragged this thinker
    timeline_id: Optional[UUID] = None

    @field_validator('name')
    @classmethod
    def validate_name(cls, v):
        if v is not None:
            if not v.strip():
                raise ValueError('Name cannot be empty')
            return v.strip()
        return v

    @field_validator('birth_year', 'death_year', 'anchor_year')
    @classmethod
    def validate_year(cls, v):
        if v is not None and (v < MIN_YEAR or v > MAX_YEAR):
            raise ValueError(f'Year must be between {MIN_YEAR} and {MAX_YEAR}')
        return v

    @model_validator(mode='after')
    def validate_year_order(self):
        if self.birth_year is not None and self.death_year is not None:
            if self.birth_year > self.death_year:
                raise ValueError('Birth year must be before or equal to death year')
        return self

class Thinker(ThinkerBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    created_at: datetime
    updated_at: datetime

class ThinkerWithRelations(Thinker):
    model_config = ConfigDict(from_attributes=True)

    publications: List['Publication'] = Field(default_factory=list)
    quotes: List['Quote'] = Field(default_factory=list)
    tags: List['Tag'] = Field(default_factory=list)

from app.schemas.publication import Publication
from app.schemas.quote import Quote
from app.schemas.tag import Tag

ThinkerWithRelations.model_rebuild()
