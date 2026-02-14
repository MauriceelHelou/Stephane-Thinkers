import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '../../test/test-utils'
import userEvent from '@testing-library/user-event'
import { DetailPanel } from '../DetailPanel'
import { server } from '../../test/setup'
import { http, HttpResponse } from 'msw'

const API_URL = 'http://localhost:8010'

describe('DetailPanel', () => {
  const defaultProps = {
    thinkerId: '1',
    onClose: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    // Setup thinker detail mock
    server.use(
      http.get(`${API_URL}/api/thinkers/1`, () => {
        return HttpResponse.json({
          id: '1',
          name: 'Immanuel Kant',
          birth_year: 1724,
          death_year: 1804,
          field: 'Philosophy',
          biography_notes: 'German philosopher who is a central figure in modern philosophy.',
          timeline_id: 'timeline-1',
          position_x: 100,
          position_y: 200,
          publications: [
            { id: 'pub-1', title: 'Critique of Pure Reason', year: 1781, publication_type: 'book' }
          ],
          quotes: [
            { id: 'quote-1', text: 'I had to deny knowledge to make room for faith.' }
          ],
          tags: [
            { id: 'tag-1', name: 'Enlightenment', color: '#FF0000' }
          ],
          outgoing_connections: [],
          incoming_connections: []
        })
      }),
      http.get(`${API_URL}/api/tags/`, () => {
        return HttpResponse.json([
          { id: 'tag-1', name: 'Enlightenment', color: '#FF0000' }
        ])
      }),
      http.get(`${API_URL}/api/thinker-institutions/thinker/1`, () => {
        return HttpResponse.json([])
      })
    )
  })

  it('renders thinker name', async () => {
    render(<DetailPanel {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText('Immanuel Kant')).toBeInTheDocument()
    })
  })

  it('renders birth and death years', async () => {
    render(<DetailPanel {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText('1724')).toBeInTheDocument()
      expect(screen.getByText('1804')).toBeInTheDocument()
    })
  })

  it('renders field of study', async () => {
    render(<DetailPanel {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText('Philosophy')).toBeInTheDocument()
    })
  })

  it('renders biography notes', async () => {
    render(<DetailPanel {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText(/German philosopher/)).toBeInTheDocument()
    })
  })

  it('renders publications section', async () => {
    render(<DetailPanel {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText(/Critique of Pure Reason/)).toBeInTheDocument()
    })
  })

  it('renders quotes section', async () => {
    render(<DetailPanel {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText(/deny knowledge/)).toBeInTheDocument()
    })
  })

  it('renders tags', async () => {
    render(<DetailPanel {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText('Enlightenment')).toBeInTheDocument()
    })
  })

  it('has close button', async () => {
    render(<DetailPanel {...defaultProps} />)

    await waitFor(() => {
      const closeButton = screen.getByLabelText(/close details panel/i)
      expect(closeButton).toBeInTheDocument()
    })
  })

  it('calls onClose when close button clicked', async () => {
    const onClose = vi.fn()
    render(<DetailPanel {...defaultProps} onClose={onClose} />)

    await waitFor(async () => {
      const closeButton = screen.getByLabelText(/close details panel/i)
      await userEvent.click(closeButton)
      expect(onClose).toHaveBeenCalled()
    })
  })

  it('has edit button', async () => {
    render(<DetailPanel {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^edit$/i })).toBeInTheDocument()
    })
  })

  it('enters edit mode when edit button clicked', async () => {
    render(<DetailPanel {...defaultProps} />)

    await waitFor(async () => {
      const editButton = screen.getByRole('button', { name: /^edit$/i })
      await userEvent.click(editButton)
    })

    // Should now show save/cancel buttons
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument()
    })
  })

  it('has add publication link', async () => {
    render(<DetailPanel {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText(/\+ Add Publication/)).toBeInTheDocument()
    })
  })

  it('has add quote link', async () => {
    render(<DetailPanel {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText(/\+ Add Quote/)).toBeInTheDocument()
    })
  })

  it('shows loading state initially', () => {
    render(<DetailPanel {...defaultProps} />)
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('does not render when thinkerId is null', () => {
    render(<DetailPanel thinkerId={null} onClose={vi.fn()} />)
    expect(screen.queryByText('Thinker Details')).not.toBeInTheDocument()
  })
})
