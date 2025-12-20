import axios from 'axios'
import type {
  Timeline,
  TimelineCreate,
  TimelineUpdate,
  TimelineEvent,
  TimelineEventCreate,
  TimelineEventUpdate,
  CombinedTimelineView,
  CombinedTimelineViewSimple,
  CombinedTimelineViewCreate,
  CombinedTimelineViewUpdate,
  Thinker,
  ThinkerWithRelations,
  ThinkerCreate,
  ThinkerUpdate,
  Publication,
  PublicationCreate,
  PublicationUpdate,
  PublicationCitations,
  Quote,
  QuoteCreate,
  QuoteUpdate,
  Tag,
  TagCreate,
  TagUpdate,
  Connection,
  ConnectionCreate,
  ConnectionUpdate,
  Institution,
  InstitutionCreate,
  InstitutionUpdate,
  ThinkerInstitution,
  ThinkerInstitutionWithRelations,
  ThinkerInstitutionCreate,
  ThinkerInstitutionUpdate,
  Note,
  NoteWithMentions,
  NoteCreate,
  NoteUpdate,
  NoteVersion,
  ResearchQuestion,
  ResearchQuestionWithRelations,
  ResearchQuestionCreate,
  ResearchQuestionUpdate,
  ResearchQuestionStats,
  // Quiz types
  QuizQuestion,
  QuizSession,
  QuizSessionWithQuestions,
  QuizSessionSummary,
  QuizStatistics,
  AnswerValidation,
  QuestionGenerationParams,
  QuizGenerationParams,
} from '@/types'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001'

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Generic CRUD API factory
function createCrudApi<T, TCreate, TUpdate = Partial<TCreate>>(endpoint: string) {
  return {
    getAll: async (): Promise<T[]> => {
      const response = await api.get(`/api/${endpoint}/`)
      return response.data
    },
    getOne: async (id: string): Promise<T> => {
      const response = await api.get(`/api/${endpoint}/${id}`)
      return response.data
    },
    create: async (data: TCreate): Promise<T> => {
      const response = await api.post(`/api/${endpoint}/`, data)
      return response.data
    },
    update: async (id: string, data: TUpdate): Promise<T> => {
      const response = await api.put(`/api/${endpoint}/${id}`, data)
      return response.data
    },
    delete: async (id: string): Promise<void> => {
      await api.delete(`/api/${endpoint}/${id}`)
    },
  }
}

// Repopulate types
export interface RepopulateConfig {
  repulsion_strength?: number
  attraction_strength?: number
  center_gravity?: number
  field_attraction?: number
  damping?: number
  max_iterations?: number
  convergence_threshold?: number
  min_node_distance?: number
  vertical_spread?: number
}

export interface RepopulatePosition {
  id: string
  name: string
  anchor_year: number | null
  position_y: number | null
}

export interface RepopulateResponse {
  updated_count: number
  positions: RepopulatePosition[]
}

// Timelines API
const timelinesBase = createCrudApi<Timeline, TimelineCreate, TimelineUpdate>('timelines')
export const timelinesApi = {
  ...timelinesBase,
  repopulate: async (timelineId: string, config?: RepopulateConfig): Promise<RepopulateResponse> => {
    const response = await api.post(`/api/timelines/${timelineId}/repopulate`, config || {})
    return response.data
  },
  repopulateAll: async (config?: RepopulateConfig): Promise<RepopulateResponse> => {
    const response = await api.post('/api/timelines/repopulate-all', config || {})
    return response.data
  },
}

// Timeline Events API (with timeline_id filter support)
const timelineEventsBase = createCrudApi<TimelineEvent, TimelineEventCreate, TimelineEventUpdate>('timeline-events')
export const timelineEventsApi = {
  ...timelineEventsBase,
  getAll: async (timelineId?: string): Promise<TimelineEvent[]> => {
    const params = timelineId ? { timeline_id: timelineId } : {}
    const response = await api.get('/api/timeline-events/', { params })
    return response.data
  },
}

