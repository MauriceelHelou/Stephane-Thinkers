from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, TIMESTAMP
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from app.database import Base
from app.db_types import GUID


class Folder(Base):
    """Hierarchical folder structure for organizing research notes."""

    __tablename__ = "folders"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    parent_id = Column(GUID, ForeignKey("folders.id", ondelete="CASCADE"), nullable=True)
    sort_order = Column(Integer, default=0)
    color = Column(String, nullable=True)
    is_archived = Column(Boolean, default=False, nullable=False, server_default="0")
    archived_at = Column(TIMESTAMP, nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

    parent = relationship("Folder", remote_side=[id], back_populates="children")
    children = relationship(
        "Folder",
        back_populates="parent",
        cascade="all, delete-orphan",
        passive_deletes=True,
        single_parent=True,
    )
    # Notes are preserved on folder delete (folder_id -> NULL), so no delete-orphan.
    notes = relationship("Note", back_populates="folder")
