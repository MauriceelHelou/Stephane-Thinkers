import { APIRequestContext } from '@playwright/test'
import { API_URL } from '../config/test-constants'

// Types for test data
export interface TestThinker {
  id: string
  name: string
  birth_year?: number | null
  death_year?: number | null
  active_period?: string | null
  field?: string | null
  biography_notes?: string | null
  position_x?: number | null
  position_y?: number | null
  anchor_year?: number | null
  timeline_id?: string | null
  created_at: string
  updated_at: string
}

export interface TestTimeline {
  id: string
  name: string
  start_year?: number | null
  end_year?: number | null
  description?: string | null
  created_at: string
  updated_at: string
}

export interface TestConnection {
  id: string
  from_thinker_id: string
  to_thinker_id: string
  connection_type: string
  name?: string | null
  notes?: string | null
  bidirectional: boolean
  strength?: number | null
  created_at: string
  updated_at: string
}

export interface TestTimelineEvent {
  id: string
  timeline_id: string
  name: string
  year: number
  event_type: string
  description?: string | null
  created_at: string
  updated_at: string
}

export interface TestTag {
  id: string
  name: string
  color?: string | null
  created_at: string
}

export interface TestInstitution {
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

export interface TestNote {
  id: string
  thinker_id?: string | null
  title?: string | null
  content: string
  content_html?: string | null
  note_type?: string | null
  position_x?: number | null
  position_y?: number | null
  color?: string | null
  is_canvas_note?: boolean | null
  created_at: string
  updated_at: string
}

export interface TestPublication {
  id: string
  thinker_id: string
  title: string
  year?: number | null
  citation?: string | null
  notes?: string | null
  publication_type?: string | null
  created_at: string
  updated_at?: string | null
}

export interface TestQuote {
  id: string
  thinker_id: string
  text: string
  source?: string | null
  year?: number | null
  context_notes?: string | null
  created_at: string
}

export interface SeedConfig {
  thinkers?: number
  connections?: number
  timelines?: number
  events?: number
  tags?: number
  institutions?: number
  notes?: number
  publications?: number
  quotes?: number
}

export class APIHelpers {
  private request: APIRequestContext
  private baseUrl: string

  constructor(request: APIRequestContext, baseUrl: string = API_URL) {
    this.request = request
    this.baseUrl = baseUrl
  }

  // Health check
  async isBackendAvailable(): Promise<boolean> {
    try {
      const response = await this.request.get(`${this.baseUrl}/api/timelines/`)
      return response.ok()
    } catch {
      return false
    }
  }

  // Database operations
  async resetDatabase(): Promise<void> {
    // Delete all data in reverse dependency order
    // Each section is wrapped in try-catch to continue even if some endpoints fail

    // Get and delete connections first
    try {
      const connections = await this.getAllConnections()
      for (const conn of connections) {
        await this.deleteConnection(conn.id)
      }
    } catch { /* endpoint may not exist */ }

    // Delete notes
    try {
      const notes = await this.getAllNotes()
      for (const note of notes) {
        await this.deleteNote(note.id)
      }
    } catch { /* endpoint may not exist or have issues */ }

    // Delete publications
    try {
      const publications = await this.getAllPublications()
      for (const pub of publications) {
        await this.deletePublication(pub.id)
      }
    } catch { /* endpoint may not exist */ }

    // Delete quotes
    try {
      const quotes = await this.getAllQuotes()
      for (const quote of quotes) {
        await this.deleteQuote(quote.id)
      }
    } catch { /* endpoint may not exist */ }

    // Delete timeline events
    try {
      const events = await this.getAllTimelineEvents()
      for (const event of events) {
        await this.deleteTimelineEvent(event.id)
      }
    } catch { /* endpoint may not exist */ }

    // Delete thinkers
    try {
      const thinkers = await this.getAllThinkers()
      for (const thinker of thinkers) {
        await this.deleteThinker(thinker.id)
      }
    } catch { /* endpoint may not exist */ }

    // Delete timelines
    try {
      const timelines = await this.getAllTimelines()
      for (const timeline of timelines) {
        await this.deleteTimeline(timeline.id)
      }
    } catch { /* endpoint may not exist */ }

    // Delete tags
    try {
      const tags = await this.getAllTags()
      for (const tag of tags) {
        await this.deleteTag(tag.id)
      }
    } catch { /* endpoint may not exist */ }

    // Delete institutions (affiliations should cascade)
    try {
      const institutions = await this.getAllInstitutions()
      for (const inst of institutions) {
        await this.deleteInstitution(inst.id)
      }
    } catch { /* endpoint may not exist */ }
  }

