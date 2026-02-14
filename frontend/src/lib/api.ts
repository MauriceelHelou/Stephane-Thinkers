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
  Folder,
  FolderWithChildren,
  FolderCreate,
  FolderUpdate,
  ReorderItem,
  ThinkerDetectionResult,
  YearAnnotationResult,
  CriticalTermWithCount,
  CriticalTermCreate,
  CriticalTermUpdate,
  TermOccurrence,
  ScanResult,
  SynthesisMode,
  TermEvidenceMap,
  SynthesisRun,
  SynthesisRunSummary,
  TermQualityReport,
  ThesisCandidateResponse,
  TermAlias,
  TermDefinition,
  TermDefinitionFilters,
  TermThinkerMatrix,
  CoOccurrencePair,
  ConnectionSuggestionFromNotes,
  ArgumentMap,
  PremiseGap,
  SemanticSearchResult,
  RelatedExcerpt,
  ConnectionExplanation,
  ResearchSprintPlan,
  AdvisorBrief,
  VivaPractice,
  WeeklyDigest,
  AIUsage,
  DraftFromExcerptsRequest,
  DraftFromExcerptsResponse,
  IngestionRequest,
  IngestionResponse,
  JobStatus,
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

const DEFAULT_API_URL = 'http://localhost:8010'

function resolveApiUrl(rawUrl?: string): string {
  const candidate = rawUrl?.trim()
  if (!candidate) {
    return DEFAULT_API_URL
  }

  try {
    return new URL(candidate).toString().replace(/\/$/, '')
  } catch {
    return DEFAULT_API_URL
  }
}

export const API_URL = resolveApiUrl(process.env.NEXT_PUBLIC_API_URL)

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

const ARRAY_PAYLOAD_KEYS = ['items', 'results', 'data', 'rows'] as const

function coerceArray<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) {
    return payload as T[]
  }

  if (!payload || typeof payload !== 'object') {
    return []
  }

  const record = payload as Record<string, unknown>
  for (const key of ARRAY_PAYLOAD_KEYS) {
    const candidate = record[key]
    if (Array.isArray(candidate)) {
      return candidate as T[]
    }
  }

  if (record.data && typeof record.data === 'object') {
    const nested = record.data as Record<string, unknown>
    for (const key of ['items', 'results', 'rows'] as const) {
      const candidate = nested[key]
      if (Array.isArray(candidate)) {
        return candidate as T[]
      }
    }
  }

  return []
}

// Request interceptor to attach auth token for protected backend routes.
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = sessionStorage.getItem('auth_token')
    if (token) {
      config.headers = config.headers || {}
      ;(config.headers as Record<string, string>)['Authorization'] = `Bearer ${token}`
    }
  }
  return config
})

// Response interceptor to transform API errors into user-friendly Error objects
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status
    const requestUrl = String(error.config?.url || '')
    const isAuthEndpoint = requestUrl.includes('/api/auth/login') || requestUrl.includes('/api/auth/check')

    if (status === 401 && !isAuthEndpoint && typeof window !== 'undefined') {
      sessionStorage.removeItem('auth_token')
      sessionStorage.removeItem('authenticated')
      window.dispatchEvent(new Event('auth:unauthorized'))
    }

    // Extract the error message from the API response
    if (error.response?.data?.detail) {
      // FastAPI returns errors in { detail: "message" } format
      const detail = error.response.data.detail
      // Handle validation errors (array of error objects)
      if (Array.isArray(detail)) {
        const messages = detail.map((e: { msg?: string; message?: string }) => e.msg || e.message || String(e)).join(', ')
        error.message = messages
      } else {
        error.message = String(detail)
      }
    } else if (error.response?.data?.message) {
      error.message = error.response.data.message
    }
    return Promise.reject(error)
  }
)

