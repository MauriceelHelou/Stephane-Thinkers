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

export interface Note {
  id: string
  thinker_id?: string | null
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
  title?: string | null
  content: string
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
  note_type?: NoteType | null
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
