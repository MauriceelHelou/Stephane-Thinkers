export enum ConnectionType {
  influenced = 'influenced',
  critiqued = 'critiqued',
  built_upon = 'built_upon',
  synthesized = 'synthesized',
}

export enum TimelineEventType {
  council = 'council',
  publication = 'publication',
  war = 'war',
  invention = 'invention',
  cultural = 'cultural',
  political = 'political',
  other = 'other',
}

export interface Timeline {
  id: string
  name: string
  start_year?: number | null
  end_year?: number | null
  description?: string | null
  created_at: string
  updated_at: string
}

export interface TimelineCreate {
  name: string
  start_year?: number | null
  end_year?: number | null
  description?: string | null
}

export interface TimelineUpdate {
  name?: string
  start_year?: number | null
  end_year?: number | null
  description?: string | null
}

export interface Thinker {
  id: string
  name: string
  birth_year?: number | null
  death_year?: number | null
  active_period?: string | null
  field?: string | null
  biography_notes?: string | null
  position_x?: number | null
  position_y?: number | null
  anchor_year?: number | null  // Year the thinker is pinned to on timeline
  is_manually_positioned?: boolean  // True if user manually dragged this thinker
  timeline_id?: string | null
  created_at: string
  updated_at: string
}

export interface ThinkerWithRelations extends Thinker {
  publications: Publication[]
  quotes: Quote[]
  tags: Tag[]
}

export interface ThinkerCreate {
  name: string
  birth_year?: number | null
  death_year?: number | null
  active_period?: string | null
  field?: string | null
  biography_notes?: string | null
  position_x?: number | null
  position_y?: number | null
  anchor_year?: number | null  // Year the thinker is pinned to on timeline
  is_manually_positioned?: boolean  // True if user manually dragged this thinker
  timeline_id?: string | null
}

export interface ThinkerUpdate {
  name?: string
  birth_year?: number | null
  death_year?: number | null
  active_period?: string | null
  field?: string | null
  biography_notes?: string | null
  position_x?: number | null
  position_y?: number | null
  anchor_year?: number | null  // Year the thinker is pinned to on timeline
  is_manually_positioned?: boolean  // True if user manually dragged this thinker
  timeline_id?: string | null
  tag_ids?: string[]
}

export type PublicationType = 'book' | 'article' | 'chapter' | 'thesis' | 'conference' | 'report' | 'other'

export interface Publication {
  id: string
  thinker_id: string
  title: string
  year?: number | null
  citation?: string | null
  notes?: string | null
  // Structured citation fields
  publication_type?: PublicationType | null
  authors_text?: string | null
  journal?: string | null
  publisher?: string | null
  volume?: string | null
  issue?: string | null
  pages?: string | null
  doi?: string | null
  isbn?: string | null
  url?: string | null
  abstract?: string | null
  book_title?: string | null
  editors?: string | null
  created_at: string
  updated_at?: string | null
}

export interface PublicationCreate {
  thinker_id: string
  title: string
  year?: number | null
  citation?: string | null
  notes?: string | null
  publication_type?: PublicationType | null
  authors_text?: string | null
  journal?: string | null
  publisher?: string | null
  volume?: string | null
  issue?: string | null
  pages?: string | null
  doi?: string | null
  isbn?: string | null
  url?: string | null
  abstract?: string | null
  book_title?: string | null
  editors?: string | null
}

export interface PublicationUpdate {
  title?: string
  year?: number | null
  citation?: string | null
  notes?: string | null
  publication_type?: PublicationType | null
  authors_text?: string | null
  journal?: string | null
  publisher?: string | null
  volume?: string | null
  issue?: string | null
  pages?: string | null
  doi?: string | null
  isbn?: string | null
  url?: string | null
  abstract?: string | null
  book_title?: string | null
  editors?: string | null
}

export interface PublicationCitations {
  chicago: string
  mla: string
  apa: string
}

export interface Quote {
  id: string
  thinker_id: string
  text: string
  source?: string | null
  year?: number | null
  context_notes?: string | null
  created_at: string
}

export interface QuoteCreate {
  thinker_id: string
  text: string
  source?: string | null
  year?: number | null
  context_notes?: string | null
}

export interface QuoteUpdate {
  text?: string
  source?: string | null
  year?: number | null
  context_notes?: string | null
}

export interface Tag {
  id: string
  name: string
  color?: string | null
  created_at: string
}

