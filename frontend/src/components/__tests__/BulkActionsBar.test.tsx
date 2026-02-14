import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '../../test/test-utils'
import userEvent from '@testing-library/user-event'
import { BulkActionsBar } from '../BulkActionsBar'
import { server } from '../../test/setup'
import { http, HttpResponse } from 'msw'

const API_URL = 'http://localhost:8010'

describe('BulkActionsBar', () => {
  const defaultProps = {
    selectedIds: ['thinker-1', 'thinker-2', 'thinker-3'],
    onClearSelection: vi.fn(),
    onClose: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    server.use(
      http.get(`${API_URL}/api/tags/`, () => {
        return HttpResponse.json([
          { id: 'tag-1', name: 'Philosophy', color: '#FF0000' },
          { id: 'tag-2', name: 'Science', color: '#00FF00' }
        ])
      }),
      http.get(`${API_URL}/api/timelines/`, () => {
        return HttpResponse.json([
          { id: 'timeline-1', name: 'Main Timeline' }
        ])
      })
    )
  })

  it('renders when items are selected', () => {
    render(<BulkActionsBar {...defaultProps} />)
    expect(screen.getByText('3 selected')).toBeInTheDocument()
  })

  it('shows correct count of selected items', () => {
    render(<BulkActionsBar {...defaultProps} selectedIds={['1', '2', '3', '4', '5']} />)
    expect(screen.getByText('5 selected')).toBeInTheDocument()
  })

  it('has clear selection button', () => {
    render(<BulkActionsBar {...defaultProps} />)
    expect(screen.getByTitle(/clear selection/i)).toBeInTheDocument()
  })

  it('calls onClearSelection when clear button clicked', async () => {
    const onClearSelection = vi.fn()
    render(<BulkActionsBar {...defaultProps} onClearSelection={onClearSelection} />)

    const clearButton = screen.getByTitle(/clear selection/i)
    await userEvent.click(clearButton)

    expect(onClearSelection).toHaveBeenCalled()
  })

  it('has delete button', () => {
    render(<BulkActionsBar {...defaultProps} />)
    expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument()
  })

  it('has tags button', () => {
    render(<BulkActionsBar {...defaultProps} />)
    expect(screen.getByRole('button', { name: /^tags$/i })).toBeInTheDocument()
  })

  it('shows tags dropdown when tags button clicked', async () => {
    render(<BulkActionsBar {...defaultProps} />)

    const tagButton = screen.getByRole('button', { name: /^tags$/i })
    await userEvent.click(tagButton)

    // Dropdown should be visible
    expect(screen.getByText(/add tag/i)).toBeInTheDocument()
  })

  it('has move to timeline button', () => {
    render(<BulkActionsBar {...defaultProps} />)
    expect(screen.getByRole('button', { name: /move to timeline/i })).toBeInTheDocument()
  })

  it('does not render when no items selected', () => {
    const { container } = render(<BulkActionsBar {...defaultProps} selectedIds={[]} />)
    expect(container.firstChild).toBeNull()
  })
})
