import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AddTimelineEventModal } from '../AddTimelineEventModal'

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

describe('AddTimelineEventModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    defaultTimelineId: null,
    editingEventId: null,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('renders when isOpen is true', () => {
      renderWithQueryClient(<AddTimelineEventModal {...defaultProps} />)
      expect(screen.getByText('Add Timeline Event')).toBeInTheDocument()
    })

    it('does not render when isOpen is false', () => {
      renderWithQueryClient(<AddTimelineEventModal {...defaultProps} isOpen={false} />)
      expect(screen.queryByText('Add Timeline Event')).not.toBeInTheDocument()
    })

    it('shows Edit Timeline Event title when editing', () => {
      renderWithQueryClient(<AddTimelineEventModal {...defaultProps} editingEventId="event-1" />)
      expect(screen.getByText('Edit Timeline Event')).toBeInTheDocument()
    })
  })

  describe('Form fields', () => {
    it('renders timeline selector', () => {
      renderWithQueryClient(<AddTimelineEventModal {...defaultProps} />)
      expect(screen.getByText('Timeline *')).toBeInTheDocument()
      expect(screen.getByText('Select a timeline')).toBeInTheDocument()
    })

    it('renders event name input', () => {
      renderWithQueryClient(<AddTimelineEventModal {...defaultProps} />)
      expect(screen.getByPlaceholderText(/Council of Trent/)).toBeInTheDocument()
    })

    it('renders year input', () => {
      renderWithQueryClient(<AddTimelineEventModal {...defaultProps} />)
      expect(screen.getByPlaceholderText('-500 or 1545')).toBeInTheDocument()
    })

    it('renders event type selector', () => {
      renderWithQueryClient(<AddTimelineEventModal {...defaultProps} />)
      expect(screen.getByText('Event Type *')).toBeInTheDocument()
    })

    it('renders description textarea', () => {
      renderWithQueryClient(<AddTimelineEventModal {...defaultProps} />)
      expect(screen.getByPlaceholderText(/Brief description/)).toBeInTheDocument()
    })

    it('shows BCE hint for year field', () => {
      renderWithQueryClient(<AddTimelineEventModal {...defaultProps} />)
      expect(screen.getByText(/Use negative for BCE/)).toBeInTheDocument()
    })
  })

  describe('Event types', () => {
    it('shows Council option', () => {
      renderWithQueryClient(<AddTimelineEventModal {...defaultProps} />)
      expect(screen.getByText('△ Council')).toBeInTheDocument()
    })

    it('shows Publication option', () => {
      renderWithQueryClient(<AddTimelineEventModal {...defaultProps} />)
      expect(screen.getByText('▢ Publication')).toBeInTheDocument()
    })

    it('shows War option', () => {
      renderWithQueryClient(<AddTimelineEventModal {...defaultProps} />)
      expect(screen.getByText('◇ War')).toBeInTheDocument()
    })

    it('shows Invention option', () => {
      renderWithQueryClient(<AddTimelineEventModal {...defaultProps} />)
      expect(screen.getByText('★ Invention')).toBeInTheDocument()
    })

    it('shows Cultural option', () => {
      renderWithQueryClient(<AddTimelineEventModal {...defaultProps} />)
      expect(screen.getByText('● Cultural')).toBeInTheDocument()
    })

    it('shows Political option', () => {
      renderWithQueryClient(<AddTimelineEventModal {...defaultProps} />)
      expect(screen.getByText('● Political')).toBeInTheDocument()
    })

    it('shows Other option', () => {
      renderWithQueryClient(<AddTimelineEventModal {...defaultProps} />)
      expect(screen.getByText('● Other')).toBeInTheDocument()
    })
  })

  describe('Form validation', () => {
    it('shows error when name is empty', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<AddTimelineEventModal {...defaultProps} />)

      const submitButton = screen.getByText('Add Event')
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('Name is required')).toBeInTheDocument()
      })
    })

    it('shows error when timeline is not selected', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<AddTimelineEventModal {...defaultProps} />)

      const nameInput = screen.getByPlaceholderText(/Council of Trent/)
      await user.type(nameInput, 'Test Event')

      const submitButton = screen.getByText('Add Event')
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('Valid timeline is required')).toBeInTheDocument()
      })
    })
  })

  describe('Form interaction', () => {
    it('allows typing in event name field', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<AddTimelineEventModal {...defaultProps} />)

      const nameInput = screen.getByPlaceholderText(/Council of Trent/) as HTMLInputElement
      await user.type(nameInput, 'Test Event')

      expect(nameInput.value).toBe('Test Event')
    })

    it('allows typing in year field', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<AddTimelineEventModal {...defaultProps} />)

      const yearInput = screen.getByPlaceholderText('-500 or 1545') as HTMLInputElement
      await user.clear(yearInput)
      await user.type(yearInput, '1800')

      expect(yearInput.value).toBe('1800')
    })

    it('allows typing in description field', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<AddTimelineEventModal {...defaultProps} />)

      const descriptionInput = screen.getByPlaceholderText(/Brief description/) as HTMLTextAreaElement
      await user.type(descriptionInput, 'A test description')

      expect(descriptionInput.value).toBe('A test description')
    })

    it('allows selecting event type', async () => {
      const user = userEvent.setup()
      renderWithQueryClient(<AddTimelineEventModal {...defaultProps} />)

      // Get all selects - the second one is event type
      const selects = screen.getAllByRole('combobox') as HTMLSelectElement[]
      const eventTypeSelect = selects.find(s => s.querySelector('option[value="war"]')) as HTMLSelectElement

      await user.selectOptions(eventTypeSelect, 'war')

      expect(eventTypeSelect.value).toBe('war')
    })
  })

  describe('Buttons', () => {
    it('has Cancel button', () => {
      renderWithQueryClient(<AddTimelineEventModal {...defaultProps} />)
      expect(screen.getByText('Cancel')).toBeInTheDocument()
    })

    it('has Add Event button', () => {
      renderWithQueryClient(<AddTimelineEventModal {...defaultProps} />)
      expect(screen.getByText('Add Event')).toBeInTheDocument()
    })

    it('shows Save Changes button when editing', () => {
      renderWithQueryClient(<AddTimelineEventModal {...defaultProps} editingEventId="event-1" />)
      expect(screen.getByText('Save Changes')).toBeInTheDocument()
    })

    it('shows Delete button when editing', () => {
      renderWithQueryClient(<AddTimelineEventModal {...defaultProps} editingEventId="event-1" />)
      expect(screen.getByText('Delete')).toBeInTheDocument()
    })

    it('calls onClose when Cancel is clicked', async () => {
      const user = userEvent.setup()
      const onClose = vi.fn()
      renderWithQueryClient(<AddTimelineEventModal {...defaultProps} onClose={onClose} />)

      const cancelButton = screen.getByText('Cancel')
      await user.click(cancelButton)

      expect(onClose).toHaveBeenCalled()
    })
  })

  describe('Labels', () => {
    it('shows required indicator on timeline field', () => {
      renderWithQueryClient(<AddTimelineEventModal {...defaultProps} />)
      expect(screen.getByText('Timeline *')).toBeInTheDocument()
    })

    it('shows required indicator on name field', () => {
      renderWithQueryClient(<AddTimelineEventModal {...defaultProps} />)
      expect(screen.getByText('Event Name *')).toBeInTheDocument()
    })

    it('shows required indicator on year field', () => {
      renderWithQueryClient(<AddTimelineEventModal {...defaultProps} />)
      expect(screen.getByText('Year *')).toBeInTheDocument()
    })

    it('shows required indicator on event type field', () => {
      renderWithQueryClient(<AddTimelineEventModal {...defaultProps} />)
      expect(screen.getByText('Event Type *')).toBeInTheDocument()
    })

    it('shows Description label without required indicator', () => {
      renderWithQueryClient(<AddTimelineEventModal {...defaultProps} />)
      expect(screen.getByText('Description')).toBeInTheDocument()
    })
  })

  describe('Modal behavior', () => {
    it('closes modal when close button is clicked', async () => {
      const user = userEvent.setup()
      const onClose = vi.fn()
      renderWithQueryClient(<AddTimelineEventModal {...defaultProps} onClose={onClose} />)

      const closeButton = screen.getByRole('button', { name: /close/i })
      await user.click(closeButton)

      expect(onClose).toHaveBeenCalled()
    })
  })
})
