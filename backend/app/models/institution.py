from sqlalchemy import Column, String, Integer, Float, Text, TIMESTAMP, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from app.database import Base
from app.db_types import GUID


class Institution(Base):
    """Represents an academic institution (university, research center, etc.)"""
    __tablename__ = "institutions"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False, unique=True)
    city = Column(String, nullable=True)
    country = Column(String, nullable=True)
    latitude = Column(Float, nullable=True)  # For geographic visualization
    longitude = Column(Float, nullable=True)
    founded_year = Column(Integer, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

    # Relationships
    thinker_affiliations = relationship("ThinkerInstitution", back_populates="institution", cascade="all, delete-orphan")


class ThinkerInstitution(Base):
    """Tracks a thinker's affiliation with an institution over time (career timeline)"""
    __tablename__ = "thinker_institutions"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    thinker_id = Column(GUID, ForeignKey("thinkers.id", ondelete="CASCADE"), nullable=False)
    institution_id = Column(GUID, ForeignKey("institutions.id", ondelete="CASCADE"), nullable=False)
    role = Column(String, nullable=True)  # e.g., "Professor", "PhD Student", "Visiting Scholar"
    department = Column(String, nullable=True)  # e.g., "Philosophy", "Mathematics"
    start_year = Column(Integer, nullable=True)
    end_year = Column(Integer, nullable=True)  # NULL = current/ongoing
    is_phd_institution = Column(Integer, default=0)  # Boolean: 1 if PhD was earned here
    phd_advisor_id = Column(GUID, ForeignKey("thinkers.id", ondelete="SET NULL"), nullable=True)  # For academic lineage
    notes = Column(Text, nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

    # Relationships
    thinker = relationship("Thinker", foreign_keys=[thinker_id], back_populates="institution_affiliations")
    institution = relationship("Institution", back_populates="thinker_affiliations")
    phd_advisor = relationship("Thinker", foreign_keys=[phd_advisor_id])
