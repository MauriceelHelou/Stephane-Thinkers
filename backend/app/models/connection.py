from sqlalchemy import Boolean, Column, Enum, ForeignKey, Integer, String, TIMESTAMP, Text, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
import enum

from app.database import Base
from app.db_types import GUID

class ConnectionType(enum.Enum):
    influenced = "influenced"
    critiqued = "critiqued"
    built_upon = "built_upon"
    synthesized = "synthesized"

class Connection(Base):
    __tablename__ = "connections"
    __table_args__ = (
        UniqueConstraint("from_thinker_id", "to_thinker_id", name="uq_connections_from_to"),
    )

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    from_thinker_id = Column(GUID, ForeignKey("thinkers.id"), nullable=False, index=True)
    to_thinker_id = Column(GUID, ForeignKey("thinkers.id"), nullable=False, index=True)
    connection_type = Column(Enum(ConnectionType), nullable=False)
    name = Column(String(255), nullable=True)
    notes = Column(Text, nullable=True)
    bidirectional = Column(Boolean, default=False)
    strength = Column(Integer, nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

    from_thinker = relationship("Thinker", foreign_keys=[from_thinker_id], back_populates="connections_from")
    to_thinker = relationship("Thinker", foreign_keys=[to_thinker_id], back_populates="connections_to")
