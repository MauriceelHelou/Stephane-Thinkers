import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '../../test/test-utils'
import userEvent from '@testing-library/user-event'
import { TagManagementModal } from '../TagManagementModal'
import { server } from '../../test/setup'
import { http, HttpResponse } from 'msw'

const API_URL = 'http://localhost:8010'

describe('TagManagementModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    server.use(
      http.get(`${API_URL}/api/tags/`, () => {
        return HttpResponse.json([
          { id: 'tag-1', name: 'Philosophy', color: '#FF0000' },
          { id: 'tag-2', name: 'Science', color: '#00FF00' },
          { id: 'tag-3', name: 'Mathematics', color: '#0000FF' }
        ])
      })
    )
  })

  it('renders the modal when open', async () => {
    render(<TagManagementModal {...defaultProps} />)
    expect(screen.getByText('Manage Tags')).toBeInTheDocument()
  })

  it('does not render when closed', () => {
    render(<TagManagementModal {...defaultProps} isOpen={false} />)
    expect(screen.queryByText('Manage Tags')).not.toBeInTheDocument()
  })

  it('displays existing tags', async () => {
    render(<TagManagementModal {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText('Philosophy')).toBeInTheDocument()
      expect(screen.getByText('Science')).toBeInTheDocument()
      expect(screen.getByText('Mathematics')).toBeInTheDocument()
    })
  })

  it('has input to create new tag', async () => {
    render(<TagManagementModal {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Tag name')).toBeInTheDocument()
    })
  })

  it('has color preset buttons', async () => {
    render(<TagManagementModal {...defaultProps} />)

    // Color label should be present
    expect(screen.getByText('Color')).toBeInTheDocument()

    // Should have color preset buttons
    const colorButtons = document.querySelectorAll('button[style*="background-color"]')
    expect(colorButtons.length).toBeGreaterThan(0)
  })

  it('can add a new tag', async () => {
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

    render(<TagManagementModal {...defaultProps} />)

    const nameInput = screen.getByPlaceholderText('Tag name')
    await userEvent.type(nameInput, 'New Tag')

    const addButton = screen.getByRole('button', { name: /add tag/i })
    await userEvent.click(addButton)
  })

  it('can delete a tag', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    server.use(
      http.delete(`${API_URL}/api/tags/tag-1`, () => {
        return new HttpResponse(null, { status: 204 })
      })
    )

    render(<TagManagementModal {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText('Philosophy')).toBeInTheDocument()
    })

    const deleteButtons = screen.getAllByRole('button', { name: /delete/i })
    await userEvent.click(deleteButtons[0])
  })

  it('has done button', async () => {
    render(<TagManagementModal {...defaultProps} />)
    expect(screen.getByRole('button', { name: /done/i })).toBeInTheDocument()
  })

  it('calls onClose when done button clicked', async () => {
    const onClose = vi.fn()
    render(<TagManagementModal {...defaultProps} onClose={onClose} />)

    const doneButton = screen.getByRole('button', { name: /done/i })
    await userEvent.click(doneButton)

    expect(onClose).toHaveBeenCalled()
  })
})
