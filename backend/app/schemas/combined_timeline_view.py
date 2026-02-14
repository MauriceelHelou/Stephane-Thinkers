from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, List
from datetime import datetime
from uuid import UUID

from app.schemas.timeline import Timeline

# Schema for creating a member (when creating or updating combined view)
class CombinedViewMemberCreate(BaseModel):
    timeline_id: UUID
    display_order: int
    y_offset: int

# Schema for a member when reading (includes full timeline data)
class CombinedViewMember(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    view_id: UUID
    timeline_id: UUID
    display_order: int
    y_offset: int
    created_at: datetime
    timeline: Timeline  # Nested timeline data

# Base schema for combined timeline view
class CombinedTimelineViewBase(BaseModel):
    name: str
    description: Optional[str] = None

# Schema for creating a combined view
class CombinedTimelineViewCreate(CombinedTimelineViewBase):
    timeline_ids: List[UUID]  # List of timeline IDs to include

# Schema for reading a combined view
class CombinedTimelineView(CombinedTimelineViewBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    created_at: datetime
    updated_at: datetime
    members: List[CombinedViewMember] = Field(default_factory=list)

# Schema for updating a combined view
class CombinedTimelineViewUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    timeline_ids: Optional[List[UUID]] = None  # Optional: update the list of timelines

# Simplified schema without nested data (for list views)
class CombinedTimelineViewSimple(CombinedTimelineViewBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    created_at: datetime
    updated_at: datetime

# Schema with full relations
class CombinedTimelineViewWithRelations(CombinedTimelineView):
    pass
