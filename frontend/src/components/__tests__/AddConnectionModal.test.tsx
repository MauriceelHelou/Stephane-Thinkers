import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '../../test/test-utils'
import userEvent from '@testing-library/user-event'
import { AddConnectionModal } from '../AddConnectionModal'
import { server } from '../../test/setup'
import { http, HttpResponse } from 'msw'

describe('AddConnectionModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the modal when open', async () => {
    render(<AddConnectionModal {...defaultProps} />)
    expect(screen.getByRole('heading', { name: 'Add Connection' })).toBeInTheDocument()
  })

  it('does not render when closed', () => {
    render(<AddConnectionModal {...defaultProps} isOpen={false} />)
    expect(screen.queryByText('Add Connection')).not.toBeInTheDocument()
  })

  it('renders edit title when editing', async () => {
    render(<AddConnectionModal {...defaultProps} editingConnectionId="123" />)
    expect(screen.getByText('Edit Connection')).toBeInTheDocument()
  })

  it('shows thinker selection when no thinkers pre-selected', async () => {
    render(<AddConnectionModal {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText('From Thinker *')).toBeInTheDocument()
      expect(screen.getByText('To Thinker *')).toBeInTheDocument()
    })
  })

  it('shows connection info when thinkers are pre-selected', async () => {
    render(
      <AddConnectionModal
        {...defaultProps}
        fromThinkerId="1"
        toThinkerId="2"
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Connection')).toBeInTheDocument()
    })
  })

  it('shows validation error when submitting without selecting thinkers', async () => {
    render(<AddConnectionModal {...defaultProps} />)

    const submitButton = screen.getByRole('button', { name: /add connection/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText(/please select both thinkers/i)).toBeInTheDocument()
    })
  })

  it('shows connection type selector', async () => {
    render(<AddConnectionModal {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText('Connection Type *')).toBeInTheDocument()
      expect(screen.getByRole('option', { name: 'Influenced' })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: 'Critiqued' })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: 'Built Upon' })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: 'Synthesized' })).toBeInTheDocument()
    })
  })

  it('shows optional fields', async () => {
    render(<AddConnectionModal {...defaultProps} />)

    expect(screen.getByText('Connection Name (optional)')).toBeInTheDocument()
    expect(screen.getByText('Notes')).toBeInTheDocument()
    expect(screen.getByText('Strength (1-5, optional)')).toBeInTheDocument()
    expect(screen.getByText(/bidirectional/i)).toBeInTheDocument()
  })

  it('has cancel button that closes modal', async () => {
    const onClose = vi.fn()
    render(<AddConnectionModal {...defaultProps} onClose={onClose} />)

    const cancelButton = screen.getByRole('button', { name: /cancel/i })
    fireEvent.click(cancelButton)

    expect(onClose).toHaveBeenCalled()
  })

  it('shows delete button when editing', async () => {
    render(<AddConnectionModal {...defaultProps} editingConnectionId="123" />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument()
    })
  })

  it('does not show delete button when creating', () => {
    render(<AddConnectionModal {...defaultProps} />)

    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument()
  })
})