// Generic CRUD API factory
function createCrudApi<T, TCreate, TUpdate = Partial<TCreate>>(endpoint: string) {
  return {
    getAll: async (): Promise<T[]> => {
      const response = await api.get(`/api/${endpoint}/`)
      return coerceArray<T>(response.data)
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
    return coerceArray<TimelineEvent>(response.data)
  },
}

// Thinkers API (getOne returns ThinkerWithRelations, getAll supports timeline filter)
// BUG #8 FIX: Add timeline_id filter support to frontend API
const thinkersBase = createCrudApi<Thinker, ThinkerCreate, ThinkerUpdate>('thinkers')
export const thinkersApi = {
  ...thinkersBase,
  getAll: async (timelineId?: string): Promise<Thinker[]> => {
    const params: Record<string, string | number> = { limit: 200 }
    if (timelineId) params.timeline_id = timelineId
    const response = await api.get('/api/thinkers/', { params })
    return coerceArray<Thinker>(response.data)
  },
  getOne: async (id: string): Promise<ThinkerWithRelations> => {
    const response = await api.get(`/api/thinkers/${id}`)
    return response.data
  },
}

// Connections API
const connectionsBase = createCrudApi<Connection, ConnectionCreate, ConnectionUpdate>('connections')
export const connectionsApi = {
  ...connectionsBase,
  getAll: async (): Promise<Connection[]> => {
    const response = await api.get('/api/connections/', { params: { limit: 500 } })
    return coerceArray<Connection>(response.data)
  },
}

// Publications API (with thinker_id filter support and citation formatting)
const publicationsBase = createCrudApi<Publication, PublicationCreate, PublicationUpdate>('publications')
export const publicationsApi = {
  ...publicationsBase,
  getAll: async (thinkerId?: string): Promise<Publication[]> => {
    const params = thinkerId ? { thinker_id: thinkerId } : {}
    const response = await api.get('/api/publications/', { params })
    return coerceArray<Publication>(response.data)
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
    return coerceArray<Quote>(response.data)
  },
}

// Tags API
const tagsBase = createCrudApi<Tag, TagCreate, TagUpdate>('tags')
const getAllTags = async (): Promise<Tag[]> => {
  const limit = 200
  const maxPages = 50
  const allTags: Tag[] = []
  let skip = 0

  for (let page = 0; page < maxPages; page += 1) {
    const response = await api.get('/api/tags/', { params: { skip, limit } })
    const pageData = coerceArray<Tag>(response.data)
    allTags.push(...pageData)
    if (pageData.length < limit) {
      break
    }
    skip += limit
  }

  return allTags
}

export const tagsApi = {
  ...tagsBase,
  getAll: getAllTags,
}

// Legacy compatibility alias. Notes and timeline now share one tag pool.
export const noteTagsApi = tagsApi

// Combined Views API (with custom getEvents)
const combinedViewsBase = createCrudApi<CombinedTimelineView, CombinedTimelineViewCreate, CombinedTimelineViewUpdate>('combined-views')
export const combinedViewsApi = {
  ...combinedViewsBase,
  getAll: async (): Promise<CombinedTimelineViewSimple[]> => {
    const response = await api.get('/api/combined-views/')
    return coerceArray<CombinedTimelineViewSimple>(response.data)
  },
  getEvents: async (id: string): Promise<TimelineEvent[]> => {
    const response = await api.get(`/api/combined-views/${id}/events`)
    return coerceArray<TimelineEvent>(response.data)
  },
}

// Institutions API (with country filter support)
const institutionsBase = createCrudApi<Institution, InstitutionCreate, InstitutionUpdate>('institutions')
export const institutionsApi = {
  ...institutionsBase,
  getAll: async (country?: string): Promise<Institution[]> => {
    const params = country ? { country } : {}
    const response = await api.get('/api/institutions/', { params })
    return coerceArray<Institution>(response.data)
  },
}

// Thinker Institutions (Affiliations) API
export const thinkerInstitutionsApi = {
  getAll: async (thinkerId?: string, institutionId?: string): Promise<ThinkerInstitutionWithRelations[]> => {
    const params: Record<string, string> = {}
    if (thinkerId) params.thinker_id = thinkerId
    if (institutionId) params.institution_id = institutionId
    const response = await api.get('/api/institutions/affiliations', { params })
    return coerceArray<ThinkerInstitutionWithRelations>(response.data)
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
    return coerceArray<ThinkerInstitutionWithRelations>(response.data)
  },
}

// Notes API (with wiki-style linking and backlinks)
export const notesApi = {
  getAll: async (
    thinkerId?: string,
    noteType?: string,
    folderId?: string,
    includeArchived?: boolean,
    tagIds?: string[]
  ): Promise<Note[]> => {
    const params: Record<string, string> = {}
    if (thinkerId) params.thinker_id = thinkerId
    if (noteType) params.note_type = noteType
    if (folderId) params.folder_id = folderId
    if (includeArchived) params.include_archived = 'true'
    if (tagIds && tagIds.length > 0) params.tag_ids = tagIds.join(',')
    const response = await api.get('/api/notes/', { params })
    return coerceArray<Note>(response.data)
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
    return coerceArray<NoteVersion>(response.data)
  },
  getBacklinks: async (thinkerId: string): Promise<Note[]> => {
    const response = await api.get(`/api/notes/backlinks/${thinkerId}`)
    return coerceArray<Note>(response.data)
  },
  getCanvasNotes: async (): Promise<Note[]> => {
    const response = await api.get('/api/notes/', { params: { is_canvas_note: true } })
    return coerceArray<Note>(response.data)
  },
  draftFromExcerpts: async (data: DraftFromExcerptsRequest): Promise<DraftFromExcerptsResponse> => {
    const response = await api.post('/api/notes/draft-from-excerpts', data)
    return response.data
  },
}

// Folders API (hierarchical note organization)
export const foldersApi = {
  getAll: async (parentId?: string): Promise<Folder[]> => {
    const params: Record<string, string> = {}
    if (parentId) params.parent_id = parentId
    const response = await api.get('/api/folders/', { params })
    return coerceArray<Folder>(response.data)
  },
  getOne: async (id: string): Promise<FolderWithChildren> => {
    const response = await api.get(`/api/folders/${id}`)
    return response.data
  },
  getTree: async (includeArchived?: boolean): Promise<FolderWithChildren[]> => {
    const params: Record<string, string> = {}
    if (includeArchived) params.include_archived = 'true'
    const response = await api.get('/api/folders/tree', { params })
    return coerceArray<FolderWithChildren>(response.data)
  },
  create: async (data: FolderCreate): Promise<Folder> => {
    const response = await api.post('/api/folders/', data)
    return response.data
  },
  update: async (id: string, data: FolderUpdate): Promise<Folder> => {
    const response = await api.put(`/api/folders/${id}`, data)
    return response.data
  },
  delete: async (id: string, moveNotesTo?: string): Promise<void> => {
    const params: Record<string, string> = {}
    if (moveNotesTo) params.move_notes_to = moveNotesTo
    await api.delete(`/api/folders/${id}`, { params })
  },
  reorder: async (items: ReorderItem[]): Promise<Folder[]> => {
    const response = await api.put('/api/folders/reorder', { items })
    return coerceArray<Folder>(response.data)
  },
  archive: async (id: string): Promise<Folder> => {
    const response = await api.post(`/api/folders/${id}/archive`)
    return response.data
  },
  unarchive: async (id: string): Promise<Folder> => {
    const response = await api.post(`/api/folders/${id}/unarchive`)
    return response.data
  },
}

// Critical Terms API
export const criticalTermsApi = {
  getAll: async (isActive?: boolean): Promise<CriticalTermWithCount[]> => {
    const params: Record<string, unknown> = {}
    if (isActive !== undefined) params.is_active = isActive
    const response = await api.get('/api/critical-terms/', { params })
    return coerceArray<CriticalTermWithCount>(response.data)
  },
  getOne: async (id: string): Promise<CriticalTermWithCount> => {
    const response = await api.get(`/api/critical-terms/${id}`)
    return response.data
  },
  create: async (data: CriticalTermCreate): Promise<CriticalTermWithCount> => {
    const response = await api.post('/api/critical-terms/', data)
    return response.data
  },
  update: async (id: string, data: CriticalTermUpdate): Promise<CriticalTermWithCount> => {
    const response = await api.put(`/api/critical-terms/${id}`, data)
    return response.data
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(`/api/critical-terms/${id}`)
  },
  scanAll: async (termId: string): Promise<ScanResult> => {
    const response = await api.post(`/api/critical-terms/${termId}/scan-all`)
    return response.data
  },
  getOccurrences: async (
    termId: string,
    filters?: {
      folder_id?: string
      thinker_id?: string
      limit?: number
      offset?: number
    }
  ): Promise<TermOccurrence[]> => {
    const response = await api.get(`/api/critical-terms/${termId}/occurrences`, { params: filters })
    return coerceArray<TermOccurrence>(response.data)
  },
  getDefinition: async (termId: string, filters?: TermDefinitionFilters): Promise<TermDefinition> => {
    const params: Record<string, unknown> = {}
    if (filters?.folder_id) params.folder_id = filters.folder_id
    if (filters?.thinker_id) params.thinker_id = filters.thinker_id
    if (filters?.synthesize) params.synthesize = filters.synthesize
    const response = await api.get(`/api/critical-terms/${termId}/definition`, { params })
    return response.data
  },
  getEvidenceMap: async (
    termId: string,
    filters?: { folder_id?: string; thinker_id?: string }
  ): Promise<TermEvidenceMap> => {
    const response = await api.get(`/api/critical-terms/${termId}/evidence-map`, { params: filters })
    return response.data
  },
  getSynthesis: async (
    termId: string,
    mode: SynthesisMode,
    filters?: { folder_id?: string; thinker_id?: string }
  ): Promise<SynthesisRun> => {
    const params: Record<string, unknown> = { mode }
    if (filters?.folder_id) params.folder_id = filters.folder_id
    if (filters?.thinker_id) params.thinker_id = filters.thinker_id
    const response = await api.get(`/api/critical-terms/${termId}/synthesis`, { params })
    return response.data
  },
  getSynthesisRuns: async (termId: string, limit = 20): Promise<SynthesisRunSummary[]> => {
    const response = await api.get(`/api/critical-terms/${termId}/synthesis-runs`, { params: { limit } })
    return coerceArray<SynthesisRunSummary>(response.data)
  },
  getQualityReport: async (termId: string, runId?: string): Promise<TermQualityReport> => {
    const params: Record<string, unknown> = {}
    if (runId) params.run_id = runId
    const response = await api.get(`/api/critical-terms/${termId}/quality-report`, { params })
    return response.data
  },
  getThesisCandidates: async (termId: string): Promise<ThesisCandidateResponse> => {
    const response = await api.post(`/api/critical-terms/${termId}/thesis-candidates`)
    return response.data
  },
  proposeAlias: async (termId: string, aliasName: string): Promise<TermAlias> => {
    const response = await api.post(`/api/critical-terms/${termId}/aliases/propose`, {
      alias_name: aliasName,
    })
    return response.data
  },
  approveAlias: async (termId: string, aliasId: string): Promise<TermAlias> => {
    const response = await api.post(`/api/critical-terms/${termId}/aliases/${aliasId}/approve`)
    return response.data
  },
}

// Analysis API (thinker detection + matrix + co-occurrence)
export const analysisApi = {
  detectThinkers: async (noteId: string): Promise<ThinkerDetectionResult> => {
    const response = await api.post(`/api/notes/${noteId}/detect-thinkers`)
    return response.data
  },
  annotateYears: async (noteId: string): Promise<YearAnnotationResult> => {
    const response = await api.post(`/api/notes/${noteId}/annotate-years`)
    return response.data
  },
  searchThinkers: async (query: string): Promise<Thinker[]> => {
    const response = await api.get('/api/thinkers/', {
      params: { search: query, limit: 10 },
    })
    return coerceArray<Thinker>(response.data)
  },
  getTermThinkerMatrix: async (filters?: { folder_id?: string; term_id?: string }): Promise<TermThinkerMatrix> => {
    const response = await api.get('/api/analysis/term-thinker-matrix', { params: filters })
    return response.data
  },
  getCoOccurrences: async (filters?: { min_count?: number; folder_id?: string }): Promise<CoOccurrencePair[]> => {
    const response = await api.get('/api/analysis/co-occurrences', { params: filters })
    return coerceArray<CoOccurrencePair>(response.data)
  },
  getConnectionSuggestions: async (filters?: { limit?: number; folder_id?: string }): Promise<ConnectionSuggestionFromNotes[]> => {
    const response = await api.get('/api/analysis/connection-suggestions', { params: filters })
    return coerceArray<ConnectionSuggestionFromNotes>(response.data)
  },
  getArgumentMap: async (note_ids: string[], title?: string): Promise<ArgumentMap> => {
    const response = await api.post('/api/analysis/argument-map', { note_ids, title })
    return response.data
  },
  getPremiseGaps: async (note_ids: string[]): Promise<{ gaps: PremiseGap[] }> => {
    const response = await api.post('/api/analysis/premise-gap-check', { note_ids })
    return response.data
  },
  semanticSearch: async (q: string, folder_id?: string, limit = 10): Promise<SemanticSearchResult[]> => {
    const params: Record<string, unknown> = { q, limit }
    if (folder_id) params.folder_id = folder_id
    const response = await api.get('/api/analysis/semantic-search', { params })
    return coerceArray<SemanticSearchResult>(response.data)
  },
  getRelatedExcerpts: async (occurrence_id: string, limit = 8): Promise<RelatedExcerpt[]> => {
    const response = await api.get('/api/analysis/related-excerpts', {
      params: { occurrence_id, limit },
    })
    return coerceArray<RelatedExcerpt>(response.data)
  },
  getConnectionExplanations: async (folder_id?: string, limit = 10): Promise<ConnectionExplanation[]> => {
    const params: Record<string, unknown> = { limit }
    if (folder_id) params.folder_id = folder_id
    const response = await api.get('/api/analysis/connection-explanations', { params })
    return coerceArray<ConnectionExplanation>(response.data)
  },
  getResearchSprintPlan: async (focus = 'all notes'): Promise<ResearchSprintPlan> => {
    const response = await api.post('/api/analysis/research-sprint-plan', null, { params: { focus } })
    return response.data
  },
  getAdvisorBrief: async (date_window = 'last 7 days'): Promise<AdvisorBrief> => {
    const response = await api.post('/api/analysis/advisor-brief', null, { params: { date_window } })
    return response.data
  },
  getVivaPractice: async (topic = 'general'): Promise<VivaPractice> => {
    const response = await api.post('/api/analysis/viva-practice', null, { params: { topic } })
    return response.data
  },
  createWeeklyDigest: async (period_start: string, period_end: string): Promise<WeeklyDigest> => {
    const response = await api.post('/api/analysis/weekly-digest', null, {
      params: { period_start, period_end },
    })
    return response.data
  },
  getLatestWeeklyDigest: async (): Promise<WeeklyDigest> => {
    const response = await api.get('/api/analysis/weekly-digest/latest')
    return response.data
  },
  getAiUsage: async (): Promise<AIUsage> => {
    const response = await api.get('/api/analysis/ai-usage')
    return response.data
  },
}

export const ingestionApi = {
  ingestTranscript: async (payload: IngestionRequest): Promise<IngestionResponse> => {
    const response = await api.post('/api/ingestion/transcript', payload)
    return response.data
  },
  ingestPdfHighlights: async (payload: IngestionRequest): Promise<IngestionResponse> => {
    const response = await api.post('/api/ingestion/pdf-highlights', payload)
    return response.data
  },
}

export const jobsApi = {
  getStatus: async (jobId: string): Promise<JobStatus> => {
    const response = await api.get(`/api/jobs/${jobId}`)
    return response.data
  },
  cancel: async (jobId: string): Promise<JobStatus> => {
    const response = await api.post(`/api/jobs/${jobId}/cancel`)
    return response.data
  },
  retry: async (jobId: string): Promise<JobStatus> => {
    const response = await api.post(`/api/jobs/${jobId}/retry`)
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
    return coerceArray<ResearchQuestion>(response.data)
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
    return coerceArray<ConnectionSuggestion>(response.data)
  },
  getThinkerInsight: async (thinkerId: string): Promise<ThinkerInsight> => {
    const response = await api.get(`/api/ai/thinker-insight/${thinkerId}`)
    return response.data
  },
  suggestResearch: async (limit: number = 3, thinkerId?: string): Promise<ResearchSuggestion[]> => {
    const params: Record<string, unknown> = { limit }
    if (thinkerId) params.thinker_id = thinkerId
    const response = await api.get('/api/ai/suggest-research', { params })
    return coerceArray<ResearchSuggestion>(response.data)
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
    length: string = 'medium',
    timelineId?: string
  ): Promise<SummaryResponseData> => {
    const response = await api.post('/api/ai/summary', {
      summary_type: summaryType,
      target_id: targetId,
      target_name: targetName,
      timeline_id: timelineId,
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
    return coerceArray<QuizSessionSummary>(response.data)
  },

  getStatistics: async (): Promise<QuizStatistics> => {
    const response = await api.get('/api/quiz/statistics')
    return response.data
  },

  getReviewQueue: async (limit?: number): Promise<QuizQuestion[]> => {
    const params: Record<string, unknown> = {}
    if (limit !== undefined) params.limit = limit
    const response = await api.get('/api/quiz/review-queue', { params })
    return coerceArray<QuizQuestion>(response.data)
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
  token?: string | null
}

export const authApi = {
  login: async (password: string): Promise<LoginResponse> => {
    const response = await api.post('/api/auth/login', { password })
    return response.data
  },
  checkAuth: async (): Promise<{ auth_required: boolean; configured?: boolean }> => {
    const response = await api.get('/api/auth/check')
    return response.data
  },
}

// Backup/Restore API
export interface BackupMetadata {
  version: string
  api_version: string
  exported_at: string
  database_type: string
  counts: Record<string, number>
}

export interface ImportResult {
  success: boolean
  message: string
  counts: Record<string, number>
}

export interface ImportPreview {
  valid: boolean
  metadata?: BackupMetadata
  warnings: string[]
}

export const backupApi = {
  exportDatabase: async (): Promise<Blob> => {
    const response = await api.get('/api/backup/export', {
      responseType: 'blob',
    })
    return response.data
  },

  importDatabase: async (file: File): Promise<ImportResult> => {
    const formData = new FormData()
    formData.append('file', file)
    const response = await api.post('/api/backup/import', formData, {
      headers: {
        'Content-Type': undefined,  // Remove default JSON header
      },
      timeout: 120000, // 2 minute timeout
    })
    return response.data
  },

  previewImport: async (file: File): Promise<ImportPreview> => {
    const formData = new FormData()
    formData.append('file', file)
    const response = await api.post('/api/backup/import/preview', formData, {
      headers: {
        'Content-Type': undefined,  // Remove default JSON header
      },
    })
    return response.data
  },
}
