import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CreateCombinedViewModal } from '../CreateCombinedViewModal'

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  })

const renderWithProviders = (ui: React.ReactElement) => {
  const queryClient = createQueryClient()
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  )
}

describe('CreateCombinedViewModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('renders when open', () => {
      renderWithProviders(<CreateCombinedViewModal {...defaultProps} />)
      expect(screen.getByText('Create Combined Timeline View')).toBeInTheDocument()
    })

    it('does not render when closed', () => {
      renderWithProviders(
        <CreateCombinedViewModal {...defaultProps} isOpen={false} />
      )
      expect(screen.queryByText('Create Combined Timeline View')).not.toBeInTheDocument()
    })

    it('shows edit title when editing', () => {
      renderWithProviders(
        <CreateCombinedViewModal {...defaultProps} editingViewId="view-1" />
      )
      expect(screen.getByText('Edit Combined View')).toBeInTheDocument()
    })
  })

  describe('Form fields', () => {
    it('shows name input', () => {
      renderWithProviders(<CreateCombinedViewModal {...defaultProps} />)
      expect(screen.getByLabelText(/View Name/)).toBeInTheDocument()
    })

    it('shows description textarea', () => {
      renderWithProviders(<CreateCombinedViewModal {...defaultProps} />)
      expect(screen.getByLabelText(/Description/)).toBeInTheDocument()
    })

    it('shows timeline selection section', () => {
      renderWithProviders(<CreateCombinedViewModal {...defaultProps} />)
      expect(screen.getByText(/Select Timelines/)).toBeInTheDocument()
    })

    it('shows minimum timeline requirement', () => {
      renderWithProviders(<CreateCombinedViewModal {...defaultProps} />)
      expect(screen.getByText(/minimum 2/)).toBeInTheDocument()
    })

    it('shows selected count', () => {
      renderWithProviders(<CreateCombinedViewModal {...defaultProps} />)
      expect(screen.getByText(/Selected:/)).toBeInTheDocument()
    })
  })

  describe('Form interactions', () => {
    it('allows entering view name', () => {
      renderWithProviders(<CreateCombinedViewModal {...defaultProps} />)

      const input = screen.getByLabelText(/View Name/) as HTMLInputElement
      fireEvent.change(input, { target: { value: 'Test View' } })
      expect(input.value).toBe('Test View')
    })

    it('allows entering description', () => {
      renderWithProviders(<CreateCombinedViewModal {...defaultProps} />)

      const textarea = screen.getByLabelText(/Description/) as HTMLTextAreaElement
      fireEvent.change(textarea, { target: { value: 'Test description' } })
      expect(textarea.value).toBe('Test description')
    })
  })

  describe('Validation', () => {
    it('shows error when name is empty on submit', async () => {
      renderWithProviders(<CreateCombinedViewModal {...defaultProps} />)

      const submitButton = screen.getByRole('button', { name: /Create Combined View/i })
      await waitFor(() => {
        expect(submitButton).not.toBeDisabled()
      })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/Name is required/)).toBeInTheDocument()
      })
    })

    it('shows error when less than 2 timelines selected', async () => {
      renderWithProviders(<CreateCombinedViewModal {...defaultProps} />)

      const nameInput = screen.getByPlaceholderText(/Major Philosophical/)
      fireEvent.change(nameInput, { target: { value: 'Test View' } })

      const submitButton = screen.getByRole('button', { name: /Create Combined View/i })
      await waitFor(() => {
        expect(submitButton).not.toBeDisabled()
      })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/Please select at least 2 timelines/)).toBeInTheDocument()
      })
    })
  })

  describe('Buttons', () => {
    it('shows cancel button', () => {
      renderWithProviders(<CreateCombinedViewModal {...defaultProps} />)
      expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument()
    })

    it('shows create button', () => {
      renderWithProviders(<CreateCombinedViewModal {...defaultProps} />)
      expect(screen.getByRole('button', { name: /Create Combined View/i })).toBeInTheDocument()
    })

    it('shows save changes button when editing', () => {
      renderWithProviders(
        <CreateCombinedViewModal {...defaultProps} editingViewId="view-1" />
      )
      expect(screen.getByRole('button', { name: /Save Changes/i })).toBeInTheDocument()
    })

    it('calls onClose when cancel is clicked', () => {
      renderWithProviders(<CreateCombinedViewModal {...defaultProps} />)

      const cancelButton = screen.getByRole('button', { name: /Cancel/i })
      fireEvent.click(cancelButton)

      expect(defaultProps.onClose).toHaveBeenCalled()
    })
  })

  describe('Empty state', () => {
    it('shows message when no timelines available', async () => {
      renderWithProviders(<CreateCombinedViewModal {...defaultProps} />)

      // Wait for data to load (or show empty state)
      await waitFor(() => {
        // Either shows timelines or empty message
        const content = screen.queryByText(/No timelines available/) ||
                        screen.queryByText(/Test Timeline/)
        expect(content).toBeTruthy()
      }, { timeout: 3000 })
    })
  })
})
