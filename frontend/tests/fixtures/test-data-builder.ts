import { APIRequestContext } from '@playwright/test'
import { APIHelpers, TestThinker, TestTimeline, TestConnection, TestTimelineEvent, TestTag, TestInstitution, TestNote, TestPublication, TestQuote } from '../helpers/api-helpers'

// Builder pattern for creating test data
export class ThinkerBuilder {
  private data: Partial<TestThinker> = {}

  withName(name: string): this {
    this.data.name = name
    return this
  }

  withYears(birthYear: number, deathYear?: number): this {
    this.data.birth_year = birthYear
    if (deathYear) {
      this.data.death_year = deathYear
    }
    return this
  }

  withField(field: string): this {
    this.data.field = field
    return this
  }

  withBiography(notes: string): this {
    this.data.biography_notes = notes
    return this
  }

  withActivePeriod(period: string): this {
    this.data.active_period = period
    return this
  }

  atPosition(x: number, y: number): this {
    this.data.position_x = x
    this.data.position_y = y
    return this
  }

  withAnchorYear(year: number): this {
    this.data.anchor_year = year
    return this
  }

  inTimeline(timelineId: string): this {
    this.data.timeline_id = timelineId
    return this
  }

  getData(): Partial<TestThinker> {
    return { ...this.data }
  }

  async build(request: APIRequestContext): Promise<TestThinker> {
    const api = new APIHelpers(request)
    return api.createThinker(this.data)
  }
}

export class TimelineBuilder {
  private data: Partial<TestTimeline> = {}

  withName(name: string): this {
    this.data.name = name
    return this
  }

  withYearRange(startYear: number, endYear: number): this {
    this.data.start_year = startYear
    this.data.end_year = endYear
    return this
  }

  withDescription(description: string): this {
    this.data.description = description
    return this
  }

  getData(): Partial<TestTimeline> {
    return { ...this.data }
  }

  async build(request: APIRequestContext): Promise<TestTimeline> {
    const api = new APIHelpers(request)
    return api.createTimeline(this.data)
  }
}

export class ConnectionBuilder {
  private data: Partial<TestConnection> = {}

  from(thinkerId: string): this {
    this.data.from_thinker_id = thinkerId
    return this
  }

  to(thinkerId: string): this {
    this.data.to_thinker_id = thinkerId
    return this
  }

  ofType(type: 'influenced' | 'critiqued' | 'built_upon' | 'synthesized'): this {
    this.data.connection_type = type
    return this
  }

  withName(name: string): this {
    this.data.name = name
    return this
  }

  withNotes(notes: string): this {
    this.data.notes = notes
    return this
  }

  withStrength(strength: number): this {
    this.data.strength = Math.max(1, Math.min(5, strength))
    return this
  }

  bidirectional(value: boolean = true): this {
    this.data.bidirectional = value
    return this
  }

  getData(): Partial<TestConnection> {
    return { ...this.data }
  }

  async build(request: APIRequestContext): Promise<TestConnection> {
    const api = new APIHelpers(request)
    return api.createConnection(this.data)
  }
}

export class TimelineEventBuilder {
  private data: Partial<TestTimelineEvent> = {}

  withName(name: string): this {
    this.data.name = name
    return this
  }

  inTimeline(timelineId: string): this {
    this.data.timeline_id = timelineId
    return this
  }

  inYear(year: number): this {
    this.data.year = year
    return this
  }

  ofType(type: 'council' | 'publication' | 'war' | 'invention' | 'cultural' | 'political' | 'other'): this {
    this.data.event_type = type
    return this
  }

  withDescription(description: string): this {
    this.data.description = description
    return this
  }

  getData(): Partial<TestTimelineEvent> {
    return { ...this.data }
  }

  async build(request: APIRequestContext): Promise<TestTimelineEvent> {
    const api = new APIHelpers(request)
    return api.createTimelineEvent(this.data)
  }
}

export class TagBuilder {
  private data: Partial<TestTag> = {}

  withName(name: string): this {
    this.data.name = name
    return this
  }

