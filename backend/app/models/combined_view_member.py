from sqlalchemy import Column, Integer, ForeignKey, TIMESTAMP
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from app.database import Base
from app.db_types import GUID

class CombinedViewMember(Base):
    __tablename__ = "combined_view_members"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    view_id = Column(GUID, ForeignKey("combined_timeline_views.id", ondelete="CASCADE"), nullable=False)
    timeline_id = Column(GUID, ForeignKey("timelines.id", ondelete="CASCADE"), nullable=False)
    display_order = Column(Integer, nullable=False)
    y_offset = Column(Integer, nullable=False)
    created_at = Column(TIMESTAMP, server_default=func.now())

    view = relationship("CombinedTimelineView", back_populates="members")
    timeline = relationship("Timeline")
