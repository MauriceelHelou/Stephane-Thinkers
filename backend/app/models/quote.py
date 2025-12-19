from sqlalchemy import Column, String, Text, TIMESTAMP, ForeignKey, Integer
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from app.database import Base
from app.db_types import GUID

class Quote(Base):
    __tablename__ = "quotes"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    thinker_id = Column(GUID, ForeignKey("thinkers.id"), nullable=False)
    text = Column(Text, nullable=False)
    source = Column(String, nullable=True)
    year = Column(Integer, nullable=True)  # Year the quote was said/written
    context_notes = Column(Text, nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.now())

    thinker = relationship("Thinker", back_populates="quotes")