  async seedDatabase(config: SeedConfig = {}): Promise<{
    timelines: TestTimeline[]
    thinkers: TestThinker[]
    connections: TestConnection[]
    events: TestTimelineEvent[]
    tags: TestTag[]
    institutions: TestInstitution[]
    notes: TestNote[]
    publications: TestPublication[]
    quotes: TestQuote[]
  }> {
    const result = {
      timelines: [] as TestTimeline[],
      thinkers: [] as TestThinker[],
      connections: [] as TestConnection[],
      events: [] as TestTimelineEvent[],
      tags: [] as TestTag[],
      institutions: [] as TestInstitution[],
      notes: [] as TestNote[],
      publications: [] as TestPublication[],
      quotes: [] as TestQuote[],
    }

    // Create timelines first
    const timelineCount = config.timelines ?? 1
    for (let i = 0; i < timelineCount; i++) {
      const timeline = await this.createTimeline({
        name: `Test Timeline ${i + 1}`,
        start_year: 1700 + i * 100,
        end_year: 1900 + i * 100,
        description: `Test timeline for E2E testing ${i + 1}`,
      })
      result.timelines.push(timeline)
    }

    // Create tags
    const tagCount = config.tags ?? 3
    const tagNames = ['Philosophy', 'Science', 'Politics', 'Art', 'Literature', 'Religion']
    const tagColors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD']
    for (let i = 0; i < tagCount; i++) {
      const tag = await this.createTag({
        name: tagNames[i % tagNames.length] + (i >= tagNames.length ? ` ${Math.floor(i / tagNames.length) + 1}` : ''),
        color: tagColors[i % tagColors.length],
      })
      result.tags.push(tag)
    }

    // Create institutions
    const institutionCount = config.institutions ?? 2
    const institutionData = [
      { name: 'University of Konigsberg', city: 'Konigsberg', country: 'Prussia' },
      { name: 'University of Jena', city: 'Jena', country: 'Germany' },
      { name: 'University of Berlin', city: 'Berlin', country: 'Germany' },
      { name: 'Oxford University', city: 'Oxford', country: 'England' },
      { name: 'Cambridge University', city: 'Cambridge', country: 'England' },
    ]
    for (let i = 0; i < institutionCount; i++) {
      const data = institutionData[i % institutionData.length]
      const institution = await this.createInstitution({
        name: data.name + (i >= institutionData.length ? ` ${Math.floor(i / institutionData.length) + 1}` : ''),
        city: data.city,
        country: data.country,
      })
      result.institutions.push(institution)
    }

    // Create thinkers
    const thinkerCount = config.thinkers ?? 5
    const thinkerData = [
      { name: 'Immanuel Kant', birth_year: 1724, death_year: 1804, field: 'Philosophy' },
      { name: 'Georg Wilhelm Friedrich Hegel', birth_year: 1770, death_year: 1831, field: 'Philosophy' },
      { name: 'Karl Marx', birth_year: 1818, death_year: 1883, field: 'Economics' },
      { name: 'Friedrich Nietzsche', birth_year: 1844, death_year: 1900, field: 'Philosophy' },
      { name: 'Martin Heidegger', birth_year: 1889, death_year: 1976, field: 'Philosophy' },
      { name: 'Hannah Arendt', birth_year: 1906, death_year: 1975, field: 'Political Theory' },
      { name: 'John Rawls', birth_year: 1921, death_year: 2002, field: 'Political Philosophy' },
      { name: 'Michel Foucault', birth_year: 1926, death_year: 1984, field: 'Philosophy' },
    ]
    for (let i = 0; i < thinkerCount; i++) {
      const data = thinkerData[i % thinkerData.length]
      const thinker = await this.createThinker({
        name: data.name + (i >= thinkerData.length ? ` ${Math.floor(i / thinkerData.length) + 1}` : ''),
        birth_year: data.birth_year,
        death_year: data.death_year,
        field: data.field,
        timeline_id: result.timelines[i % result.timelines.length]?.id,
        position_x: 100 + (i * 80),
        position_y: 200,
      })
      result.thinkers.push(thinker)
    }

    // Create connections between thinkers
    const connectionCount = config.connections ?? Math.min(result.thinkers.length - 1, 3)
    const connectionTypes = ['influenced', 'critiqued', 'built_upon', 'synthesized']
    for (let i = 0; i < connectionCount && i < result.thinkers.length - 1; i++) {
      const connection = await this.createConnection({
        from_thinker_id: result.thinkers[i].id,
        to_thinker_id: result.thinkers[i + 1].id,
        connection_type: connectionTypes[i % connectionTypes.length],
        strength: (i % 5) + 1,
        notes: `Connection ${i + 1} - test data`,
      })
      result.connections.push(connection)
    }

    // Create timeline events
    const eventCount = config.events ?? 2
    const eventTypes = ['council', 'publication', 'war', 'invention', 'cultural', 'political', 'other']
    for (let i = 0; i < eventCount; i++) {
      const timeline = result.timelines[i % result.timelines.length]
      const startYear = timeline?.start_year ?? 1700
      const event = await this.createTimelineEvent({
        timeline_id: timeline?.id || '',
        name: `Test Event ${i + 1}`,
        year: startYear + 50 + (i * 20),
        event_type: eventTypes[i % eventTypes.length],
        description: `Test event description ${i + 1}`,
      })
      result.events.push(event)
    }

    // Create notes (wrapped in try-catch as notes endpoint may have issues)
    try {
      const noteCount = config.notes ?? 0 // Default to 0 to skip notes
      for (let i = 0; i < noteCount; i++) {
        const note = await this.createNote({
          thinker_id: result.thinkers[i % result.thinkers.length]?.id,
          title: `Test Note ${i + 1}`,
          content: `This is test note content ${i + 1}. It can include [[${result.thinkers[(i + 1) % result.thinkers.length]?.name}]] wiki-style links.`,
          note_type: 'research',
        })
        result.notes.push(note)
      }
    } catch { /* notes endpoint may have issues */ }

    // Create publications
    const publicationCount = config.publications ?? 2
    for (let i = 0; i < publicationCount; i++) {
      const publication = await this.createPublication({
        thinker_id: result.thinkers[i % result.thinkers.length]?.id,
        title: `Test Publication ${i + 1}`,
        year: 1800 + i * 20,
        publication_type: 'book',
        notes: `Test publication notes ${i + 1}`,
      })
      result.publications.push(publication)
    }

    // Create quotes
    const quoteCount = config.quotes ?? 2
    for (let i = 0; i < quoteCount; i++) {
      const quote = await this.createQuote({
        thinker_id: result.thinkers[i % result.thinkers.length]?.id,
        text: `This is a famous test quote number ${i + 1} from a great thinker.`,
        source: `Test Source ${i + 1}`,
        year: 1800 + i * 20,
      })
      result.quotes.push(quote)
    }

    return result
  }

