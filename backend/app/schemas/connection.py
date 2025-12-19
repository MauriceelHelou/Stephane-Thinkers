from pydantic import BaseModel, ConfigDict, field_validator
from typing import Optional
from datetime import datetime
from uuid import UUID
from enum import Enum

class ConnectionType(str, Enum):
    influenced = "influenced"
    critiqued = "critiqued"
    built_upon = "built_upon"
    synthesized = "synthesized"

class ConnectionBase(BaseModel):
    from_thinker_id: UUID
    to_thinker_id: UUID
    connection_type: ConnectionType
    name: Optional[str] = None
    notes: Optional[str] = None
    bidirectional: bool = False
    strength: Optional[int] = None

    @field_validator('strength')
    @classmethod
    def validate_strength(cls, v):
        if v is not None and (v < 1 or v > 5):
            raise ValueError('Strength must be between 1 and 5')
        return v

class ConnectionCreate(ConnectionBase):
    pass

class ConnectionUpdate(BaseModel):
    from_thinker_id: Optional[UUID] = None
    to_thinker_id: Optional[UUID] = None
    connection_type: Optional[ConnectionType] = None
    name: Optional[str] = None
    notes: Optional[str] = None
    bidirectional: Optional[bool] = None
    strength: Optional[int] = None

    @field_validator('strength')
    @classmethod
    def validate_strength(cls, v):
        if v is not None and (v < 1 or v > 5):
            raise ValueError('Strength must be between 1 and 5')
        return v

class Connection(ConnectionBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    created_at: datetime
    updated_at: datetime

class ConnectionWithRelations(Connection):
    pass
