from typing import List, Literal, Optional
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


class AIUsageResponse(BaseModel):
    day: str
    used_tokens: int
    daily_quota_tokens: int
    cost_controls_enabled: bool