  async clearDatabase(): Promise<void> {
    await this.resetDatabase()
  }

  // Timeline CRUD
  async getAllTimelines(): Promise<TestTimeline[]> {
    const response = await this.request.get(`${this.baseUrl}/api/timelines/`)
    return response.json()
  }

  async createTimeline(data: Partial<TestTimeline>): Promise<TestTimeline> {
    const response = await this.request.post(`${this.baseUrl}/api/timelines/`, { data })
    return response.json()
  }

  async updateTimeline(id: string, data: Partial<TestTimeline>): Promise<TestTimeline> {
    const response = await this.request.put(`${this.baseUrl}/api/timelines/${id}`, { data })
    return response.json()
  }

  async deleteTimeline(id: string): Promise<void> {
    await this.request.delete(`${this.baseUrl}/api/timelines/${id}`)
  }

  // Thinker CRUD
  async getAllThinkers(): Promise<TestThinker[]> {
    const response = await this.request.get(`${this.baseUrl}/api/thinkers/`)
    return response.json()
  }

  async getThinker(id: string): Promise<TestThinker> {
    const response = await this.request.get(`${this.baseUrl}/api/thinkers/${id}`)
    return response.json()
  }

  async createThinker(data: Partial<TestThinker>): Promise<TestThinker> {
    const response = await this.request.post(`${this.baseUrl}/api/thinkers/`, { data })
    return response.json()
  }

  async updateThinker(id: string, data: Partial<TestThinker>): Promise<TestThinker> {
    const response = await this.request.put(`${this.baseUrl}/api/thinkers/${id}`, { data })
    return response.json()
  }

  async deleteThinker(id: string): Promise<void> {
    await this.request.delete(`${this.baseUrl}/api/thinkers/${id}`)
  }

  async createBulkThinkers(count: number, baseData?: Partial<TestThinker>): Promise<TestThinker[]> {
    const thinkers: TestThinker[] = []
    for (let i = 0; i < count; i++) {
      const thinker = await this.createThinker({
        name: `Bulk Thinker ${i + 1}`,
        birth_year: 1700 + i * 10,
        death_year: 1780 + i * 10,
        field: 'Philosophy',
        ...baseData,
      })
      thinkers.push(thinker)
    }
    return thinkers
  }

  // Connection CRUD
  async getAllConnections(): Promise<TestConnection[]> {
    const response = await this.request.get(`${this.baseUrl}/api/connections/`)
    return response.json()
  }

