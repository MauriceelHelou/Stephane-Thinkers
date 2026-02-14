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
    const timelineData = [
      {
        name: 'Mysticism and Subject Formation',
        start_year: 1260,
        end_year: 1986,
        description: 'Working timeline spanning apophatic theology, psychology of religion, and theories of the sacred.',
      },
      {
        name: 'Psychology of Religion Seminar Arc',
        start_year: 1842,
        end_year: 1962,
        description: 'Primary reading arc from William James through Jung, Otto, and Bataille.',
      },
      {
        name: 'Negative Theology and Transgression',
        start_year: 1260,
        end_year: 2005,
        description: 'Comparative track linking Eckhart reception, psychoanalysis, and continental religious thought.',
      },
    ]
    for (let i = 0; i < timelineCount; i++) {
      const data = timelineData[i % timelineData.length]
      const timeline = await this.createTimeline({
        name: data.name + (i >= timelineData.length ? ` ${Math.floor(i / timelineData.length) + 1}` : ''),
        start_year: data.start_year,
        end_year: data.end_year,
        description: data.description,
      })
      result.timelines.push(timeline)
    }

    // Create tags
    const tagCount = config.tags ?? 3
    const tagNames = ['Mysticism', 'Psychoanalysis', 'Philosophy of Religion', 'Negative Theology', 'Phenomenology', 'Ritual Theory']
    const tagColors = ['#C8553D', '#2A9D8F', '#3A86FF', '#8D5A97', '#FFB703', '#6C757D']
    for (let i = 0; i < tagCount; i++) {
      const tag = await this.createTag({
        name: tagNames[i % tagNames.length] + (i >= tagNames.length ? ` ${Math.floor(i / tagNames.length) + 1}` : ''),
        color: tagColors[i % tagColors.length],
      })
      result.tags.push(tag)
    }

    // Create institutions only when explicitly requested to reduce write contention
    // in shared SQLite E2E runs.
    const institutionCount = config.institutions ?? 0
    const institutionData = [
      { name: 'University of Erfurt', city: 'Erfurt', country: 'Germany' },
      { name: 'University of Paris', city: 'Paris', country: 'France' },
      { name: 'College de France', city: 'Paris', country: 'France' },
      { name: 'University of Chicago Divinity School', city: 'Chicago', country: 'USA' },
      { name: 'Union Theological Seminary', city: 'New York', country: 'USA' },
    ]
    for (let i = 0; i < institutionCount; i++) {
      const data = institutionData[i % institutionData.length]
      try {
        const institution = await this.createInstitution({
          name: data.name + (i >= institutionData.length ? ` ${Math.floor(i / institutionData.length) + 1}` : ''),
          city: data.city,
          country: data.country,
        })
        result.institutions.push(institution)
      } catch (error) {
        // If institutions were explicitly requested, surface the failure.
        if (config.institutions !== undefined) {
          throw error
        }
        break
      }
    }

    // Create thinkers
    const thinkerCount = config.thinkers ?? 5
    const thinkerData = [
      {
        name: 'Meister Eckhart',
        birth_year: 1260,
        death_year: 1328,
        field: 'Mystical Theology',
        biography_notes: 'Dominican theologian associated with apophatic language and detachment.',
      },
      {
        name: 'William James',
        birth_year: 1842,
        death_year: 1910,
        field: 'Psychology of Religion',
        biography_notes: 'Pragmatist psychologist whose lectures shaped modern study of religious experience.',
      },
      {
        name: 'Carl Gustav Jung',
        birth_year: 1875,
        death_year: 1961,
        field: 'Analytical Psychology',
        biography_notes: 'Developed depth-psychological approaches to symbols, myth, and individuation.',
      },
      {
        name: 'Rudolf Otto',
        birth_year: 1869,
        death_year: 1937,
        field: 'Phenomenology of Religion',
        biography_notes: 'Framed the category of the numinous in comparative theology.',
      },
      {
        name: 'Georges Bataille',
        birth_year: 1897,
        death_year: 1962,
        field: 'Philosophy and Religious Studies',
        biography_notes: 'Analyzed transgression, excess, and sacrifice across religion and culture.',
      },
      {
        name: 'Simone Weil',
        birth_year: 1909,
        death_year: 1943,
        field: 'Philosophy of Religion',
        biography_notes: 'Developed an ethics of attention, affliction, and decreation.',
      },
      {
        name: 'Michel de Certeau',
        birth_year: 1925,
        death_year: 1986,
        field: 'Religious History and Psychoanalysis',
        biography_notes: 'Jesuit historian who linked mysticism, discourse, and everyday practice.',
      },
      {
        name: 'Julia Kristeva',
        birth_year: 1941,
        death_year: null,
        field: 'Psychoanalysis and Cultural Theory',
        biography_notes: 'Wrote on abjection, language, and religious imagination in modernity.',
      },
    ]
    for (let i = 0; i < thinkerCount; i++) {
      const data = thinkerData[i % thinkerData.length]
      const thinker = await this.createThinker({
        name: data.name + (i >= thinkerData.length ? ` ${Math.floor(i / thinkerData.length) + 1}` : ''),
        birth_year: data.birth_year,
        death_year: data.death_year,
        field: data.field,
        biography_notes: data.biography_notes,
        timeline_id: result.timelines[i % result.timelines.length]?.id,
        position_x: 120 + (i * 90),
        position_y: 180 + ((i % 2) * 90),
      })
      result.thinkers.push(thinker)
    }

    // Create connections between thinkers
    const connectionCount = config.connections ?? Math.min(result.thinkers.length - 1, 3)
    const connectionData = [
      {
        connection_type: 'influenced',
        strength: 4,
        notes: 'James turns mystical reports into a psychological method, reopening questions central to Eckhartian interiority.',
      },
      {
        connection_type: 'built_upon',
        strength: 4,
        notes: 'Jung extends Jamesian religious experience into symbolic and archetypal interpretation.',
      },
      {
        connection_type: 'built_upon',
        strength: 3,
        notes: 'Otto systematizes experiential language into a phenomenology of the holy.',
      },
      {
        connection_type: 'critiqued',
        strength: 5,
        notes: 'Bataille reworks Otto by emphasizing rupture, expenditure, and transgression.',
      },
      {
        connection_type: 'synthesized',
        strength: 3,
        notes: 'Weil combines ascetic Christian themes with modern critiques of force and social order.',
      },
      {
        connection_type: 'built_upon',
        strength: 3,
        notes: 'De Certeau historicizes mystical discourse while engaging psychoanalytic reading strategies.',
      },
      {
        connection_type: 'synthesized',
        strength: 3,
        notes: 'Kristeva joins psychoanalytic and religious vocabularies in late modern theory.',
      },
    ]
    for (let i = 0; i < connectionCount && i < result.thinkers.length - 1; i++) {
      const data = connectionData[i % connectionData.length]
      const connection = await this.createConnection({
        from_thinker_id: result.thinkers[i].id,
        to_thinker_id: result.thinkers[i + 1].id,
        connection_type: data.connection_type,
        strength: data.strength,
        notes: data.notes,
      })
      result.connections.push(connection)
    }

    // Create timeline events
    const eventCount = config.events ?? 2
    const eventData = [
      {
        name: 'Publication of The Varieties of Religious Experience',
        year: 1902,
        event_type: 'publication',
        description: 'James frames religious life through first-person experience and pragmatic method.',
      },
      {
        name: 'Publication of The Idea of the Holy',
        year: 1917,
        event_type: 'publication',
        description: 'Otto popularizes the category of the numinous in modern religious studies.',
      },
      {
        name: 'Acephale circle begins in Paris',
        year: 1936,
        event_type: 'cultural',
        description: 'Bataille and collaborators experiment with ritual, sovereignty, and political theology.',
      },
      {
        name: 'Publication of Erotism',
        year: 1957,
        event_type: 'publication',
        description: 'Bataille links eroticism, sacrifice, and the limits of subjectivity.',
      },
    ]
    for (let i = 0; i < eventCount; i++) {
      const timeline = result.timelines[i % result.timelines.length]
      const startYear = timeline?.start_year ?? 1700
      const data = eventData[i % eventData.length]
      const event = await this.createTimelineEvent({
        timeline_id: timeline?.id || '',
        name: data.name,
        year: data.year ?? startYear + 50 + (i * 20),
        event_type: data.event_type as TestTimelineEvent['event_type'],
        description: data.description,
      })
      result.events.push(event)
    }

    // Create notes (wrapped in try-catch as notes endpoint may have issues)
    try {
      const noteCount = config.notes ?? 0 // Default to 0 to skip notes
      const noteTemplates = [
        {
          title: 'Dissertation memo: apophasis and psychic economy',
          content: 'Draft argument: read [[Meister Eckhart]] beside [[Georges Bataille]] through the grammar of loss, detachment, and excess.',
        },
        {
          title: 'Method note: psychology of religious experience',
          content: 'Working method: combine case-based description from [[William James]] with symbolic interpretation from [[Carl Gustav Jung]].',
        },
        {
          title: 'Archive question: numinous and transgression',
          content: 'Chapter question: where does [[Rudolf Otto]] break from, or prepare for, [[Georges Bataille]] on fear, awe, and sacred violence?',
        },
      ]
      for (let i = 0; i < noteCount; i++) {
        const data = noteTemplates[i % noteTemplates.length]
        const note = await this.createNote({
          thinker_id: result.thinkers[i % result.thinkers.length]?.id,
          title: data.title,
          content: data.content,
          note_type: 'research',
        })
        result.notes.push(note)
      }
    } catch { /* notes endpoint may have issues */ }

    // Create publications
    const publicationCount = config.publications ?? 2
    const publicationData = [
      { title: 'Meister Eckhart: Selected Sermons', year: 1320, publication_type: 'book', notes: 'Primary medieval text for the apophatic chapter.' },
      { title: 'The Varieties of Religious Experience', year: 1902, publication_type: 'book', notes: 'Core psychological framework for comparative method.' },
      { title: 'Psychology and Religion', year: 1938, publication_type: 'book', notes: 'Depth-psychological bridge between symbol and ritual.' },
      { title: 'The Idea of the Holy', year: 1917, publication_type: 'book', notes: 'Key source on the numinous for the conceptual chapter.' },
      { title: 'Erotism', year: 1957, publication_type: 'book', notes: 'Primary Bataille text for transgression and limit-experience.' },
      { title: 'Gravity and Grace', year: 1947, publication_type: 'book', notes: 'Used for attention, decreation, and ethical asceticism.' },
      { title: 'The Mystic Fable, Volume 1', year: 1982, publication_type: 'book', notes: 'Historical treatment of mystic discourse and practice.' },
      { title: 'Powers of Horror', year: 1980, publication_type: 'book', notes: 'Supports psychoanalytic treatment of abjection and sacred boundaries.' },
    ]
    for (let i = 0; i < publicationCount; i++) {
      const data = publicationData[i % publicationData.length]
      const publication = await this.createPublication({
        thinker_id: result.thinkers[i % result.thinkers.length]?.id,
        title: data.title,
        year: data.year,
        publication_type: data.publication_type as TestPublication['publication_type'],
        notes: data.notes,
      })
      result.publications.push(publication)
    }

    // Create quotes
    const quoteCount = config.quotes ?? 2
    const quoteData = [
      {
        text: 'Detachment is less withdrawal than release from possessive selfhood.',
        source: 'Research notebook on Meister Eckhart',
        year: 1320,
      },
      {
        text: 'Religious life is best analyzed from lived experience before doctrinal systematization.',
        source: 'Seminar digest on William James',
        year: 1902,
      },
      {
        text: 'Symbols mediate psychic conflict where ordinary language reaches its edge.',
        source: 'Chapter draft on Carl Gustav Jung',
        year: 1938,
      },
      {
        text: 'The holy often presents itself as attraction braided with dread.',
        source: 'Comparative note on Rudolf Otto',
        year: 1917,
      },
      {
        text: 'Transgression reveals the limit that social order needs but cannot fully explain.',
        source: 'Bataille reading journal',
        year: 1957,
      },
      {
        text: 'Attention can be treated as both an ethical and contemplative discipline.',
        source: 'Working note on Simone Weil',
        year: 1947,
      },
    ]
    for (let i = 0; i < quoteCount; i++) {
      const data = quoteData[i % quoteData.length]
      const quote = await this.createQuote({
        thinker_id: result.thinkers[i % result.thinkers.length]?.id,
        text: data.text,
        source: data.source,
        year: data.year,
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
        name: `Seminar Thinker ${i + 1}`,
        birth_year: 1260 + i * 40,
        death_year: 1328 + i * 40,
        field: 'Philosophy of Religion',
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
    if (!response.ok()) {
      const body = await response.text()
      throw new Error(`Failed to create institution (${response.status()}): ${body.slice(0, 200)}`)
    }
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
