import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '../../test/test-utils'
import userEvent from '@testing-library/user-event'
import { AddThinkerModal } from '../AddThinkerModal'

describe('AddThinkerModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the modal when open', async () => {
    render(<AddThinkerModal {...defaultProps} />)
    expect(screen.getByRole('heading', { name: 'Add Thinker' })).toBeInTheDocument()
  })

  it('does not render when closed', () => {
    render(<AddThinkerModal {...defaultProps} isOpen={false} />)
    expect(screen.queryByText('Add Thinker')).not.toBeInTheDocument()
  })

  it('shows required name field', async () => {
    render(<AddThinkerModal {...defaultProps} />)
    expect(screen.getByText('Name *')).toBeInTheDocument()
  })

  it('shows year fields', async () => {
    render(<AddThinkerModal {...defaultProps} />)
    expect(screen.getByText('Birth Year')).toBeInTheDocument()
    expect(screen.getByText('Death Year')).toBeInTheDocument()
  })

  it('shows field/discipline input', async () => {
    render(<AddThinkerModal {...defaultProps} />)
    expect(screen.getByText('Field / Discipline')).toBeInTheDocument()
  })

  it('shows biography notes textarea', async () => {
    render(<AddThinkerModal {...defaultProps} />)
    expect(screen.getByText('Biography Notes')).toBeInTheDocument()
  })

  it('shows validation error for empty name', async () => {
    render(<AddThinkerModal {...defaultProps} />)

    const submitButton = screen.getByRole('button', { name: /add thinker/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText(/name is required/i)).toBeInTheDocument()
    })
  })

  it('shows validation error when death year is before birth year', async () => {
    render(<AddThinkerModal {...defaultProps} />)

    const nameInput = screen.getByPlaceholderText(/michel foucault/i)
    await userEvent.type(nameInput, 'Test Thinker')

    const birthYearInput = screen.getByPlaceholderText('1926')
    await userEvent.type(birthYearInput, '1900')

    const deathYearInput = screen.getByPlaceholderText('1984')
    await userEvent.type(deathYearInput, '1800')

    const submitButton = screen.getByRole('button', { name: /add thinker/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText(/birth year must be before death year/i)).toBeInTheDocument()
    })
  })

  it('has cancel button that closes modal', async () => {
    const onClose = vi.fn()
    render(<AddThinkerModal {...defaultProps} onClose={onClose} />)

    const cancelButton = screen.getByRole('button', { name: /cancel/i })
    fireEvent.click(cancelButton)

    expect(onClose).toHaveBeenCalled()
  })

  it('shows timeline positioning options', () => {
    render(<AddThinkerModal {...defaultProps} />)
    expect(screen.getByText('Timeline Positioning')).toBeInTheDocument()
    expect(screen.getByText(/auto/i)).toBeInTheDocument()
    expect(screen.getByText(/manual/i)).toBeInTheDocument()
  })

  it('allows entering all thinker details', async () => {
    render(<AddThinkerModal {...defaultProps} />)

    const nameInput = screen.getByPlaceholderText(/michel foucault/i)
    await userEvent.type(nameInput, 'Immanuel Kant')

    const birthYearInput = screen.getByPlaceholderText('1926')
    await userEvent.type(birthYearInput, '1724')

    const deathYearInput = screen.getByPlaceholderText('1984')
    await userEvent.type(deathYearInput, '1804')

    const fieldInput = screen.getByPlaceholderText(/philosophy, sociology/i)
    await userEvent.type(fieldInput, 'Philosophy')

    expect(nameInput).toHaveValue('Immanuel Kant')
    expect(birthYearInput).toHaveValue(1724)
    expect(deathYearInput).toHaveValue(1804)
    expect(fieldInput).toHaveValue('Philosophy')
  })
})
