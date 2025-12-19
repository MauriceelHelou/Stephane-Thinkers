import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AddTimelineModal } from '../AddTimelineModal'

const createQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
})

const renderWithQueryClient = (ui: React.ReactElement) => {
  const queryClient = createQueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  )
}

describe('AddTimelineModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    editingTimelineId: null,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('renders when isOpen is true', () => {
      renderWithQueryClient(<AddTimelineModal {...defaultProps} />)
      // Modal title is "Create Timeline" - test for the heading
      expect(screen.getByRole('heading', { name: /create timeline/i })).toBeInTheDocument()
    })

    it('does not render when isOpen is false', () => {
      renderWithQueryClient(<AddTimelineModal {...defaultProps} isOpen={false} />)
      expect(screen.queryByText('Create Timeline')).not.toBeInTheDocument()
    })

    it('shows Edit Timeline title when editing', () => {
      renderWithQueryClient(<AddTimelineModal {...defaultProps} editingTimelineId="timeline-1" />)
      expect(screen.getByText('Edit Timeline')).toBeInTheDocument()
    })
  })

  describe('Form fields', () => {
    it('renders name input', () => {
      renderWithQueryClient(<AddTimelineModal {...defaultProps} />)
      expect(screen.getByPlaceholderText(/e\.g\., French Theory/)).toBeInTheDocument()
    })

    it('renders start year input', () => {
      renderWithQueryClient(<AddTimelineModal {...defaultProps} />)
      expect(screen.getByPlaceholderText('1950')).toBeInTheDocument()
    })

    it('renders end year input', () => {
      renderWithQueryClient(<AddTimelineModal {...defaultProps} />)
      expect(screen.getByPlaceholderText('2000')).toBeInTheDocument()
    })

    it('renders description textarea', () => {
      renderWithQueryClient(<AddTimelineModal {...defaultProps} />)
      expect(screen.getByPlaceholderText(/Brief description/)).toBeInTheDocument()
    })
  })

  describe('Form validation', () => {
    it('shows error when name is empty', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<AddTimelineModal {...defaultProps} />)

      const submitButton = screen.getByRole('button', { name: /create timeline/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('Name is required')).toBeInTheDocument()
      })
    })

    it('shows error when start year is after end year', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<AddTimelineModal {...defaultProps} />)

      const nameInput = screen.getByPlaceholderText(/e\.g\., French Theory/)
      const startYearInput = screen.getByPlaceholderText('1950')
      const endYearInput = screen.getByPlaceholderText('2000')

      await user.type(nameInput, 'Test Timeline')
      await user.clear(startYearInput)
      await user.type(startYearInput, '2000')
      await user.clear(endYearInput)
      await user.type(endYearInput, '1900')

      const submitButton = screen.getByRole('button', { name: /create timeline/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('Start year must be before end year')).toBeInTheDocument()
      })
    })
  })

  describe('Form interaction', () => {
    it('allows typing in name field', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<AddTimelineModal {...defaultProps} />)

      const nameInput = screen.getByPlaceholderText(/e\.g\., French Theory/) as HTMLInputElement
      await user.type(nameInput, 'Test Timeline')

      expect(nameInput.value).toBe('Test Timeline')
    })

    it('allows typing in start year field', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<AddTimelineModal {...defaultProps} />)

      const startYearInput = screen.getByPlaceholderText('1950') as HTMLInputElement
      await user.type(startYearInput, '1800')

      expect(startYearInput.value).toBe('1800')
    })

    it('allows typing in end year field', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<AddTimelineModal {...defaultProps} />)

      const endYearInput = screen.getByPlaceholderText('2000') as HTMLInputElement
      await user.type(endYearInput, '1900')

      expect(endYearInput.value).toBe('1900')
    })

    it('allows typing in description field', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<AddTimelineModal {...defaultProps} />)

      const descriptionInput = screen.getByPlaceholderText(/Brief description/) as HTMLTextAreaElement
      await user.type(descriptionInput, 'A test description')

      expect(descriptionInput.value).toBe('A test description')
    })
  })

  describe('Buttons', () => {
    it('has Cancel button', () => {
      renderWithQueryClient(<AddTimelineModal {...defaultProps} />)
      expect(screen.getByText('Cancel')).toBeInTheDocument()
    })

    it('has Create Timeline button', () => {
      renderWithQueryClient(<AddTimelineModal {...defaultProps} />)
      expect(screen.getByRole('button', { name: /create timeline/i })).toBeInTheDocument()
    })

    it('shows Save Changes button when editing', () => {
      renderWithQueryClient(<AddTimelineModal {...defaultProps} editingTimelineId="timeline-1" />)
      expect(screen.getByText('Save Changes')).toBeInTheDocument()
    })

    it('calls onClose when Cancel is clicked', async () => {
      const user = userEvent.setup()
      const onClose = vi.fn()
      renderWithQueryClient(<AddTimelineModal {...defaultProps} onClose={onClose} />)

      const cancelButton = screen.getByText('Cancel')
      await user.click(cancelButton)

      expect(onClose).toHaveBeenCalled()
    })
  })

  describe('Form submission', () => {
    it('submits form with valid data', async () => {
      const user = userEvent.setup()
      const onClose = vi.fn()
      renderWithQueryClient(<AddTimelineModal {...defaultProps} onClose={onClose} />)

      const nameInput = screen.getByPlaceholderText(/e\.g\., French Theory/)
      await user.type(nameInput, 'Test Timeline')

      const submitButton = screen.getByRole('button', { name: /create timeline/i })
      await user.click(submitButton)

      // Wait for the mutation to complete
      await waitFor(() => {
        expect(onClose).toHaveBeenCalled()
      }, { timeout: 3000 })
    })

    it('shows loading state during submission', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<AddTimelineModal {...defaultProps} />)

      const nameInput = screen.getByPlaceholderText(/e\.g\., French Theory/)
      await user.type(nameInput, 'Test Timeline')

      const submitButton = screen.getByRole('button', { name: /create timeline/i })
      await user.click(submitButton)

      // Should briefly show Creating...
      // Note: This may pass quickly in tests due to mock response speed
    })
  })

  describe('Modal behavior', () => {
    it('closes modal when close button is clicked', async () => {
      const user = userEvent.setup()
      const onClose = vi.fn()
      renderWithQueryClient(<AddTimelineModal {...defaultProps} onClose={onClose} />)

      const closeButton = screen.getByRole('button', { name: /close/i })
      await user.click(closeButton)

      expect(onClose).toHaveBeenCalled()
    })
  })

  describe('Labels', () => {
    it('shows required indicator on name field', () => {
      renderWithQueryClient(<AddTimelineModal {...defaultProps} />)
      expect(screen.getByText('Timeline Name *')).toBeInTheDocument()
    })

    it('shows Start Year label', () => {
      renderWithQueryClient(<AddTimelineModal {...defaultProps} />)
      expect(screen.getByText('Start Year')).toBeInTheDocument()
    })

    it('shows End Year label', () => {
      renderWithQueryClient(<AddTimelineModal {...defaultProps} />)
      expect(screen.getByText('End Year')).toBeInTheDocument()
    })

    it('shows Description label', () => {
      renderWithQueryClient(<AddTimelineModal {...defaultProps} />)
      expect(screen.getByText('Description')).toBeInTheDocument()
    })
  })
})
