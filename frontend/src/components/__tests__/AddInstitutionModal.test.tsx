import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AddInstitutionModal } from '../AddInstitutionModal'

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

describe('AddInstitutionModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('renders when open', () => {
      renderWithProviders(<AddInstitutionModal {...defaultProps} />)
      expect(screen.getByRole('heading', { name: 'Add Institution' })).toBeInTheDocument()
    })

    it('does not render when closed', () => {
      renderWithProviders(
        <AddInstitutionModal {...defaultProps} isOpen={false} />
      )
      expect(screen.queryByRole('heading', { name: 'Add Institution' })).not.toBeInTheDocument()
    })

    it('shows edit title when editing', () => {
      const editInstitution = {
        id: 'inst-1',
        name: 'Harvard University',
        city: 'Cambridge',
        country: 'USA',
        latitude: null,
        longitude: null,
        founded_year: 1636,
        notes: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      }
      renderWithProviders(
        <AddInstitutionModal {...defaultProps} editInstitution={editInstitution} />
      )
      expect(screen.getByText('Edit Institution')).toBeInTheDocument()
    })
  })

  describe('Form fields', () => {
    it('shows name input', () => {
      renderWithProviders(<AddInstitutionModal {...defaultProps} />)
      expect(screen.getByLabelText(/Name \*/)).toBeInTheDocument()
    })

    it('shows city input', () => {
      renderWithProviders(<AddInstitutionModal {...defaultProps} />)
      expect(screen.getByLabelText(/City/)).toBeInTheDocument()
    })

    it('shows country input', () => {
      renderWithProviders(<AddInstitutionModal {...defaultProps} />)
      expect(screen.getByLabelText(/Country/)).toBeInTheDocument()
    })

    it('shows latitude input', () => {
      renderWithProviders(<AddInstitutionModal {...defaultProps} />)
      expect(screen.getByLabelText(/Latitude/)).toBeInTheDocument()
    })

    it('shows longitude input', () => {
      renderWithProviders(<AddInstitutionModal {...defaultProps} />)
      expect(screen.getByLabelText(/Longitude/)).toBeInTheDocument()
    })

    it('shows founded year input', () => {
      renderWithProviders(<AddInstitutionModal {...defaultProps} />)
      expect(screen.getByLabelText(/Founded Year/)).toBeInTheDocument()
    })

    it('shows notes textarea', () => {
      renderWithProviders(<AddInstitutionModal {...defaultProps} />)
      expect(screen.getByLabelText(/Notes/)).toBeInTheDocument()
    })
  })

  describe('Form interactions', () => {
    it('allows entering institution name', () => {
      renderWithProviders(<AddInstitutionModal {...defaultProps} />)

      const input = screen.getByLabelText(/Name \*/) as HTMLInputElement
      fireEvent.change(input, { target: { value: 'MIT' } })
      expect(input.value).toBe('MIT')
    })

    it('allows entering city', () => {
      renderWithProviders(<AddInstitutionModal {...defaultProps} />)

      const input = screen.getByLabelText(/City/) as HTMLInputElement
      fireEvent.change(input, { target: { value: 'Cambridge' } })
      expect(input.value).toBe('Cambridge')
    })

    it('allows entering country', () => {
      renderWithProviders(<AddInstitutionModal {...defaultProps} />)

      const input = screen.getByLabelText(/Country/) as HTMLInputElement
      fireEvent.change(input, { target: { value: 'USA' } })
      expect(input.value).toBe('USA')
    })

    it('allows entering latitude', () => {
      renderWithProviders(<AddInstitutionModal {...defaultProps} />)

      const input = screen.getByLabelText(/Latitude/) as HTMLInputElement
      fireEvent.change(input, { target: { value: '42.3601' } })
      expect(input.value).toBe('42.3601')
    })

    it('allows entering longitude', () => {
      renderWithProviders(<AddInstitutionModal {...defaultProps} />)

      const input = screen.getByLabelText(/Longitude/) as HTMLInputElement
      fireEvent.change(input, { target: { value: '-71.0589' } })
      expect(input.value).toBe('-71.0589')
    })

    it('allows entering founded year', () => {
      renderWithProviders(<AddInstitutionModal {...defaultProps} />)

      const input = screen.getByLabelText(/Founded Year/) as HTMLInputElement
      fireEvent.change(input, { target: { value: '1861' } })
      expect(input.value).toBe('1861')
    })

    it('allows entering notes', () => {
      renderWithProviders(<AddInstitutionModal {...defaultProps} />)

      const textarea = screen.getByLabelText(/Notes/) as HTMLTextAreaElement
      fireEvent.change(textarea, { target: { value: 'Important research institution' } })
      expect(textarea.value).toBe('Important research institution')
    })
  })

  describe('Validation', () => {
    it('shows error when name is empty on submit', async () => {
      renderWithProviders(<AddInstitutionModal {...defaultProps} />)

      const submitButton = screen.getByRole('button', { name: /Add Institution/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/Name is required/)).toBeInTheDocument()
      })
    })
  })

  describe('Edit mode', () => {
    it('populates form with existing data', () => {
      const editInstitution = {
        id: 'inst-1',
        name: 'Harvard University',
        city: 'Cambridge',
        country: 'USA',
        latitude: 42.3736,
        longitude: -71.1097,
        founded_year: 1636,
        notes: 'Ivy League',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      }

      renderWithProviders(
        <AddInstitutionModal {...defaultProps} editInstitution={editInstitution} />
      )

      expect(screen.getByDisplayValue('Harvard University')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Cambridge')).toBeInTheDocument()
      expect(screen.getByDisplayValue('USA')).toBeInTheDocument()
      expect(screen.getByDisplayValue('1636')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Ivy League')).toBeInTheDocument()
    })

    it('shows update button when editing', () => {
      const editInstitution = {
        id: 'inst-1',
        name: 'Harvard',
        city: null,
        country: null,
        latitude: null,
        longitude: null,
        founded_year: null,
        notes: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      }

      renderWithProviders(
        <AddInstitutionModal {...defaultProps} editInstitution={editInstitution} />
      )

      expect(screen.getByRole('button', { name: /Update Institution/i })).toBeInTheDocument()
    })
  })

  describe('Buttons', () => {
    it('shows cancel button', () => {
      renderWithProviders(<AddInstitutionModal {...defaultProps} />)
      expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument()
    })

    it('calls onClose when cancel is clicked', () => {
      renderWithProviders(<AddInstitutionModal {...defaultProps} />)

      const cancelButton = screen.getByRole('button', { name: /Cancel/i })
      fireEvent.click(cancelButton)

      expect(defaultProps.onClose).toHaveBeenCalled()
    })
  })
})