// Thinkers API (getOne returns ThinkerWithRelations, getAll supports timeline filter)
// BUG #8 FIX: Add timeline_id filter support to frontend API
const thinkersBase = createCrudApi<Thinker, ThinkerCreate, ThinkerUpdate>('thinkers')
export const thinkersApi = {
  ...thinkersBase,
  getAll: async (timelineId?: string): Promise<Thinker[]> => {
    const params = timelineId ? { timeline_id: timelineId } : {}
    const response = await api.get('/api/thinkers/', { params })
    return response.data
  },
  getOne: async (id: string): Promise<ThinkerWithRelations> => {
    const response = await api.get(`/api/thinkers/${id}`)
    return response.data
  },
}

// Connections API
export const connectionsApi = createCrudApi<Connection, ConnectionCreate, ConnectionUpdate>('connections')

// Publications API (with thinker_id filter support and citation formatting)
const publicationsBase = createCrudApi<Publication, PublicationCreate, PublicationUpdate>('publications')
export const publicationsApi = {
  ...publicationsBase,
  getAll: async (thinkerId?: string): Promise<Publication[]> => {
    const params = thinkerId ? { thinker_id: thinkerId } : {}
    const response = await api.get('/api/publications/', { params })
    return response.data
  },
  getCitations: async (publicationId: string): Promise<PublicationCitations> => {
    const response = await api.get(`/api/publications/${publicationId}/citations`)
    return response.data
  },
}

// Quotes API (with thinker_id filter support)
const quotesBase = createCrudApi<Quote, QuoteCreate, QuoteUpdate>('quotes')
export const quotesApi = {
  ...quotesBase,
  getAll: async (thinkerId?: string): Promise<Quote[]> => {
    const params = thinkerId ? { thinker_id: thinkerId } : {}
    const response = await api.get('/api/quotes/', { params })
    return response.data
  },
}

// Tags API
export const tagsApi = createCrudApi<Tag, TagCreate, TagUpdate>('tags')

// Combined Views API (with custom getEvents)
const combinedViewsBase = createCrudApi<CombinedTimelineView, CombinedTimelineViewCreate, CombinedTimelineViewUpdate>('combined-views')
export const combinedViewsApi = {
  ...combinedViewsBase,
  getAll: async (): Promise<CombinedTimelineViewSimple[]> => {
    const response = await api.get('/api/combined-views/')
    return response.data
  },
  getEvents: async (id: string): Promise<TimelineEvent[]> => {
    const response = await api.get(`/api/combined-views/${id}/events`)
    return response.data
  },
}

// Institutions API (with country filter support)
const institutionsBase = createCrudApi<Institution, InstitutionCreate, InstitutionUpdate>('institutions')
export const institutionsApi = {
  ...institutionsBase,
  getAll: async (country?: string): Promise<Institution[]> => {
    const params = country ? { country } : {}
    const response = await api.get('/api/institutions/', { params })
    return response.data
  },
}

// Thinker Institutions (Affiliations) API
export const thinkerInstitutionsApi = {
  getAll: async (thinkerId?: string, institutionId?: string): Promise<ThinkerInstitutionWithRelations[]> => {
    const params: Record<string, string> = {}
    if (thinkerId) params.thinker_id = thinkerId
    if (institutionId) params.institution_id = institutionId
    const response = await api.get('/api/institutions/affiliations', { params })
    return response.data
  },
  getOne: async (id: string): Promise<ThinkerInstitutionWithRelations> => {
    const response = await api.get(`/api/institutions/affiliations/${id}`)
    return response.data
  },
  create: async (data: ThinkerInstitutionCreate): Promise<ThinkerInstitution> => {
    const response = await api.post('/api/institutions/affiliations', data)
    return response.data
  },
  update: async (id: string, data: ThinkerInstitutionUpdate): Promise<ThinkerInstitution> => {
    const response = await api.put(`/api/institutions/affiliations/${id}`, data)
    return response.data
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(`/api/institutions/affiliations/${id}`)
  },
  getAcademicLineage: async (thinkerId: string): Promise<ThinkerInstitutionWithRelations[]> => {
    const response = await api.get(`/api/institutions/academic-lineage/${thinkerId}`)
    return response.data
  },
}

