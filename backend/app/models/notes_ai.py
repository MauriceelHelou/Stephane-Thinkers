from sqlalchemy import (
    Column,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    TIMESTAMP,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from app.database import Base
from app.db_types import GUID


class SynthesisRun(Base):
    __tablename__ = "synthesis_runs"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    term_id = Column(GUID, ForeignKey("critical_terms.id", ondelete="CASCADE"), nullable=False, index=True)
    mode = Column(String, nullable=False, index=True)  # definition, comparative, critical
    folder_id = Column(GUID, ForeignKey("folders.id", ondelete="SET NULL"), nullable=True, index=True)
    thinker_id = Column(GUID, ForeignKey("thinkers.id", ondelete="SET NULL"), nullable=True, index=True)
    filter_context = Column(String, nullable=False, default="all notes")
    synthesis_text = Column(Text, nullable=False)
    coverage_rate = Column(Float, nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.now(), nullable=False, index=True)

    citations = relationship("SynthesisRunCitation", back_populates="run", cascade="all, delete-orphan")
    snapshots = relationship("SynthesisSnapshot", back_populates="run", cascade="all, delete-orphan")
    quality_reports = relationship("QualityReport", back_populates="run", cascade="all, delete-orphan")


class SynthesisRunCitation(Base):
    __tablename__ = "synthesis_run_citations"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    run_id = Column(GUID, ForeignKey("synthesis_runs.id", ondelete="CASCADE"), nullable=False, index=True)
    occurrence_id = Column(GUID, ForeignKey("term_occurrences.id", ondelete="SET NULL"), nullable=True, index=True)
    citation_key = Column(String, nullable=False)
    note_id = Column(GUID, ForeignKey("notes.id", ondelete="CASCADE"), nullable=False, index=True)
    note_title = Column(String, nullable=False)
    folder_name = Column(String, nullable=True)
    context_snippet = Column(Text, nullable=False)
    created_at = Column(TIMESTAMP, server_default=func.now(), nullable=False)

    run = relationship("SynthesisRun", back_populates="citations")


class SynthesisSnapshot(Base):
    __tablename__ = "synthesis_snapshots"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    run_id = Column(GUID, ForeignKey("synthesis_runs.id", ondelete="CASCADE"), nullable=False, index=True)
    snapshot_hash = Column(String, nullable=False, index=True)
    payload_json = Column(Text, nullable=False)
    created_at = Column(TIMESTAMP, server_default=func.now(), nullable=False)

    run = relationship("SynthesisRun", back_populates="snapshots")


class QualityReport(Base):
    __tablename__ = "quality_reports"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    run_id = Column(GUID, ForeignKey("synthesis_runs.id", ondelete="CASCADE"), nullable=False, index=True)
    coverage_rate = Column(Float, nullable=False, default=0.0)
    unsupported_claim_count = Column(Integer, nullable=False, default=0)
    contradiction_count = Column(Integer, nullable=False, default=0)
    uncertainty_label = Column(String, nullable=False, default="low")
    details_json = Column(Text, nullable=False, default="{}")
    created_at = Column(TIMESTAMP, server_default=func.now(), nullable=False)

    run = relationship("SynthesisRun", back_populates="quality_reports")


class ClaimCandidate(Base):
    __tablename__ = "claim_candidates"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    term_id = Column(GUID, ForeignKey("critical_terms.id", ondelete="CASCADE"), nullable=False, index=True)
    run_id = Column(GUID, ForeignKey("synthesis_runs.id", ondelete="SET NULL"), nullable=True, index=True)
    claim_text = Column(Text, nullable=False)
    support_summary = Column(Text, nullable=False)
    confidence = Column(Float, nullable=False, default=0.5)
    created_at = Column(TIMESTAMP, server_default=func.now(), nullable=False, index=True)


class ArgumentMap(Base):
    __tablename__ = "argument_maps"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    title = Column(String, nullable=False)
    source_type = Column(String, nullable=False)  # term|notes
    source_id = Column(String, nullable=True, index=True)
    summary = Column(Text, nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.now(), nullable=False, index=True)

    nodes = relationship("ArgumentMapNode", back_populates="argument_map", cascade="all, delete-orphan")
    edges = relationship("ArgumentMapEdge", back_populates="argument_map", cascade="all, delete-orphan")


class ArgumentMapNode(Base):
    __tablename__ = "argument_map_nodes"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    map_id = Column(GUID, ForeignKey("argument_maps.id", ondelete="CASCADE"), nullable=False, index=True)
    node_type = Column(String, nullable=False, index=True)  # claim|evidence|counterclaim
    label = Column(Text, nullable=False)
    confidence = Column(Float, nullable=False, default=0.5)
    metadata_json = Column(Text, nullable=False, default="{}")
    created_at = Column(TIMESTAMP, server_default=func.now(), nullable=False)

    argument_map = relationship("ArgumentMap", back_populates="nodes")


class ArgumentMapEdge(Base):
    __tablename__ = "argument_map_edges"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    map_id = Column(GUID, ForeignKey("argument_maps.id", ondelete="CASCADE"), nullable=False, index=True)
    from_node_id = Column(GUID, ForeignKey("argument_map_nodes.id", ondelete="CASCADE"), nullable=False, index=True)
    to_node_id = Column(GUID, ForeignKey("argument_map_nodes.id", ondelete="CASCADE"), nullable=False, index=True)
    edge_type = Column(String, nullable=False)  # supports|contradicts
    weight = Column(Float, nullable=False, default=1.0)
    created_at = Column(TIMESTAMP, server_default=func.now(), nullable=False)

    argument_map = relationship("ArgumentMap", back_populates="edges")


class TermAlias(Base):
    __tablename__ = "term_aliases"
    __table_args__ = (UniqueConstraint("term_id", "alias_name", name="uq_term_aliases_term_alias"),)

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    term_id = Column(GUID, ForeignKey("critical_terms.id", ondelete="CASCADE"), nullable=False, index=True)
    alias_name = Column(String, nullable=False, index=True)
    status = Column(String, nullable=False, default="proposed", index=True)  # proposed|approved|rejected
    approved_at = Column(TIMESTAMP, nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.now(), nullable=False)


class TermRelationship(Base):
    __tablename__ = "term_relationships"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    source_term_id = Column(GUID, ForeignKey("critical_terms.id", ondelete="CASCADE"), nullable=False, index=True)
    target_term_id = Column(GUID, ForeignKey("critical_terms.id", ondelete="CASCADE"), nullable=False, index=True)
    relationship_type = Column(String, nullable=False, index=True)  # related|depends_on|contrasts
    score = Column(Float, nullable=False, default=0.0)
    created_at = Column(TIMESTAMP, server_default=func.now(), nullable=False)


class NoteEmbedding(Base):
    __tablename__ = "note_embeddings"
    __table_args__ = (UniqueConstraint("note_id", name="uq_note_embeddings_note_id"),)

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    note_id = Column(GUID, ForeignKey("notes.id", ondelete="CASCADE"), nullable=False, index=True)
    embedding_model = Column(String, nullable=False)
    vector_json = Column(Text, nullable=False)
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now(), nullable=False, index=True)


