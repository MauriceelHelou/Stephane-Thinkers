"""
Backup metadata models for tracking automated backup runs, artifacts, and restore validations.
"""
import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, Integer, DateTime, Text, ForeignKey, BigInteger
from sqlalchemy.orm import relationship

from app.database import Base
from app.db_types import GUID


class BackupRun(Base):
    __tablename__ = "backup_runs"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    trigger = Column(String(50), nullable=False)  # "scheduled", "manual", "pre-migration"
    status = Column(String(20), nullable=False, default="running")  # running, completed, failed
    started_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    completed_at = Column(DateTime, nullable=True)
    error_message = Column(Text, nullable=True)
    total_rows = Column(Integer, nullable=True)
    retention_tag = Column(String(20), nullable=True)  # "daily", "weekly", "monthly"

    artifacts = relationship("BackupArtifact", back_populates="backup_run", cascade="all, delete-orphan")


class BackupArtifact(Base):
    __tablename__ = "backup_artifacts"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    backup_run_id = Column(GUID(), ForeignKey("backup_runs.id"), nullable=False)
    file_path = Column(Text, nullable=False)
    size_bytes = Column(BigInteger, nullable=False)
    checksum_sha256 = Column(String(64), nullable=False)
    manifest_signature = Column(Text, nullable=True)  # HMAC signature of manifest
    signing_key_id = Column(String(100), nullable=True)  # key identifier for rotation
    storage_backend = Column(String(20), nullable=False, default="local")  # "local" or "r2"
    cloud_key = Column(Text, nullable=True)  # object key in cloud storage
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))

    backup_run = relationship("BackupRun", back_populates="artifacts")


class RestoreValidationRun(Base):
    __tablename__ = "restore_validation_runs"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    artifact_id = Column(GUID(), ForeignKey("backup_artifacts.id"), nullable=False)
    status = Column(String(20), nullable=False, default="running")  # running, passed, failed
    started_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    completed_at = Column(DateTime, nullable=True)
    row_count_match = Column(Integer, nullable=True)  # 1=match, 0=mismatch
    checksum_valid = Column(Integer, nullable=True)  # 1=valid, 0=invalid
    signature_valid = Column(Integer, nullable=True)  # 1=valid, 0=invalid
    elapsed_seconds = Column(Integer, nullable=True)
    error_message = Column(Text, nullable=True)

    artifact = relationship("BackupArtifact")