// Notes API (with wiki-style linking and backlinks)
export const notesApi = {
  getAll: async (thinkerId?: string, noteType?: string): Promise<Note[]> => {
    const params: Record<string, string> = {}
    if (thinkerId) params.thinker_id = thinkerId
    if (noteType) params.note_type = noteType
    const response = await api.get('/api/notes/', { params })
    return response.data
  },
  getOne: async (id: string): Promise<NoteWithMentions> => {
    const response = await api.get(`/api/notes/${id}`)
    return response.data
  },
  create: async (data: NoteCreate): Promise<NoteWithMentions> => {
    const response = await api.post('/api/notes/', data)
    return response.data
  },
  update: async (id: string, data: NoteUpdate): Promise<NoteWithMentions> => {
    const response = await api.put(`/api/notes/${id}`, data)
    return response.data
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(`/api/notes/${id}`)
  },
  getVersions: async (noteId: string): Promise<NoteVersion[]> => {
    const response = await api.get(`/api/notes/${noteId}/versions`)
    return response.data
  },
  getBacklinks: async (thinkerId: string): Promise<Note[]> => {
    const response = await api.get(`/api/notes/backlinks/${thinkerId}`)
    return response.data
  },
  getCanvasNotes: async (): Promise<Note[]> => {
    const response = await api.get('/api/notes/', { params: { is_canvas_note: true } })
    return response.data
  },
}

// Research Questions API
export const researchQuestionsApi = {
  getAll: async (filters?: {
    status?: string
    category?: string
    priority?: number
    thinker_id?: string
  }): Promise<ResearchQuestion[]> => {
    const response = await api.get('/api/research-questions/', { params: filters })
    return response.data
  },
  getOne: async (id: string): Promise<ResearchQuestionWithRelations> => {
    const response = await api.get(`/api/research-questions/${id}`)
    return response.data
  },
  create: async (data: ResearchQuestionCreate): Promise<ResearchQuestionWithRelations> => {
    const response = await api.post('/api/research-questions/', data)
    return response.data
  },
  update: async (id: string, data: ResearchQuestionUpdate): Promise<ResearchQuestionWithRelations> => {
    const response = await api.put(`/api/research-questions/${id}`, data)
    return response.data
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(`/api/research-questions/${id}`)
  },
  getStats: async (): Promise<ResearchQuestionStats> => {
    const response = await api.get('/api/research-questions/stats/summary')
    return response.data
  },
}

// AI Types
export interface AIStatus {
  enabled: boolean
  message: string
}

export interface ConnectionSuggestion {
  from_thinker_id: string
  from_thinker_name: string
  to_thinker_id: string
  to_thinker_name: string
  connection_type: string
  confidence: number
  reasoning: string
}

export interface ThinkerInsight {
  summary: string
  key_contributions: string[]
  intellectual_context: string
  related_concepts: string[]
}

export interface ResearchSuggestion {
  question: string
  category: string
  rationale: string
  related_thinkers: string[]
}