export interface TagCreate {
  name: string
  color?: string | null
}

export interface TagUpdate {
  name?: string
  color?: string | null
}

export interface Connection {
  id: string
  from_thinker_id: string
  to_thinker_id: string
  connection_type: ConnectionType
  name?: string | null
  notes?: string | null
  bidirectional: boolean
  strength?: number | null
  created_at: string
  updated_at: string
}

export interface ConnectionCreate {
  from_thinker_id: string
  to_thinker_id: string
  connection_type: ConnectionType
  name?: string | null
  notes?: string | null
  bidirectional?: boolean
  strength?: number | null
}

export interface ConnectionUpdate {
  connection_type?: ConnectionType
  name?: string | null
  notes?: string | null
  bidirectional?: boolean
  strength?: number | null
}

export interface TimelineEvent {
  id: string
  timeline_id: string
  name: string
  year: number
  event_type: string
  description?: string | null
  created_at: string
  updated_at: string
}

export interface TimelineEventCreate {
  timeline_id: string
  name: string
  year: number
  event_type: string
  description?: string | null
}

export interface TimelineEventUpdate {
  timeline_id?: string
  name?: string
  year?: number
  event_type?: string
  description?: string | null
}

export interface CombinedViewMember {
  id: string
  view_id: string
  timeline_id: string
  display_order: number
  y_offset: number
  created_at: string
  timeline: Timeline
}

export interface CombinedTimelineView {
  id: string
  name: string
  description?: string | null
  created_at: string
  updated_at: string
  members: CombinedViewMember[]
}

export interface CombinedTimelineViewSimple {
  id: string
  name: string
  description?: string | null
  created_at: string
  updated_at: string
}

export interface CombinedTimelineViewCreate {
  name: string
  description?: string | null
  timeline_ids: string[]
}

export interface CombinedTimelineViewUpdate {
  name?: string
  description?: string | null
  timeline_ids?: string[]
}

// Institution types for academic affiliation tracking

export interface Institution {
  id: string
  name: string
  city?: string | null
  country?: string | null
  latitude?: number | null
  longitude?: number | null
  founded_year?: number | null
  notes?: string | null
  created_at: string
  updated_at: string
}

export interface InstitutionCreate {
  name: string
  city?: string | null
  country?: string | null
  latitude?: number | null
  longitude?: number | null
  founded_year?: number | null
  notes?: string | null
}

export interface InstitutionUpdate {
  name?: string
  city?: string | null
  country?: string | null
  latitude?: number | null
  longitude?: number | null
  founded_year?: number | null
  notes?: string | null
}

export interface ThinkerInstitution {
  id: string
  thinker_id: string
  institution_id: string
  role?: string | null
  department?: string | null
  start_year?: number | null
  end_year?: number | null
  is_phd_institution: boolean
  phd_advisor_id?: string | null
  notes?: string | null
  created_at: string
  updated_at: string
}

export interface ThinkerInstitutionWithRelations extends ThinkerInstitution {
  institution: Institution
}

export interface ThinkerInstitutionCreate {
  thinker_id: string
  institution_id: string
  role?: string | null
  department?: string | null
  start_year?: number | null
  end_year?: number | null
  is_phd_institution?: boolean
  phd_advisor_id?: string | null
  notes?: string | null
}

export interface ThinkerInstitutionUpdate {
  role?: string | null
  department?: string | null
  start_year?: number | null
  end_year?: number | null
  is_phd_institution?: boolean
  phd_advisor_id?: string | null
  notes?: string | null
}

// Note types for rich note-taking with wiki-style linking

export type NoteType = 'general' | 'research' | 'biography' | 'connection'
export type NoteColor = 'yellow' | 'pink' | 'blue' | 'green'

export interface MentionedThinker {
  id: string
  name: string
}

export type NoteTag = Tag
export type NoteTagCreate = TagCreate
export type NoteTagUpdate = TagUpdate

export interface Note {
  id: string
  thinker_id?: string | null
  folder_id?: string | null
  tags: Tag[]
  title?: string | null
  content: string
  content_html?: string | null
  note_type?: NoteType | null
  // Canvas sticky note fields
  position_x?: number | null
  position_y?: number | null
  color?: NoteColor | null
  is_canvas_note?: boolean | null
  created_at: string
  updated_at: string
}

export interface NoteWithMentions extends Note {
  mentioned_thinkers: MentionedThinker[]
}