class PlannerRun(Base):
    __tablename__ = "planner_runs"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    run_type = Column(String, nullable=False, index=True)  # sprint|brief|viva
    input_context = Column(Text, nullable=False)
    output_markdown = Column(Text, nullable=False)
    created_at = Column(TIMESTAMP, server_default=func.now(), nullable=False, index=True)


class WeeklyDigest(Base):
    __tablename__ = "weekly_digests"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    period_start = Column(String, nullable=False, index=True)
    period_end = Column(String, nullable=False, index=True)
    digest_markdown = Column(Text, nullable=False)
    created_at = Column(TIMESTAMP, server_default=func.now(), nullable=False, index=True)


class IngestionJob(Base):
    __tablename__ = "ingestion_jobs"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    job_type = Column(String, nullable=False, index=True)  # transcript|pdf_highlights
    status = Column(String, nullable=False, index=True, default="queued")  # queued|running|completed|failed
    payload_json = Column(Text, nullable=False, default="{}")
    result_json = Column(Text, nullable=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.now(), nullable=False, index=True)
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now(), nullable=False, index=True)

    artifacts = relationship("SourceArtifact", back_populates="job", cascade="all, delete-orphan")


class SourceArtifact(Base):
    __tablename__ = "source_artifacts"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    job_id = Column(GUID, ForeignKey("ingestion_jobs.id", ondelete="CASCADE"), nullable=False, index=True)
    file_name = Column(String, nullable=False)
    file_type = Column(String, nullable=False)  # transcript|pdf
    raw_text = Column(Text, nullable=False)
    metadata_json = Column(Text, nullable=False, default="{}")
    created_at = Column(TIMESTAMP, server_default=func.now(), nullable=False)

    job = relationship("IngestionJob", back_populates="artifacts")
