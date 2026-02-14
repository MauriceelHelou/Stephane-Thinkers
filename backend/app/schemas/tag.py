from pydantic import BaseModel, ConfigDict, field_validator
from typing import Optional
from datetime import datetime
from uuid import UUID

class TagBase(BaseModel):
    name: str
    color: Optional[str] = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        if not value or not value.strip():
            raise ValueError("Tag name cannot be empty")
        return value.strip()

class TagCreate(TagBase):
    pass

class TagUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        if not value.strip():
            raise ValueError("Tag name cannot be empty")
        return value.strip()

class Tag(TagBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    created_at: datetime
