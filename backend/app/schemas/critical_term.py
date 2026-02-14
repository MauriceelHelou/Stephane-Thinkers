from datetime import datetime
from typing import List, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class CriticalTermBase(BaseModel):
    name: str
    description: Optional[str] = None
    is_active: Optional[bool] = True

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        normalized = value.strip().lower()
        if not normalized:
            raise ValueError("Term name cannot be empty")
        return normalized


class CriticalTermCreate(CriticalTermBase):
    pass


class CriticalTermUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        normalized = value.strip().lower()
        if not normalized:
            raise ValueError("Term name cannot be empty")
        return normalized


class CriticalTerm(CriticalTermBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    created_at: datetime
    updated_at: datetime


class CriticalTermWithCount(CriticalTerm):
    occurrence_count: int = 0


class TermOccurrenceBase(BaseModel):
    context_snippet: str
    paragraph_index: Optional[int] = None
    char_offset: Optional[int] = None


class TermOccurrenceResponse(TermOccurrenceBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    term_id: Optional[UUID] = None
    note_id: UUID
    created_at: datetime
    # Plan 5 denormalized fields
    note_title: Optional[str] = None
    folder_name: Optional[str] = None
    thinker_names: List[str] = Field(default_factory=list)
    # Plan 6 denormalized fields
    note_folder_name: Optional[str] = None
    note_folder_id: Optional[UUID] = None
    associated_thinkers: Optional[List[dict]] = None


class ScanResultResponse(BaseModel):
    term_id: UUID
    term_name: str
    occurrence_count: int
    message: str


class ExcerptGroup(BaseModel):
    group_name: str
    group_id: Optional[UUID] = None
    excerpts: List[TermOccurrenceResponse]
    excerpt_count: int


class SynthesisCitation(BaseModel):
    citation_key: str
    note_id: UUID
    note_title: str
    folder_name: Optional[str] = None
    context_snippet: str


class TermDefinitionResponse(BaseModel):
    term: CriticalTerm
    excerpts_by_thinker: List[ExcerptGroup]
    excerpts_by_folder: List[ExcerptGroup]
    total_occurrences: int
    synthesis: Optional[str] = None
    synthesis_citations: List[SynthesisCitation] = Field(default_factory=list)
    filter_context: str
    available_folders: List[dict] = Field(default_factory=list)
    available_thinkers: List[dict] = Field(default_factory=list)


SynthesisMode = Literal["definition", "comparative", "critical"]


class EvidenceStats(BaseModel):
    total_occurrences: int
    total_notes: int
    thinker_distribution: dict = Field(default_factory=dict)
    folder_distribution: dict = Field(default_factory=dict)
    co_terms: List[str] = Field(default_factory=list)


class TermEvidenceMapResponse(BaseModel):
    term: CriticalTerm
    excerpts: List[TermOccurrenceResponse] = Field(default_factory=list)
    stats: EvidenceStats


class SynthesisRunSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    term_id: UUID
    mode: SynthesisMode
    filter_context: str
    synthesis_text: str
    coverage_rate: Optional[float] = None
    created_at: datetime


class SynthesisRunResponse(BaseModel):
    run: SynthesisRunSummary
    citations: List[SynthesisCitation] = Field(default_factory=list)


class ContradictionSignal(BaseModel):
    summary: str
    evidence_a: str
    evidence_b: str


class TermQualityReportResponse(BaseModel):
    coverage_rate: float
    unsupported_claims: List[str] = Field(default_factory=list)
    contradiction_signals: List[ContradictionSignal] = Field(default_factory=list)
    uncertainty_label: Literal["low", "medium", "high"] = "medium"


class ThesisCandidate(BaseModel):
    claim: str
    support: str
    confidence: float
    citation_note_id: UUID


class ThesisCandidateResponse(BaseModel):
    term_id: UUID
    candidates: List[ThesisCandidate] = Field(default_factory=list)


class TermAliasCreate(BaseModel):
    alias_name: str

    @field_validator("alias_name")
    @classmethod
    def validate_alias_name(cls, value: str) -> str:
        normalized = value.strip().lower()
        if not normalized:
            raise ValueError("Alias name cannot be empty")
        return normalized


class TermAliasResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    term_id: UUID
    alias_name: str
    status: str
    created_at: datetime
