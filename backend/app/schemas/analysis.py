from typing import Any, Dict, List, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class DetectedThinker(BaseModel):
    """A thinker detected in note content, aggregated by thinker."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    birth_year: Optional[int] = None
    death_year: Optional[int] = None
    field: Optional[str] = None
    mention_count: int
    paragraph_indices: List[int]


class ThinkerDetectionResult(BaseModel):
    known_thinkers: List[DetectedThinker]
    unknown_names: List[str]
    total_mentions: int


class YearAnnotationResult(BaseModel):
    content_modified: bool = False
    updated_content: Optional[str] = None
    updated_content_html: Optional[str] = None


class DetectedMention(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    thinker_id: UUID
    thinker_name: str
    matched_text: str
    paragraph_index: int
    char_offset: int


class TermThinkerBubble(BaseModel):
    """One bubble in the constellation chart."""

    model_config = ConfigDict(from_attributes=True)

    term_id: UUID
    term_name: str
    thinker_id: UUID
    thinker_name: str
    thinker_birth_year: Optional[int] = None
    thinker_death_year: Optional[int] = None
    frequency: int
    sample_snippets: List[str] = Field(default_factory=list)


class TermThinkerMatrixResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    bubbles: List[TermThinkerBubble]
    terms: List[str]
    thinkers: List[str]
    total_bubbles: int
    max_frequency: int


class CoOccurrencePair(BaseModel):
    """Aggregated thinker pair co-occurrence metrics."""

    model_config = ConfigDict(from_attributes=True)

    thinker_a_id: UUID
    thinker_a_name: str
    thinker_a_birth_year: Optional[int] = None
    thinker_a_death_year: Optional[int] = None
    thinker_b_id: UUID
    thinker_b_name: str
    thinker_b_birth_year: Optional[int] = None
    thinker_b_death_year: Optional[int] = None
    co_occurrence_count: int
    same_paragraph_count: int
    has_existing_connection: bool
    existing_connection_type: Optional[str] = None


class ConnectionSuggestionFromNotes(BaseModel):
    """A suggested connection derived from note-based co-occurrence data."""

    model_config = ConfigDict(from_attributes=True)

    thinker_a_id: UUID
    thinker_a_name: str
    thinker_a_birth_year: Optional[int] = None
    thinker_a_death_year: Optional[int] = None
    thinker_b_id: UUID
    thinker_b_name: str
    thinker_b_birth_year: Optional[int] = None
    thinker_b_death_year: Optional[int] = None
    co_occurrence_count: int
    same_paragraph_count: int
    sample_note_titles: List[str]
    sample_excerpts: List[str]
    confidence: Literal["high", "medium", "low"]


class ArgumentNode(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    node_type: Literal["claim", "evidence", "counterclaim"]
    label: str
    confidence: float


class ArgumentEdge(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    from_node_id: UUID
    to_node_id: UUID
    edge_type: str
    weight: float


class PremiseGap(BaseModel):
    message: str
    severity: Literal["low", "medium", "high"]


class ArgumentMapResponse(BaseModel):
    map_id: UUID
    title: str
    nodes: List[ArgumentNode] = Field(default_factory=list)
    edges: List[ArgumentEdge] = Field(default_factory=list)
    premise_gaps: List[PremiseGap] = Field(default_factory=list)


class ArgumentMapRequest(BaseModel):
    note_ids: List[UUID] = Field(default_factory=list)
    title: Optional[str] = None


class PremiseGapCheckRequest(BaseModel):
    note_ids: List[UUID] = Field(default_factory=list)


class PremiseGapCheckResponse(BaseModel):
    gaps: List[PremiseGap] = Field(default_factory=list)


class SemanticSearchResult(BaseModel):
    note_id: UUID
    note_title: str
    excerpt: str
    score: float


class RelatedExcerpt(BaseModel):
    occurrence_id: UUID
    note_id: UUID
    note_title: str
    context_snippet: str
    similarity: float


class ConnectionExplanation(BaseModel):
    thinker_a_id: UUID
    thinker_b_id: UUID
    evidence_count: int
    confidence: Literal["high", "medium", "low"]
    rationale: str
    sample_excerpts: List[str] = Field(default_factory=list)


class PlanTask(BaseModel):
    title: str
    rationale: str
    evidence_refs: List[str] = Field(default_factory=list)


class ResearchSprintPlanResponse(BaseModel):
    focus: str
    tasks: List[PlanTask] = Field(default_factory=list)


class AdvisorBriefResponse(BaseModel):
    date_window: str
    highlights: List[str] = Field(default_factory=list)
    decisions_needed: List[str] = Field(default_factory=list)
    open_risks: List[str] = Field(default_factory=list)


class VivaQuestion(BaseModel):
    question: str
    expected_answer_rubric: str
    evidence_refs: List[str] = Field(default_factory=list)


class VivaPracticeResponse(BaseModel):
    topic: str
    questions: List[VivaQuestion] = Field(default_factory=list)


class WeeklyDigestResponse(BaseModel):
    id: UUID
    period_start: str
    period_end: str
    digest_markdown: str


class DraftFromExcerptsRequest(BaseModel):
    excerpt_ids: List[UUID] = Field(default_factory=list)
    tone: Optional[str] = "scholarly"
    max_length: Optional[int] = 800


class DraftFromExcerptsResponse(BaseModel):
    draft: str
    citations: List[str] = Field(default_factory=list)


class IngestionRequest(BaseModel):
    file_name: str
    content: str


class IngestionResponse(BaseModel):
    job_id: UUID
    status: str
    artifact_count: int = 0


class JobStatusResponse(BaseModel):
    job_id: UUID
    job_type: str
    status: str
    result_json: Optional[str] = None
    error_message: Optional[str] = None


class TimelinePreviewRequest(BaseModel):
    file_name: str
    content: str
    timeline_name_hint: Optional[str] = None
    start_year_hint: Optional[int] = None
    end_year_hint: Optional[int] = None


class TimelinePreviewResponse(BaseModel):
    job_id: UUID
    session_id: UUID
    status: str
    execution_mode: Literal["queued", "inline_dev", "inline_fallback"]


class TimelineBootstrapSessionResponse(BaseModel):
    session_id: UUID
    ingestion_job_id: UUID
    status: str
    timeline_name_suggested: Optional[str] = None
    summary_markdown: Optional[str] = None
    candidate_counts: Dict[str, int] = Field(default_factory=dict)
    warnings: List[str] = Field(default_factory=list)
    partial: bool = False
    telemetry: Dict[str, Any] = Field(default_factory=dict)
    error_message: Optional[str] = None
    committed_timeline_id: Optional[UUID] = None
    created_at: str
    updated_at: str


class TimelineBootstrapEvidence(BaseModel):
    source_artifact_id: Optional[UUID] = None
    chunk_index: int
    char_start: int
    char_end: int
    excerpt: str


class TimelineBootstrapCandidateItem(BaseModel):
    candidate_id: str
    entity_type: Literal["thinkers", "events", "connections", "publications", "quotes"]
    confidence: float = 0.5
    include: bool = True
    fields: Dict[str, Any] = Field(default_factory=dict)
    dependency_keys: List[str] = Field(default_factory=list)
    evidence: List[TimelineBootstrapEvidence] = Field(default_factory=list)
    match_status: Optional[str] = None
    matched_thinker_id: Optional[UUID] = None
    match_score: Optional[float] = None
    match_reasons: List[str] = Field(default_factory=list)
    metadata_delta: Dict[str, Any] = Field(default_factory=dict)
    sort_key: Optional[int] = None


class TimelineBootstrapCandidatesResponse(BaseModel):
    items: List[TimelineBootstrapCandidateItem]
    next_cursor: Optional[str] = None
    has_more: bool = False
    total: int = 0


class TimelineValidationEdits(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    start_year: Optional[int] = None
    end_year: Optional[int] = None


class TimelineBootstrapCandidateValidationUpdate(BaseModel):
    entity_type: Literal["thinkers", "events", "connections", "publications", "quotes"]
    candidate_id: str
    include: Optional[bool] = None
    fields: Optional[Dict[str, Any]] = None
    match_action: Optional[Literal["reuse", "create"]] = None
    matched_thinker_id: Optional[UUID] = None


class TimelineBootstrapValidationRequest(BaseModel):
    timeline: Optional[TimelineValidationEdits] = None
    candidates: List[TimelineBootstrapCandidateValidationUpdate] = Field(default_factory=list)


class ValidationDiagnostic(BaseModel):
    code: str
    message: str
    severity: str
    entity_type: Optional[str] = None
    candidate_id: Optional[str] = None


class TimelineBootstrapDiagnostics(BaseModel):
    blocking: List[ValidationDiagnostic] = Field(default_factory=list)
    non_blocking: List[ValidationDiagnostic] = Field(default_factory=list)
    has_blocking: bool = False


class TimelineBootstrapValidationResponse(BaseModel):
    validation_json: Dict[str, Any]
    diagnostics: TimelineBootstrapDiagnostics


class TimelineBootstrapCommitRequest(BaseModel):
    commit_message: Optional[str] = None
    force_skip_invalid: bool = True


class TimelineBootstrapCommitResponse(BaseModel):
    timeline_id: UUID
    audit_id: UUID
    created_counts: Dict[str, int]
    skipped_counts: Dict[str, int]
    warnings: List[str] = Field(default_factory=list)


class TimelineBootstrapAuditResponse(BaseModel):
    audit_id: UUID
    session_id: UUID
    created_counts: Dict[str, int]
    skipped_counts: Dict[str, int]
    warnings: List[str] = Field(default_factory=list)
    id_mappings: Dict[str, str] = Field(default_factory=dict)
    committed_by: Optional[str] = None
    created_at: str


class AIUsageResponse(BaseModel):
    day: str
    used_tokens: int
    daily_quota_tokens: int
    cost_controls_enabled: bool