  withColor(color: string): this {
    this.data.color = color
    return this
  }

  getData(): Partial<TestTag> {
    return { ...this.data }
  }

  async build(request: APIRequestContext): Promise<TestTag> {
    const api = new APIHelpers(request)
    return api.createTag(this.data)
  }
}

export class InstitutionBuilder {
  private data: Partial<TestInstitution> = {}

  withName(name: string): this {
    this.data.name = name
    return this
  }

  inCity(city: string): this {
    this.data.city = city
    return this
  }

  inCountry(country: string): this {
    this.data.country = country
    return this
  }

  atCoordinates(latitude: number, longitude: number): this {
    this.data.latitude = latitude
    this.data.longitude = longitude
    return this
  }

  foundedIn(year: number): this {
    this.data.founded_year = year
    return this
  }

  withNotes(notes: string): this {
    this.data.notes = notes
    return this
  }

  getData(): Partial<TestInstitution> {
    return { ...this.data }
  }

  async build(request: APIRequestContext): Promise<TestInstitution> {
    const api = new APIHelpers(request)
    return api.createInstitution(this.data)
  }
}

export class NoteBuilder {
  private data: Partial<TestNote> = {}

  withTitle(title: string): this {
    this.data.title = title
    return this
  }

  withContent(content: string): this {
    this.data.content = content
    return this
  }

  forThinker(thinkerId: string): this {
    this.data.thinker_id = thinkerId
    return this
  }

  ofType(type: 'general' | 'research' | 'biography' | 'connection'): this {
    this.data.note_type = type
    return this
  }

  asCanvasNote(x: number, y: number, color: 'yellow' | 'pink' | 'blue' | 'green' = 'yellow'): this {
    this.data.is_canvas_note = true
    this.data.position_x = x
    this.data.position_y = y
    this.data.color = color
    return this
  }

  getData(): Partial<TestNote> {
    return { ...this.data }
  }

  async build(request: APIRequestContext): Promise<TestNote> {
    const api = new APIHelpers(request)
    return api.createNote(this.data)
  }
}

export class PublicationBuilder {
  private data: Partial<TestPublication> = {}

  withTitle(title: string): this {
    this.data.title = title
    return this
  }

  byThinker(thinkerId: string): this {
    this.data.thinker_id = thinkerId
    return this
  }

  publishedIn(year: number): this {
    this.data.year = year
    return this
  }

  withCitation(citation: string): this {
    this.data.citation = citation
    return this
  }

  ofType(type: 'book' | 'article' | 'chapter' | 'thesis' | 'conference' | 'report' | 'other'): this {
    this.data.publication_type = type
    return this
  }

  withNotes(notes: string): this {
    this.data.notes = notes
    return this
  }

  getData(): Partial<TestPublication> {
    return { ...this.data }
  }

  async build(request: APIRequestContext): Promise<TestPublication> {
    const api = new APIHelpers(request)
    return api.createPublication(this.data)
  }
}

export class QuoteBuilder {
  private data: Partial<TestQuote> = {}

  withText(text: string): this {
    this.data.text = text
    return this
  }

  byThinker(thinkerId: string): this {
    this.data.thinker_id = thinkerId
    return this
  }

  fromSource(source: string): this {
    this.data.source = source
    return this
  }

  inYear(year: number): this {
    this.data.year = year
    return this
  }

  withContext(notes: string): this {
    this.data.context_notes = notes
    return this
  }

  getData(): Partial<TestQuote> {
    return { ...this.data }
  }

  async build(request: APIRequestContext): Promise<TestQuote> {
    const api = new APIHelpers(request)
    return api.createQuote(this.data)
  }
}

// Convenience factory functions
export const builders = {
  thinker: () => new ThinkerBuilder(),
  timeline: () => new TimelineBuilder(),
  connection: () => new ConnectionBuilder(),
  event: () => new TimelineEventBuilder(),
  tag: () => new TagBuilder(),
  institution: () => new InstitutionBuilder(),
  note: () => new NoteBuilder(),
  publication: () => new PublicationBuilder(),
  quote: () => new QuoteBuilder(),
}
