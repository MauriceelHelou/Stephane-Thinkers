from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class FolderBase(BaseModel):
    name: str
    parent_id: Optional[UUID] = None
    sort_order: Optional[int] = 0
    color: Optional[str] = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Folder name cannot be empty")
        return cleaned


class FolderCreate(FolderBase):
    pass


class FolderUpdate(BaseModel):
    name: Optional[str] = None
    parent_id: Optional[UUID] = None
    sort_order: Optional[int] = None
    color: Optional[str] = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Folder name cannot be empty")
        return cleaned


class Folder(FolderBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    is_archived: bool = False
    archived_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class FolderWithChildren(Folder):
    model_config = ConfigDict(from_attributes=True)

    children: List["FolderWithChildren"] = Field(default_factory=list)
    note_count: int = 0


class FolderWithNotes(Folder):
    model_config = ConfigDict(from_attributes=True)

    notes: List[dict] = Field(default_factory=list)


class ReorderItem(BaseModel):
    id: UUID
    sort_order: int
    parent_id: Optional[UUID] = None


class ReorderRequest(BaseModel):
    items: List[ReorderItem]


FolderWithChildren.model_rebuild()
