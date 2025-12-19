import '@testing-library/jest-dom'
import { afterAll, afterEach, beforeAll, vi } from 'vitest'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'

// Mock HTMLCanvasElement
const mockContext = {
  fillRect: vi.fn(),
  strokeRect: vi.fn(),
  clearRect: vi.fn(),
  getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
  putImageData: vi.fn(),
  createImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
  setTransform: vi.fn(),
  drawImage: vi.fn(),
  save: vi.fn(),
  restore: vi.fn(),
  scale: vi.fn(),
  rotate: vi.fn(),
  translate: vi.fn(),
  transform: vi.fn(),
  beginPath: vi.fn(),
  closePath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  bezierCurveTo: vi.fn(),
  quadraticCurveTo: vi.fn(),
  arc: vi.fn(),
  arcTo: vi.fn(),
  rect: vi.fn(),
  fill: vi.fn(),
  stroke: vi.fn(),
  clip: vi.fn(),
  measureText: vi.fn(() => ({ width: 100 })),
  fillText: vi.fn(),
  strokeText: vi.fn(),
  setLineDash: vi.fn(),
  getLineDash: vi.fn(() => []),
  createLinearGradient: vi.fn(() => ({
    addColorStop: vi.fn()
  })),
  createRadialGradient: vi.fn(() => ({
    addColorStop: vi.fn()
  })),
  createPattern: vi.fn(),
  canvas: { width: 800, height: 600 },
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 1,
  lineCap: 'butt',
  lineJoin: 'miter',
  miterLimit: 10,
  globalAlpha: 1,
  globalCompositeOperation: 'source-over',
  font: '10px sans-serif',
  textAlign: 'start',
  textBaseline: 'alphabetic',
}

HTMLCanvasElement.prototype.getContext = vi.fn(() => mockContext) as any
HTMLCanvasElement.prototype.toDataURL = vi.fn(() => 'data:image/png;base64,mock')
HTMLCanvasElement.prototype.toBlob = vi.fn((callback) => {
  callback(new Blob(['mock'], { type: 'image/png' }))
})

// Mock Element.scrollIntoView
Element.prototype.scrollIntoView = vi.fn()

// Mock API base URL
const API_URL = 'http://localhost:8001'