export interface ConnectionValidation {
  is_plausible: boolean
  confidence: number
  feedback: string
  suggested_type: string | null
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatCitation {
  type: string
  id: string
  name: string
}

export interface ChatResponseData {
  answer: string
  citations: ChatCitation[]
  follow_up_questions: string[]
}

export interface SummaryResponseData {
  summary: string
  key_points: string[]
  key_figures: string[]
  themes: string[]
  length: string
}

export interface ParsedEntryData {
  entity_type: string
  data: Record<string, unknown>
  confidence: number
  needs_clarification: string[]
}

// AI API
export const aiApi = {
  getStatus: async (): Promise<AIStatus> => {
    const response = await api.get('/api/ai/status')
    return response.data
  },
  suggestConnections: async (limit: number = 5, timelineId?: string): Promise<ConnectionSuggestion[]> => {
    const params: Record<string, unknown> = { limit }
    if (timelineId) params.timeline_id = timelineId
    const response = await api.get('/api/ai/suggest-connections', { params })
    return response.data
  },
  getThinkerInsight: async (thinkerId: string): Promise<ThinkerInsight> => {
    const response = await api.get(`/api/ai/thinker-insight/${thinkerId}`)
    return response.data
  },
  suggestResearch: async (limit: number = 3, thinkerId?: string): Promise<ResearchSuggestion[]> => {
    const params: Record<string, unknown> = { limit }
    if (thinkerId) params.thinker_id = thinkerId
    const response = await api.get('/api/ai/suggest-research', { params })
    return response.data
  },
  validateConnection: async (
    fromThinkerId: string,
    toThinkerId: string,
    connectionType: string,
    notes?: string
  ): Promise<ConnectionValidation> => {
    const response = await api.post('/api/ai/validate-connection', {
      from_thinker_id: fromThinkerId,
      to_thinker_id: toThinkerId,
      connection_type: connectionType,
      notes,
    })
    return response.data
  },
  chat: async (question: string, conversationHistory?: ChatMessage[]): Promise<ChatResponseData> => {
    const response = await api.post('/api/ai/chat', {
      question,
      conversation_history: conversationHistory,
    })
    return response.data
  },
  generateSummary: async (
    summaryType: string,
    targetId?: string,
    targetName?: string,
    length: string = 'medium'
  ): Promise<SummaryResponseData> => {
    const response = await api.post('/api/ai/summary', {
      summary_type: summaryType,
      target_id: targetId,
      target_name: targetName,
      length,
    })
    return response.data
  },
  parseNaturalLanguage: async (text: string): Promise<ParsedEntryData> => {
    const response = await api.post('/api/ai/parse', { text })
    return response.data
  },
}

// Quiz API
export const quizApi = {
  generateQuestion: async (params: QuestionGenerationParams): Promise<QuizQuestion> => {
    const response = await api.post('/api/quiz/generate-question', params)
    return response.data
  },

  generateQuiz: async (params: QuizGenerationParams): Promise<QuizSessionWithQuestions> => {
    const response = await api.post('/api/quiz/generate-quiz', params)
    return response.data
  },

  validateAnswer: async (
    questionId: string,
    userAnswer: string,
    sessionId: string,
    timeTakenSeconds?: number
  ): Promise<AnswerValidation> => {
    const response = await api.post('/api/quiz/validate-answer', {
      question_id: questionId,
      user_answer: userAnswer,
      session_id: sessionId,
      time_taken_seconds: timeTakenSeconds,
    })
    return response.data
  },

  getSession: async (sessionId: string): Promise<QuizSession> => {
    const response = await api.get(`/api/quiz/session/${sessionId}`)
    return response.data
  },

  getHistory: async (
    limit?: number,
    offset?: number,
    timelineId?: string
  ): Promise<QuizSessionSummary[]> => {
    const params: Record<string, unknown> = {}
    if (limit !== undefined) params.limit = limit
    if (offset !== undefined) params.offset = offset
    if (timelineId) params.timeline_id = timelineId
    const response = await api.get('/api/quiz/history', { params })
    return response.data
  },

  getStatistics: async (): Promise<QuizStatistics> => {
    const response = await api.get('/api/quiz/statistics')
    return response.data
  },

  getReviewQueue: async (limit?: number): Promise<QuizQuestion[]> => {
    const params: Record<string, unknown> = {}
    if (limit !== undefined) params.limit = limit
    const response = await api.get('/api/quiz/review-queue', { params })
    return response.data
  },

  resetQuestion: async (questionId: string): Promise<void> => {
    await api.post(`/api/quiz/reset-question/${questionId}`)
  },

  completeSession: async (sessionId: string, timeSpentSeconds?: number): Promise<void> => {
    const params: Record<string, unknown> = {}
    if (timeSpentSeconds !== undefined) params.time_spent_seconds = timeSpentSeconds
    await api.post(`/api/quiz/complete-session/${sessionId}`, null, { params })
  },
}

// Auth API
export interface LoginResponse {
  success: boolean
  message: string
}

export const authApi = {
  login: async (password: string): Promise<LoginResponse> => {
    const response = await api.post('/api/auth/login', { password })
    return response.data
  },
  checkAuth: async (): Promise<{ auth_required: boolean }> => {
    const response = await api.get('/api/auth/check')
    return response.data
  },
}