  async createConnection(data: Partial<TestConnection>): Promise<TestConnection> {
    const response = await this.request.post(`${this.baseUrl}/api/connections/`, { data })
    return response.json()
  }

  async updateConnection(id: string, data: Partial<TestConnection>): Promise<TestConnection> {
    const response = await this.request.put(`${this.baseUrl}/api/connections/${id}`, { data })
    return response.json()
  }

  async deleteConnection(id: string): Promise<void> {
    await this.request.delete(`${this.baseUrl}/api/connections/${id}`)
  }

  // Timeline Event CRUD
  async getAllTimelineEvents(): Promise<TestTimelineEvent[]> {
    const response = await this.request.get(`${this.baseUrl}/api/timeline-events/`)
    return response.json()
  }

  async createTimelineEvent(data: Partial<TestTimelineEvent>): Promise<TestTimelineEvent> {
    const response = await this.request.post(`${this.baseUrl}/api/timeline-events/`, { data })
    return response.json()
  }

  async updateTimelineEvent(id: string, data: Partial<TestTimelineEvent>): Promise<TestTimelineEvent> {
    const response = await this.request.put(`${this.baseUrl}/api/timeline-events/${id}`, { data })
    return response.json()
  }

  async deleteTimelineEvent(id: string): Promise<void> {
    await this.request.delete(`${this.baseUrl}/api/timeline-events/${id}`)
  }

  // Tag CRUD
  async getAllTags(): Promise<TestTag[]> {
    const response = await this.request.get(`${this.baseUrl}/api/tags/`)
    return response.json()
  }

  async createTag(data: Partial<TestTag>): Promise<TestTag> {
    const response = await this.request.post(`${this.baseUrl}/api/tags/`, { data })
    return response.json()
  }

  async deleteTag(id: string): Promise<void> {
    await this.request.delete(`${this.baseUrl}/api/tags/${id}`)
  }

  // Institution CRUD
  async getAllInstitutions(): Promise<TestInstitution[]> {
    const response = await this.request.get(`${this.baseUrl}/api/institutions/`)
    return response.json()
  }

  async createInstitution(data: Partial<TestInstitution>): Promise<TestInstitution> {
    const response = await this.request.post(`${this.baseUrl}/api/institutions/`, { data })
    return response.json()
  }

  async deleteInstitution(id: string): Promise<void> {
    await this.request.delete(`${this.baseUrl}/api/institutions/${id}`)
  }

  // Note CRUD
  async getAllNotes(): Promise<TestNote[]> {
    const response = await this.request.get(`${this.baseUrl}/api/notes/`)
    return response.json()
  }

  async createNote(data: Partial<TestNote>): Promise<TestNote> {
    const response = await this.request.post(`${this.baseUrl}/api/notes/`, { data })
    return response.json()
  }

  async deleteNote(id: string): Promise<void> {
    await this.request.delete(`${this.baseUrl}/api/notes/${id}`)
  }

  // Publication CRUD
  async getAllPublications(): Promise<TestPublication[]> {
    const response = await this.request.get(`${this.baseUrl}/api/publications/`)
    return response.json()
  }

  async createPublication(data: Partial<TestPublication>): Promise<TestPublication> {
    const response = await this.request.post(`${this.baseUrl}/api/publications/`, { data })
    return response.json()
  }

  async deletePublication(id: string): Promise<void> {
    await this.request.delete(`${this.baseUrl}/api/publications/${id}`)
  }

  // Quote CRUD
  async getAllQuotes(): Promise<TestQuote[]> {
    const response = await this.request.get(`${this.baseUrl}/api/quotes/`)
    return response.json()
  }

  async createQuote(data: Partial<TestQuote>): Promise<TestQuote> {
    const response = await this.request.post(`${this.baseUrl}/api/quotes/`, { data })
    return response.json()
  }

  async deleteQuote(id: string): Promise<void> {
    await this.request.delete(`${this.baseUrl}/api/quotes/${id}`)
  }

  // AI API
  async getAIStatus(): Promise<{ enabled: boolean; message: string }> {
    const response = await this.request.get(`${this.baseUrl}/api/ai/status`)
    return response.json()
  }

  // Quiz API
  async generateQuiz(params: {
    timeline_id?: string
    question_categories: string[]
    difficulty: string
    question_count: number
    multiple_choice_ratio: number
  }): Promise<any> {
    const response = await this.request.post(`${this.baseUrl}/api/quiz/generate-quiz`, { data: params })
    return response.json()
  }

  async getQuizHistory(): Promise<any[]> {
    const response = await this.request.get(`${this.baseUrl}/api/quiz/history`)
    return response.json()
  }
}

// Factory function for use in tests
export function createAPIHelpers(request: APIRequestContext): APIHelpers {
  return new APIHelpers(request)
}