export interface NoteCreate {
  thinker_id?: string | null
  folder_id?: string | null
  tag_ids?: string[]
  title?: string | null
  content: string
  content_html?: string | null
  note_type?: NoteType | null
  // Canvas sticky note fields
  position_x?: number | null
  position_y?: number | null
  color?: NoteColor | null
  is_canvas_note?: boolean | null
}

export interface NoteUpdate {
  title?: string | null
  content?: string
  content_html?: string | null
  note_type?: NoteType | null
  folder_id?: string | null
  tag_ids?: string[]
  // Canvas sticky note fields
  position_x?: number | null
  position_y?: number | null
  color?: NoteColor | null
  is_canvas_note?: boolean | null
}

export interface NoteVersion {
  id: string
  note_id: string
  content: string
  version_number: number
  created_at: string
}

// Folder types for hierarchical note organization

export interface Folder {
  id: string
  name: string
  parent_id?: string | null
  sort_order?: number | null
  color?: string | null
  is_archived?: boolean
  archived_at?: string | null
  created_at: string
  updated_at: string
}

export interface FolderWithChildren extends Folder {
  children: FolderWithChildren[]
  note_count: number
}

export interface FolderCreate {
  name: string
  parent_id?: string | null
  sort_order?: number | null
  color?: string | null
}

export interface FolderUpdate {
  name?: string
  parent_id?: string | null
  sort_order?: number | null
  color?: string | null
}

export interface ReorderItem {
  id: string
  sort_order: number
  parent_id?: string | null
}

// Thinker auto-detection types

export interface DetectedThinker {
  id: string
  name: string
  birth_year?: number | null
  death_year?: number | null
  field?: string | null
  mention_count: number
  paragraph_indices: number[]
}

export interface ThinkerDetectionResult {
  known_thinkers: DetectedThinker[]
  unknown_names: string[]
  total_mentions: number
}

export interface YearAnnotationResult {
  content_modified: boolean
  updated_content?: string | null
  updated_content_html?: string | null
}

// Critical terms and definition types

