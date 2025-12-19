from pydantic import BaseModel, ConfigDict, field_validator
from typing import Optional, List
from datetime import datetime
from uuid import UUID

# Reasonable year bounds
MIN_YEAR = -5000
MAX_YEAR = 2200


class InstitutionBase(BaseModel):
    name: str
    city: Optional[str] = None
    country: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    founded_year: Optional[int] = None
    notes: Optional[str] = None

    @field_validator('name')
    @classmethod
    def validate_name(cls, v):
        if not v or not v.strip():
            raise ValueError('Name cannot be empty')
        return v.strip()

    @field_validator('founded_year')
    @classmethod
    def validate_year(cls, v):
        if v is not None and (v < MIN_YEAR or v > MAX_YEAR):
            raise ValueError(f'Year must be between {MIN_YEAR} and {MAX_YEAR}')
        return v

    @field_validator('latitude')
    @classmethod
    def validate_latitude(cls, v):
        if v is not None and (v < -90 or v > 90):
            raise ValueError('Latitude must be between -90 and 90')
        return v

    @field_validator('longitude')
    @classmethod
    def validate_longitude(cls, v):
        if v is not None and (v < -180 or v > 180):
            raise ValueError('Longitude must be between -180 and 180')
        return v


class InstitutionCreate(InstitutionBase):
    pass


class InstitutionUpdate(BaseModel):
    name: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    founded_year: Optional[int] = None
    notes: Optional[str] = None

    @field_validator('name')
    @classmethod
    def validate_name(cls, v):
        if v is not None:
            if not v.strip():
                raise ValueError('Name cannot be empty')
            return v.strip()
        return v


class Institution(InstitutionBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    created_at: datetime
    updated_at: datetime


# ThinkerInstitution schemas for career timeline tracking

class ThinkerInstitutionBase(BaseModel):
    role: Optional[str] = None
    department: Optional[str] = None
    start_year: Optional[int] = None
    end_year: Optional[int] = None
    is_phd_institution: bool = False
    phd_advisor_id: Optional[UUID] = None
    notes: Optional[str] = None

    @field_validator('start_year', 'end_year')
    @classmethod
    def validate_year(cls, v):
        if v is not None and (v < MIN_YEAR or v > MAX_YEAR):
            raise ValueError(f'Year must be between {MIN_YEAR} and {MAX_YEAR}')
        return v


class ThinkerInstitutionCreate(ThinkerInstitutionBase):
    thinker_id: UUID
    institution_id: UUID


class ThinkerInstitutionUpdate(BaseModel):
    role: Optional[str] = None
    department: Optional[str] = None
    start_year: Optional[int] = None
    end_year: Optional[int] = None
    is_phd_institution: Optional[bool] = None
    phd_advisor_id: Optional[UUID] = None
    notes: Optional[str] = None


class ThinkerInstitution(ThinkerInstitutionBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    thinker_id: UUID
    institution_id: UUID
    created_at: datetime
    updated_at: datetime


class ThinkerInstitutionWithRelations(ThinkerInstitution):
    model_config = ConfigDict(from_attributes=True)

    institution: Institution


class InstitutionWithAffiliations(Institution):
    model_config = ConfigDict(from_attributes=True)

    thinker_affiliations: List[ThinkerInstitution] = []