// Default mock handlers
export const handlers = [
  // Timeline handlers
  http.get(`${API_URL}/api/timelines/`, () => {
    return HttpResponse.json([
      { id: 'timeline-1', name: 'Test Timeline', description: 'A test timeline', start_year: 1700, end_year: 2000 }
    ])
  }),

  http.get(`${API_URL}/api/timelines/:id`, ({ params }) => {
    return HttpResponse.json({
      id: params.id,
      name: 'Test Timeline',
      description: 'A test timeline',
      start_year: 1700,
      end_year: 2000
    })
  }),

  http.post(`${API_URL}/api/timelines/`, async ({ request }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json({
      id: 'new-timeline-id',
      ...body
    })
  }),

  http.put(`${API_URL}/api/timelines/:id`, async ({ params, request }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json({
      id: params.id,
      ...body
    })
  }),

  http.delete(`${API_URL}/api/timelines/:id`, () => {
    return HttpResponse.json({ success: true })
  }),

  // Thinker handlers
  http.get(`${API_URL}/api/thinkers/`, () => {
    return HttpResponse.json([
      {
        id: '1',
        name: 'Immanuel Kant',
        birth_year: 1724,
        death_year: 1804,
        field: 'Philosophy',
        timeline_id: 'timeline-1',
        position_x: 100,
        position_y: 200
      },
      {
        id: '2',
        name: 'Georg Hegel',
        birth_year: 1770,
        death_year: 1831,
        field: 'Philosophy',
        timeline_id: 'timeline-1',
        position_x: 200,
        position_y: 200
      }
    ])
  }),

  http.get(`${API_URL}/api/thinkers/:id`, ({ params }) => {
    return HttpResponse.json({
      id: params.id,
      name: 'Test Thinker',
      birth_year: 1900,
      death_year: 1980,
      field: 'Philosophy',
      timeline_id: 'timeline-1',
      position_x: 100,
      position_y: 200,
      publications: [],
      quotes: [],
      tags: [],
      outgoing_connections: [],
      incoming_connections: []
    })
  }),

  http.post(`${API_URL}/api/thinkers/`, async ({ request }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json({
      id: 'new-thinker-id',
      position_x: 0,
      position_y: 0,
      ...body
    })
  }),

  // Connection handlers
  http.get(`${API_URL}/api/connections/`, () => {
    return HttpResponse.json([
      {
        id: 'conn-1',
        from_thinker_id: 'thinker-1',
        to_thinker_id: 'thinker-2',
        connection_type: 'influenced',
        strength: 3
      }
    ])
  }),

  http.get(`${API_URL}/api/connections/:id`, ({ params }) => {
    return HttpResponse.json({
      id: params.id,
      from_thinker_id: 'thinker-1',
      to_thinker_id: 'thinker-2',
      connection_type: 'influenced',
      strength: 3,
      name: 'Test Connection',
      description: 'A test connection'
    })
  }),

  http.put(`${API_URL}/api/connections/:id`, async ({ params, request }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json({
      id: params.id,
      ...body
    })
  }),

  http.delete(`${API_URL}/api/connections/:id`, () => {
    return HttpResponse.json({ success: true })
  }),

  http.post(`${API_URL}/api/connections/`, async ({ request }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json({
      id: 'new-conn-id',
      ...body
    })
  }),

  // Publication handlers
  http.get(`${API_URL}/api/publications/`, () => {
    return HttpResponse.json([])
  }),

  http.post(`${API_URL}/api/publications/`, async ({ request }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json({
      id: 'new-pub-id',
      ...body
    })
  }),

  // Quote handlers
  http.get(`${API_URL}/api/quotes/`, () => {
    return HttpResponse.json([])
  }),

  http.post(`${API_URL}/api/quotes/`, async ({ request }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json({
      id: 'new-quote-id',
      ...body
    })
  }),

  // Tag handlers
  http.get(`${API_URL}/api/tags/`, () => {
    return HttpResponse.json([
      { id: 'tag-1', name: 'Philosophy', color: '#FF0000' }
    ])
  }),

  http.post(`${API_URL}/api/tags/`, async ({ request }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json({
      id: 'new-tag-id',
      ...body
    })
  }),

  // AI handlers
  http.get(`${API_URL}/api/ai/status`, () => {
    return HttpResponse.json({
      enabled: true,
      message: 'AI features are enabled (using DeepSeek)'
    })
  }),

  http.get(`${API_URL}/api/ai/suggest-connections`, () => {
    return HttpResponse.json([])
  }),

  http.get(`${API_URL}/api/ai/suggest-research`, () => {
    return HttpResponse.json([])
  }),

  http.post(`${API_URL}/api/ai/chat`, async () => {
    return HttpResponse.json({
      answer: 'This is a test response from the AI assistant.',
      citations: [],
      follow_up_questions: ['Would you like to know more?']
    })
  }),

  http.post(`${API_URL}/api/ai/summary`, async () => {
    return HttpResponse.json({
      summary: 'Test summary of the database.',
      key_points: ['Point 1', 'Point 2'],
      key_figures: ['Kant', 'Hegel'],
      themes: ['Philosophy', 'Ethics'],
      length: 'medium'
    })
  }),

  http.post(`${API_URL}/api/ai/parse`, async () => {
    return HttpResponse.json({
      entity_type: 'thinker',
      data: { name: 'Test Thinker' },
      confidence: 0.9,
      needs_clarification: []
    })
  }),

  // Research questions handlers
  http.get(`${API_URL}/api/research-questions/`, () => {
    return HttpResponse.json([])
  }),

  http.get(`${API_URL}/api/research-questions/stats/summary`, () => {
    return HttpResponse.json({
      total: 0,
      by_status: {},
      by_category: {},
      by_priority: {}
    })
  }),

  // Institutions handlers
  http.get(`${API_URL}/api/institutions/`, () => {
    return HttpResponse.json([
      { id: 'inst-1', name: 'Harvard University', city: 'Cambridge', country: 'USA' },
      { id: 'inst-2', name: 'University of Königsberg', city: 'Königsberg', country: 'Prussia' }
    ])
  }),

  http.post(`${API_URL}/api/institutions/`, async ({ request }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json({
      id: 'new-inst-id',
      ...body
    })
  }),

  http.put(`${API_URL}/api/institutions/:id`, async ({ params, request }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json({
      id: params.id,
      ...body
    })
  }),

  // Institution affiliations handlers
  http.get(`${API_URL}/api/institutions/affiliations`, () => {
    return HttpResponse.json([])
  }),

  http.get(`${API_URL}/api/thinker-institutions/thinker/:thinkerId`, () => {
    return HttpResponse.json([])
  }),

  http.post(`${API_URL}/api/thinker-institutions/`, async ({ request }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json({
      id: 'new-affiliation-id',
      ...body
    })
  }),

  http.put(`${API_URL}/api/thinker-institutions/:id`, async ({ params, request }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json({
      id: params.id,
      ...body
    })
  }),

  // Notes handlers
  http.get(`${API_URL}/api/notes/`, () => {
    return HttpResponse.json([])
  }),

  // Combined views handlers
  http.get(`${API_URL}/api/combined-views/`, () => {
    return HttpResponse.json([])
  }),

  http.get(`${API_URL}/api/combined-views/:id`, ({ params }) => {
    return HttpResponse.json({
      id: params.id,
      name: 'Test Combined View',
      description: 'A test combined view',
      members: [
        { id: 'member-1', timeline_id: 'timeline-1', position: 0 },
        { id: 'member-2', timeline_id: 'timeline-2', position: 1 }
      ]
    })
  }),

  http.post(`${API_URL}/api/combined-views/`, async ({ request }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json({
      id: 'new-combined-view-id',
      ...body
    })
  }),

  http.put(`${API_URL}/api/combined-views/:id`, async ({ params, request }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json({
      id: params.id,
      ...body
    })
  }),

  // Timeline events handlers
  http.get(`${API_URL}/api/timeline-events/`, () => {
    return HttpResponse.json([])
  }),

  http.get(`${API_URL}/api/timeline-events/:id`, ({ params }) => {
    return HttpResponse.json({
      id: params.id,
      timeline_id: 'timeline-1',
      name: 'Test Event',
      year: 1800,
      event_type: 'other',
      description: 'A test event'
    })
  }),

  http.post(`${API_URL}/api/timeline-events/`, async ({ request }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json({
      id: 'new-event-id',
      ...body
    })
  }),

  http.put(`${API_URL}/api/timeline-events/:id`, async ({ params, request }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json({
      id: params.id,
      ...body
    })
  }),

  http.delete(`${API_URL}/api/timeline-events/:id`, () => {
    return HttpResponse.json({ success: true })
  }),
]

// Setup MSW server
export const server = setupServer(...handlers)

// Start server before all tests
beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))

// Reset handlers after each test
afterEach(() => server.resetHandlers())

// Close server after all tests
afterAll(() => server.close())
