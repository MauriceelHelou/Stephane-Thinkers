from sqlalchemy import Column, String, Integer, Float, Text, TIMESTAMP, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from app.database import Base
from app.db_types import GUID

class Thinker(Base):
    __tablename__ = "thinkers"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    birth_year = Column(Integer, nullable=True)
    death_year = Column(Integer, nullable=True)
    active_period = Column(String, nullable=True)
    field = Column(String, nullable=True)
    biography_notes = Column(Text, nullable=True)
    position_x = Column(Float, nullable=True)
    position_y = Column(Float, nullable=True)
    anchor_year = Column(Integer, nullable=True)  # Year the thinker is pinned to on timeline
    is_manually_positioned = Column(Boolean, default=False, nullable=False)  # True if user manually dragged this thinker
    timeline_id = Column(GUID, ForeignKey("timelines.id"), nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

    timeline = relationship("Timeline", back_populates="thinkers")
    publications = relationship("Publication", back_populates="thinker", cascade="all, delete-orphan")
    quotes = relationship("Quote", back_populates="thinker", cascade="all, delete-orphan")
    tags = relationship("Tag", secondary="thinker_tags", back_populates="thinkers")
    connections_from = relationship("Connection", foreign_keys="Connection.from_thinker_id", back_populates="from_thinker", cascade="all, delete-orphan")
    connections_to = relationship("Connection", foreign_keys="Connection.to_thinker_id", back_populates="to_thinker", cascade="all, delete-orphan")
    institution_affiliations = relationship("ThinkerInstitution", foreign_keys="ThinkerInstitution.thinker_id", back_populates="thinker", cascade="all, delete-orphan")
    notes = relationship("Note", back_populates="thinker", cascade="all, delete-orphan")
