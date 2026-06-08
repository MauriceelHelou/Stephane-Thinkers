"""
Notion sync metadata models.

Tracks the mapping between local entities and Notion pages,
and records sync job history for idempotency and drift detection.
"""
import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, Integer, DateTime, Text, UniqueConstraint, Index

from app.database import Base
from app.db_types import GUID


class NotionSyncMap(Base):
    """Maps local entity IDs to Notion page IDs for one-way sync."""
    __tablename__ = "notion_sync_map"
    __table_args__ = (
        UniqueConstraint("entity_type", "local_id", name="uq_notion_sync_map_entity_local"),
        UniqueConstraint("notion_page_id", name="uq_notion_sync_map_notion_page"),
        Index("ix_notion_sync_map_entity_type", "entity_type"),
    )

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    local_id = Column(GUID(), nullable=False, index=True)
    entity_type = Column(String(50), nullable=False)  # "note"
    notion_page_id = Column(String(100), nullable=False, index=True)
    last_synced_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    content_hash = Column(String(64), nullable=True)  # SHA-256 of last synced content


class NotionSyncJob(Base):
    """Records each sync job execution for auditing and idempotency."""
    __tablename__ = "notion_sync_jobs"
    __table_args__ = (
        UniqueConstraint("idempotency_key", name="uq_notion_sync_jobs_idempotency_key"),
        Index("ix_notion_sync_jobs_status_started", "status", "started_at"),
    )

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    job_type = Column(String(30), nullable=False)  # "setup", "full", "incremental", "schema_update"
    status = Column(String(20), nullable=False, default="running")  # running, completed, completed_conflicts, failed
    started_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    completed_at = Column(DateTime, nullable=True)
    pages_created = Column(Integer, nullable=True, default=0)
    pages_updated = Column(Integer, nullable=True, default=0)
    pages_skipped = Column(Integer, nullable=True, default=0)
    error_message = Column(Text, nullable=True)
    idempotency_key = Column(String(100), nullable=True, index=True)
