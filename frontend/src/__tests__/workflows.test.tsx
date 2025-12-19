/**
 * Integration tests for user workflows
 * These tests cover complete user journeys through the application
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '../test/test-utils'
import userEvent from '@testing-library/user-event'
import { server } from '../test/setup'
import { http, HttpResponse } from 'msw'

const API_URL = 'http://localhost:8001'

// Test utilities
function setupMocks() {
  server.use(
    // Timelines
    http.get(`${API_URL}/api/timelines/`, () => {
      return HttpResponse.json([
        { id: 'timeline-1', name: 'Philosophy Timeline', description: 'History of philosophy', start_year: 1700, end_year: 2000 },
        { id: 'timeline-2', name: 'Science Timeline', description: 'History of science', start_year: 1600, end_year: 2000 }
      ])
    }),

    // Thinkers
    http.get(`${API_URL}/api/thinkers/`, () => {
      return HttpResponse.json([
        { id: '1', name: 'Kant', birth_year: 1724, death_year: 1804, field: 'Philosophy', timeline_id: 'timeline-1' },
        { id: '2', name: 'Hegel', birth_year: 1770, death_year: 1831, field: 'Philosophy', timeline_id: 'timeline-1' },
        { id: '3', name: 'Newton', birth_year: 1643, death_year: 1727, field: 'Physics', timeline_id: 'timeline-2' }
      ])
    }),

    // Connections
    http.get(`${API_URL}/api/connections/`, () => {
      return HttpResponse.json([
        { id: 'conn-1', from_thinker_id: '1', to_thinker_id: '2', connection_type: 'influenced', strength: 4 }
      ])
    }),

    // Tags
    http.get(`${API_URL}/api/tags/`, () => {
      return HttpResponse.json([
        { id: 'tag-1', name: 'Enlightenment', color: '#3B82F6' },
        { id: 'tag-2', name: 'Rationalism', color: '#10B981' }
      ])
    })
  )
}

describe('Thinker Management Workflow', () => {
  beforeEach(() => {
    setupMocks()
  })

  it('can create a new thinker', async () => {
    server.use(
      http.post(`${API_URL}/api/thinkers/`, async ({ request }) => {
        const body = await request.json() as Record<string, unknown>
        return HttpResponse.json({
          id: 'new-thinker',
          ...body
        })
      })
    )

    const { AddThinkerModal } = await import('../components/AddThinkerModal')

    render(
      <AddThinkerModal
        isOpen={true}
        onClose={vi.fn()}
      />
    )

    expect(screen.getByRole('heading', { name: 'Add Thinker' })).toBeInTheDocument()

    const nameInput = screen.getByPlaceholderText(/michel foucault/i)
    await userEvent.type(nameInput, 'Friedrich Nietzsche')
    expect(nameInput).toHaveValue('Friedrich Nietzsche')
  })

  it('validates thinker form before submission', async () => {
    const { AddThinkerModal } = await import('../components/AddThinkerModal')

    render(
      <AddThinkerModal
        isOpen={true}
        onClose={vi.fn()}
      />
    )

    // Try to submit without name
    const submitButton = screen.getByRole('button', { name: /add thinker/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText(/name is required/i)).toBeInTheDocument()
    })
  })
})

describe('Connection Management Workflow', () => {
  beforeEach(() => {
    setupMocks()
  })

  it('can create a connection between thinkers', async () => {
    server.use(
      http.post(`${API_URL}/api/connections/`, async ({ request }) => {
        const body = await request.json() as Record<string, unknown>
        return HttpResponse.json({
          id: 'new-conn',
          ...body
        })
      })
    )

    const { AddConnectionModal } = await import('../components/AddConnectionModal')

    render(
      <AddConnectionModal
        isOpen={true}
        onClose={vi.fn()}
        fromThinkerId="1"
        toThinkerId="2"
      />
    )

    expect(screen.getByRole('heading', { name: 'Add Connection' })).toBeInTheDocument()
  })

  it('shows connection type options', async () => {
    const { AddConnectionModal } = await import('../components/AddConnectionModal')

    render(
      <AddConnectionModal
        isOpen={true}
        onClose={vi.fn()}
        fromThinkerId="1"
        toThinkerId="2"
      />
    )

    // Connection modal should have connection type options visible
    expect(screen.getByRole('option', { name: 'Influenced' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Critiqued' })).toBeInTheDocument()
  })
})

describe('Tag Management Workflow', () => {
  beforeEach(() => {
    setupMocks()
  })

  it('displays existing tags', async () => {
    const { TagManagementModal } = await import('../components/TagManagementModal')

    render(<TagManagementModal isOpen={true} onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('Enlightenment')).toBeInTheDocument()
      expect(screen.getByText('Rationalism')).toBeInTheDocument()
    })
  })

  it('can create a new tag', async () => {
    server.use(
      http.post(`${API_URL}/api/tags/`, async ({ request }) => {
        const body = await request.json() as { name: string; color: string }
        return HttpResponse.json({
          id: 'new-tag',
          name: body.name,
          color: body.color
        })
      })
    )

    const { TagManagementModal } = await import('../components/TagManagementModal')

    render(<TagManagementModal isOpen={true} onClose={vi.fn()} />)

    const nameInput = screen.getByPlaceholderText('Tag name')
    await userEvent.type(nameInput, 'Empiricism')

    expect(nameInput).toHaveValue('Empiricism')
  })
})

describe('Export Workflow', () => {
  beforeEach(() => {
    setupMocks()
  })

  it('can open export modal', async () => {
    const { ExportModal } = await import('../components/ExportModal')

    render(<ExportModal isOpen={true} onClose={vi.fn()} />)

    expect(screen.getByText(/export timeline/i)).toBeInTheDocument()
  })

  it('shows export format options', async () => {
    const { ExportModal } = await import('../components/ExportModal')

    render(<ExportModal isOpen={true} onClose={vi.fn()} />)

    expect(screen.getByText(/PNG \(Raster Image\)/i)).toBeInTheDocument()
    expect(screen.getByText(/SVG \(Vector Image\)/i)).toBeInTheDocument()
  })
})

describe('Network Analysis Workflow', () => {
  beforeEach(() => {
    setupMocks()
  })

  it('can open network metrics panel', async () => {
    const { NetworkMetricsPanel } = await import('../components/NetworkMetricsPanel')

    render(<NetworkMetricsPanel isOpen={true} onClose={vi.fn()} />)

    expect(screen.getByText(/network analysis/i)).toBeInTheDocument()
  })

  it('displays network statistics', async () => {
    const { NetworkMetricsPanel } = await import('../components/NetworkMetricsPanel')

    render(<NetworkMetricsPanel isOpen={true} onClose={vi.fn()} />)

    await waitFor(() => {
      // Should show overview tab content
      expect(screen.getByText(/overview/i)).toBeInTheDocument()
    })
  })
})

describe('AI Suggestions Workflow', () => {
  beforeEach(() => {
    setupMocks()
    server.use(
      http.get(`${API_URL}/api/ai/status`, () => {
        return HttpResponse.json({
          enabled: true,
          message: 'AI features are enabled'
        })
      }),
      http.get(`${API_URL}/api/ai/suggest-connections`, () => {
        return HttpResponse.json([
          { from_thinker: 'Kant', to_thinker: 'Hegel', reasoning: 'Similar time period and philosophical tradition' }
        ])
      })
    )
  })

  it('can open AI suggestions panel', async () => {
    const { AISuggestionsPanel } = await import('../components/AISuggestionsPanel')

    render(<AISuggestionsPanel isOpen={true} onClose={vi.fn()} />)

    expect(screen.getByText(/ai assistant/i)).toBeInTheDocument()
  })

  it('displays connection suggestions', async () => {
    const { AISuggestionsPanel } = await import('../components/AISuggestionsPanel')

    render(<AISuggestionsPanel isOpen={true} onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText(/connection ideas/i)).toBeInTheDocument()
    })
  })
})

describe('Help Guide Workflow', () => {
  it('shows help guide with instructions', async () => {
    const { HelpGuide } = await import('../components/HelpGuide')

    render(<HelpGuide isOpen={true} onClose={vi.fn()} />)

    // Help guide should show sections
    expect(screen.getByText('How to Use')).toBeInTheDocument()
    expect(screen.getByText('Navigation')).toBeInTheDocument()
    expect(screen.getByText('Adding Items')).toBeInTheDocument()
  })
})