export interface CriticalTerm {
  id: string
  name: string
  description?: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface CriticalTermWithCount extends CriticalTerm {
  occurrence_count: number
}

export interface CriticalTermCreate {
  name: string
  description?: string | null
  is_active?: boolean
}

export interface CriticalTermUpdate {
  name?: string
  description?: string | null
  is_active?: boolean
}

export interface TermOccurrence {
  id: string
  term_id?: string | null
  note_id: string
  context_snippet: string
  paragraph_index?: number | null
  char_offset?: number | null
  created_at: string
  note_title?: string | null
  folder_name?: string | null
  thinker_names: string[]
  note_folder_name?: string | null
  note_folder_id?: string | null
  associated_thinkers?: { id: string; name: string }[] | null
}

export interface ScanResult {
  term_id: string
  term_name: string
  occurrence_count: number
  message: string
}

export interface ExcerptGroup {
  group_name: string
  group_id?: string | null
  excerpts: TermOccurrence[]
  excerpt_count: number
}

export interface SynthesisCitation {
  citation_key: string
  note_id: string
  note_title: string
  folder_name?: string | null
  context_snippet: string
}

export interface TermDefinition {
  term: CriticalTerm
  excerpts_by_thinker: ExcerptGroup[]
  excerpts_by_folder: ExcerptGroup[]
  total_occurrences: number
  synthesis?: string | null
  synthesis_citations: SynthesisCitation[]
  filter_context: string
  available_folders: { id: string; name: string }[]
  available_thinkers: { id: string; name: string }[]
}

export interface TermDefinitionFilters {
  folder_id?: string
  thinker_id?: string
  synthesize?: boolean
}

export type SynthesisMode = 'definition' | 'comparative' | 'critical'

export interface EvidenceStats {
  total_occurrences: number
  total_notes: number
  thinker_distribution: Record<string, number>
  folder_distribution: Record<string, number>
  co_terms: string[]
}

export interface TermEvidenceMap {
  term: CriticalTerm
  excerpts: TermOccurrence[]
  stats: EvidenceStats
}

export interface SynthesisRunSummary {
  id: string
  term_id: string
  mode: SynthesisMode
  filter_context: string
  synthesis_text: string
  coverage_rate?: number | null
  created_at: string
}

export interface SynthesisRun {
  run: SynthesisRunSummary
  citations: SynthesisCitation[]
}

export interface ContradictionSignal {
  summary: string
  evidence_a: string
  evidence_b: string
}

export interface TermQualityReport {
  coverage_rate: number
  unsupported_claims: string[]
  contradiction_signals: ContradictionSignal[]
  uncertainty_label: 'low' | 'medium' | 'high'
}

export interface ThesisCandidate {
  claim: string
  support: string
  confidence: number
  citation_note_id: string
}

export interface ThesisCandidateResponse {
  term_id: string
  candidates: ThesisCandidate[]
}

export interface TermAlias {
  id: string
  term_id: string
  alias_name: string
  status: string
  created_at: string
}

// Constellation / analysis types

export interface TermThinkerBubble {
  term_id: string
  term_name: string
  thinker_id: string
  thinker_name: string
  thinker_birth_year?: number | null
  thinker_death_year?: number | null
  frequency: number
  sample_snippets: string[]
}

export interface TermThinkerMatrix {
  bubbles: TermThinkerBubble[]
  terms: string[]
  thinkers: string[]
  total_bubbles: number
  max_frequency: number
}

// Co-occurrence and connection suggestion types

export interface CoOccurrencePair {
  thinker_a_id: string
  thinker_a_name: string
  thinker_a_birth_year?: number | null
  thinker_a_death_year?: number | null
  thinker_b_id: string
  thinker_b_name: string
  thinker_b_birth_year?: number | null
  thinker_b_death_year?: number | null
  co_occurrence_count: number
  same_paragraph_count: number
  has_existing_connection: boolean
  existing_connection_type?: string | null
}

export interface ConnectionSuggestionFromNotes {
  thinker_a_id: string
  thinker_a_name: string
  thinker_a_birth_year?: number | null
  thinker_a_death_year?: number | null
  thinker_b_id: string
  thinker_b_name: string
  thinker_b_birth_year?: number | null
  thinker_b_death_year?: number | null
  co_occurrence_count: number
  same_paragraph_count: number
  sample_note_titles: string[]
  sample_excerpts: string[]
  confidence: 'high' | 'medium' | 'low'
}

export interface ArgumentNode {
  id: string
  node_type: 'claim' | 'evidence' | 'counterclaim'
  label: string
  confidence: number
}

export interface ArgumentEdge {
  id: string
  from_node_id: string
  to_node_id: string
  edge_type: string
  weight: number
}

export interface PremiseGap {
  message: string
  severity: 'low' | 'medium' | 'high'
}

export interface ArgumentMap {
  map_id: string
  title: string
  nodes: ArgumentNode[]
  edges: ArgumentEdge[]
  premise_gaps: PremiseGap[]
}

export interface SemanticSearchResult {
  note_id: string
  note_title: string
  excerpt: string
  score: number
}

export interface RelatedExcerpt {
  occurrence_id: string
  note_id: string
  note_title: string
  context_snippet: string
  similarity: number
}

export interface ConnectionExplanation {
  thinker_a_id: string
  thinker_b_id: string
  evidence_count: number
  confidence: 'high' | 'medium' | 'low'
  rationale: string
  sample_excerpts: string[]
}

export interface PlanTask {
  title: string
  rationale: string
  evidence_refs: string[]
}

export interface ResearchSprintPlan {
  focus: string
  tasks: PlanTask[]
}

export interface AdvisorBrief {
  date_window: string
  highlights: string[]
  decisions_needed: string[]
  open_risks: string[]
}

export interface VivaQuestion {
  question: string
  expected_answer_rubric: string
  evidence_refs: string[]
}

export interface VivaPractice {
  topic: string
  questions: VivaQuestion[]
}

export interface WeeklyDigest {
  id: string
  period_start: string
  period_end: string
  digest_markdown: string
}

export interface AIUsage {
  day: string
  used_tokens: number
  daily_quota_tokens: number
  cost_controls_enabled: boolean
}

export interface DraftFromExcerptsRequest {
  excerpt_ids: string[]
  tone?: string
  max_length?: number
}

export interface DraftFromExcerptsResponse {
  draft: string
  citations: string[]
}

export interface IngestionRequest {
  file_name: string
  content: string
}

export interface IngestionResponse {
  job_id: string
  status: string
  artifact_count: number
}

export interface JobStatus {
  job_id: string
  job_type: string
  status: string
  result_json?: string | null
  error_message?: string | null
}

export type TimelineBootstrapEntityType = 'thinkers' | 'events' | 'connections' | 'publications' | 'quotes'

export interface TimelinePreviewRequest {
  file_name: string
  content: string
  timeline_name_hint?: string | null
  start_year_hint?: number | null
  end_year_hint?: number | null
}

export interface TimelinePreviewResponse {
  job_id: string
  session_id: string
  status: string
  execution_mode: 'queued' | 'inline_dev' | 'inline_fallback'
}

export interface TimelineBootstrapSession {
  session_id: string
  ingestion_job_id: string
  status: string
  timeline_name_suggested?: string | null
  summary_markdown?: string | null
  candidate_counts: Record<TimelineBootstrapEntityType, number>
  warnings: string[]
  partial: boolean
  telemetry: Record<string, unknown>
  error_message?: string | null
  committed_timeline_id?: string | null
  created_at: string
  updated_at: string
}

export interface TimelineBootstrapEvidence {
  source_artifact_id?: string | null
  chunk_index: number
  char_start: number
  char_end: number
  excerpt: string
}

export interface TimelineBootstrapCandidateItem {
  candidate_id: string
  entity_type: TimelineBootstrapEntityType
  confidence: number
  include: boolean
  fields: Record<string, unknown>
  dependency_keys: string[]
  evidence: TimelineBootstrapEvidence[]
  match_status?: string | null
  matched_thinker_id?: string | null
  match_score?: number | null
  match_reasons: string[]
  metadata_delta: Record<string, unknown>
  sort_key?: number | null
}

export interface TimelineBootstrapCandidatesResponse {
  items: TimelineBootstrapCandidateItem[]
  next_cursor?: string | null
  has_more: boolean
  total: number
}

export interface TimelineValidationEdits {
  name?: string
  description?: string
  start_year?: number | null
  end_year?: number | null
}

export interface TimelineBootstrapCandidateValidationUpdate {
  entity_type: TimelineBootstrapEntityType
  candidate_id: string
  include?: boolean
  fields?: Record<string, unknown>
  match_action?: 'reuse' | 'create'
  matched_thinker_id?: string
}

export interface TimelineBootstrapValidationRequest {
  timeline?: TimelineValidationEdits
  candidates: TimelineBootstrapCandidateValidationUpdate[]
}

export interface ValidationDiagnostic {
  code: string
  message: string
  severity: string
  entity_type?: string | null
  candidate_id?: string | null
}

export interface TimelineBootstrapDiagnostics {
  blocking: ValidationDiagnostic[]
  non_blocking: ValidationDiagnostic[]
  has_blocking: boolean
}

export interface TimelineBootstrapValidationResponse {
  validation_json: {
    timeline: Record<string, unknown>
    candidates: Record<string, unknown>
  }
  diagnostics: TimelineBootstrapDiagnostics
}

export interface TimelineBootstrapCommitRequest {
  commit_message?: string
  force_skip_invalid?: boolean
}

export interface TimelineBootstrapCommitResponse {
  timeline_id: string
  audit_id: string
  created_counts: Record<string, number>
  skipped_counts: Record<string, number>
  warnings: string[]
}

export interface TimelineBootstrapAuditResponse {
  audit_id: string
  session_id: string
  created_counts: Record<string, number>
  skipped_counts: Record<string, number>
  warnings: string[]
  id_mappings: Record<string, string>
  committed_by?: string | null
  created_at: string
}

// Research Question types for tracking intellectual investigations

export type QuestionStatus = 'open' | 'in_progress' | 'answered' | 'abandoned'
export type QuestionCategory = 'influence' | 'periodization' | 'methodology' | 'biography' | 'other'

export interface RelatedThinker {
  id: string
  name: string
}

export interface ResearchQuestion {
  id: string
  title: string
  description?: string | null
  status?: QuestionStatus | null
  priority?: number | null
  category?: QuestionCategory | null
  tags_text?: string | null
  hypothesis?: string | null
  evidence_for?: string | null
  evidence_against?: string | null
  conclusion?: string | null
  parent_question_id?: string | null
  created_at: string
  updated_at: string
}

export interface ResearchQuestionWithRelations extends ResearchQuestion {
  related_thinkers: RelatedThinker[]
  sub_questions: ResearchQuestion[]
}

export interface ResearchQuestionCreate {
  title: string
  description?: string | null
  status?: QuestionStatus | null
  priority?: number | null
  category?: QuestionCategory | null
  tags_text?: string | null
  hypothesis?: string | null
  evidence_for?: string | null
  evidence_against?: string | null
  conclusion?: string | null
  parent_question_id?: string | null
  related_thinker_ids?: string[] | null
}

export interface ResearchQuestionUpdate {
  title?: string
  description?: string | null
  status?: QuestionStatus | null
  priority?: number | null
  category?: QuestionCategory | null
  tags_text?: string | null
  hypothesis?: string | null
  evidence_for?: string | null
  evidence_against?: string | null
  conclusion?: string | null
  parent_question_id?: string | null
  related_thinker_ids?: string[] | null
}

export interface ResearchQuestionStats {
  total: number
  by_status: {
    open: number
    in_progress: number
    answered: number
    abandoned: number
  }
  high_priority: number
  medium_priority: number
}

// ============ Quiz Types ============

export type QuizQuestionCategory =
  | 'birth_year'
  | 'death_year'
  | 'quote'
  | 'quote_completion'
  | 'publication'
  | 'connection'
  | 'field'
  | 'biography'

export type QuizQuestionType = 'multiple_choice' | 'short_answer'

export type QuizDifficulty = 'easy' | 'medium' | 'hard' | 'adaptive'

export interface QuizQuestion {
  question_id: string
  question_text: string
  question_type: QuizQuestionType
  category: QuizQuestionCategory
  options?: string[]
  correct_answer: string
  difficulty: QuizDifficulty
  related_thinker_ids: string[]
  explanation: string
  from_pool?: boolean
  times_asked?: number
  accuracy_rate?: number
}

export interface QuizConfig {
  timeline_id?: string | null
  question_categories: QuizQuestionCategory[]
  difficulty: QuizDifficulty
  question_count: number
  multiple_choice_ratio: number
  timer_enabled: boolean
  timer_seconds?: number
  use_spaced_repetition: boolean
}

export interface QuizSession {
  id: string
  timeline_id?: string | null
  difficulty: QuizDifficulty
  question_count: number
  question_categories?: QuizQuestionCategory[]
  score: number
  completed: boolean
  time_spent_seconds?: number
  current_question_index: number
  created_at: string
  completed_at?: string | null
}

export interface QuizSessionWithQuestions extends QuizSession {
  questions: QuizQuestion[]
}

export interface QuizAnswer {
  question_id: string
  user_answer: string
  is_correct: boolean
  time_taken_seconds?: number
  answered_at: string
}

export interface AnswerValidation {
  correct: boolean
  explanation: string
  correct_answer: string
  additional_context?: string
  next_difficulty?: QuizDifficulty
  next_review_at?: string
}

export interface QuestionGenerationParams {
  timeline_id?: string | null
  question_categories: QuizQuestionCategory[]
  difficulty: QuizDifficulty
  question_type: 'multiple_choice' | 'short_answer' | 'auto'
  exclude_question_ids: string[]
  use_spaced_repetition: boolean
}

export interface QuizGenerationParams {
  timeline_id?: string | null
  question_categories: QuizQuestionCategory[]
  difficulty: QuizDifficulty
  question_count: number
  multiple_choice_ratio: number
  force_fresh?: boolean // If true, always generate new questions instead of using pool
}

export interface CategoryBreakdown {
  category: QuizQuestionCategory
  total: number
  correct: number
  accuracy: number
}

export interface DifficultyProgression {
  question_index: number
  difficulty: QuizDifficulty
}

export interface StreakData {
  longest_streak: number
  current_streak: number
}

export interface SessionStatistics {
  total_questions: number
  correct_answers: number
  accuracy_percentage: number
  average_time_seconds: number
  category_breakdown: CategoryBreakdown[]
  difficulty_progression: DifficultyProgression[]
  streak_data: StreakData
}

export interface QuizSessionSummary {
  session_id: string
  created_at: string
  completed_at?: string | null
  score: number
  total_questions: number
  accuracy_percentage: number
  difficulty: QuizDifficulty
  timeline_name?: string | null
}

export interface CategoryPerformance {
  category: QuizQuestionCategory
  total_asked: number
  accuracy: number
}

export interface DifficultyDistribution {
  easy: number
  medium: number
  hard: number
}

export interface QuizStatistics {
  total_sessions: number
  total_questions_answered: number
  overall_accuracy: number
  category_performance: CategoryPerformance[]
  difficulty_distribution: DifficultyDistribution
  review_queue_size: number
  average_session_score: number
  improvement_trend: number
}
