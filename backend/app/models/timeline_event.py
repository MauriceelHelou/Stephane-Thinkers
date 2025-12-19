from sqlalchemy import Column, String, Integer, TIMESTAMP, ForeignKey, CheckConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from app.database import Base
from app.db_types import GUID

class TimelineEvent(Base):
    __tablename__ = "timeline_events"

    # Valid event types
    VALID_EVENT_TYPES = ['council', 'publication', 'war', 'invention', 'cultural', 'political', 'other']

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    timeline_id = Column(GUID, ForeignKey("timelines.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    year = Column(Integer, nullable=False)
    event_type = Column(String, nullable=False)
    description = Column(String, nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        CheckConstraint(
            "event_type IN ('council', 'publication', 'war', 'invention', 'cultural', 'political', 'other')",
            name='valid_event_type'
        ),
    )

    timeline = relationship("Timeline", back_populates="events")
