import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AddAffiliationModal } from '../AddAffiliationModal'

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

describe('AddAffiliationModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    thinkerId: 'thinker-123',
    thinkerName: 'Immanuel Kant',
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('renders when open', () => {
      renderWithProviders(<AddAffiliationModal {...defaultProps} />)
      expect(screen.getByText(/Add Affiliation for Immanuel Kant/)).toBeInTheDocument()
    })

    it('does not render when closed', () => {
      renderWithProviders(
        <AddAffiliationModal {...defaultProps} isOpen={false} />
      )
      expect(screen.queryByText(/Add Affiliation/)).not.toBeInTheDocument()
    })

    it('shows edit title when editing', () => {
      const editAffiliation = {
        id: 'aff-1',
        thinker_id: 'thinker-123',
        institution_id: 'inst-1',
        role: 'Professor',
        department: 'Philosophy',
        start_year: 1755,
        end_year: 1804,
        is_phd_institution: false,
        phd_advisor_id: null,
        notes: null,
        institution: { id: 'inst-1', name: 'University of Königsberg' },
      }
      renderWithProviders(
        <AddAffiliationModal {...defaultProps} editAffiliation={editAffiliation as any} />
      )
      expect(screen.getByText('Edit Affiliation')).toBeInTheDocument()
    })
  })

  describe('Form fields', () => {
    it('shows institution select', () => {
      renderWithProviders(<AddAffiliationModal {...defaultProps} />)
      expect(screen.getByLabelText(/Institution \*/)).toBeInTheDocument()
    })

    it('shows role input', () => {
      renderWithProviders(<AddAffiliationModal {...defaultProps} />)
      expect(screen.getByLabelText(/Role/)).toBeInTheDocument()
    })

    it('shows department input', () => {
      renderWithProviders(<AddAffiliationModal {...defaultProps} />)
      expect(screen.getByLabelText(/Department/)).toBeInTheDocument()
    })

    it('shows start year input', () => {
      renderWithProviders(<AddAffiliationModal {...defaultProps} />)
      expect(screen.getByLabelText(/Start Year/)).toBeInTheDocument()
    })

    it('shows end year input', () => {
      renderWithProviders(<AddAffiliationModal {...defaultProps} />)
      expect(screen.getByLabelText(/End Year/)).toBeInTheDocument()
    })

    it('shows PhD institution checkbox', () => {
      renderWithProviders(<AddAffiliationModal {...defaultProps} />)
      expect(screen.getByLabelText(/PhD Institution/)).toBeInTheDocument()
    })

    it('shows notes textarea', () => {
      renderWithProviders(<AddAffiliationModal {...defaultProps} />)
      expect(screen.getByLabelText(/Notes/)).toBeInTheDocument()
    })
  })

  describe('Form interactions', () => {
    it('allows entering role', () => {
      renderWithProviders(<AddAffiliationModal {...defaultProps} />)

      const input = screen.getByLabelText(/Role/) as HTMLInputElement
      fireEvent.change(input, { target: { value: 'Professor' } })
      expect(input.value).toBe('Professor')
    })

    it('allows entering department', () => {
      renderWithProviders(<AddAffiliationModal {...defaultProps} />)

      const input = screen.getByLabelText(/Department/) as HTMLInputElement
      fireEvent.change(input, { target: { value: 'Philosophy' } })
      expect(input.value).toBe('Philosophy')
    })

    it('allows entering start year', () => {
      renderWithProviders(<AddAffiliationModal {...defaultProps} />)

      const input = screen.getByLabelText(/Start Year/) as HTMLInputElement
      fireEvent.change(input, { target: { value: '1770' } })
      expect(input.value).toBe('1770')
    })

    it('allows entering end year', () => {
      renderWithProviders(<AddAffiliationModal {...defaultProps} />)

      const input = screen.getByLabelText(/End Year/) as HTMLInputElement
      fireEvent.change(input, { target: { value: '1831' } })
      expect(input.value).toBe('1831')
    })

    it('allows toggling PhD institution checkbox', () => {
      renderWithProviders(<AddAffiliationModal {...defaultProps} />)

      const checkbox = screen.getByLabelText(/PhD Institution/) as HTMLInputElement
      expect(checkbox.checked).toBe(false)

      fireEvent.click(checkbox)
      expect(checkbox.checked).toBe(true)
    })

    it('shows PhD advisor select when PhD institution is checked', () => {
      renderWithProviders(<AddAffiliationModal {...defaultProps} />)

      const checkbox = screen.getByLabelText(/PhD Institution/)
      fireEvent.click(checkbox)

      expect(screen.getByLabelText(/PhD Advisor/)).toBeInTheDocument()
    })

    it('allows entering notes', () => {
      renderWithProviders(<AddAffiliationModal {...defaultProps} />)

      const textarea = screen.getByLabelText(/Notes/) as HTMLTextAreaElement
      fireEvent.change(textarea, { target: { value: 'Important affiliation' } })
      expect(textarea.value).toBe('Important affiliation')
    })
  })

  describe('Validation', () => {
    it('shows error when institution is not selected', async () => {
      renderWithProviders(<AddAffiliationModal {...defaultProps} />)

      const submitButton = screen.getByRole('button', { name: /Add Affiliation/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/Institution is required/)).toBeInTheDocument()
      })
    })
  })

  describe('Buttons', () => {
    it('shows cancel button', () => {
      renderWithProviders(<AddAffiliationModal {...defaultProps} />)
      expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument()
    })

    it('shows add button', () => {
      renderWithProviders(<AddAffiliationModal {...defaultProps} />)
      expect(screen.getByRole('button', { name: /Add Affiliation/i })).toBeInTheDocument()
    })

    it('calls onClose when cancel is clicked', () => {
      renderWithProviders(<AddAffiliationModal {...defaultProps} />)

      const cancelButton = screen.getByRole('button', { name: /Cancel/i })
      fireEvent.click(cancelButton)

      expect(defaultProps.onClose).toHaveBeenCalled()
    })
  })

  describe('Edit mode', () => {
    it('shows update button when editing', () => {
      const editAffiliation = {
        id: 'aff-1',
        thinker_id: 'thinker-123',
        institution_id: 'inst-1',
        role: 'Professor',
        department: null,
        start_year: null,
        end_year: null,
        is_phd_institution: false,
        phd_advisor_id: null,
        notes: null,
        institution: { id: 'inst-1', name: 'Test University' },
      }

      renderWithProviders(
        <AddAffiliationModal {...defaultProps} editAffiliation={editAffiliation as any} />
      )

      expect(screen.getByRole('button', { name: /Update Affiliation/i })).toBeInTheDocument()
    })
  })
})
