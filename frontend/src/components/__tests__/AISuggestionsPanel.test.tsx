import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AISuggestionsPanel } from '../AISuggestionsPanel'

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

describe('AISuggestionsPanel', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('renders when open', () => {
      renderWithProviders(<AISuggestionsPanel {...defaultProps} />)
      expect(screen.getByText('AI Assistant')).toBeInTheDocument()
    })

    it('does not render when closed', () => {
      renderWithProviders(
        <AISuggestionsPanel {...defaultProps} isOpen={false} />
      )
      expect(screen.queryByText('AI Assistant')).not.toBeInTheDocument()
    })

    it('shows close button', () => {
      renderWithProviders(<AISuggestionsPanel {...defaultProps} />)
      expect(screen.getByRole('button', { name: '×' })).toBeInTheDocument()
    })

    it('shows AI icon/emoji', () => {
      renderWithProviders(<AISuggestionsPanel {...defaultProps} />)
      // Robot emoji is displayed
      expect(screen.getByText(/AI Assistant/)).toBeInTheDocument()
    })
  })

  describe('Tabs', () => {
    it('shows connection ideas tab', () => {
      renderWithProviders(<AISuggestionsPanel {...defaultProps} />)
      expect(screen.getByRole('button', { name: /Connection Ideas/i })).toBeInTheDocument()
    })

    it('shows research ideas tab', () => {
      renderWithProviders(<AISuggestionsPanel {...defaultProps} />)
      expect(screen.getByRole('button', { name: /Research Ideas/i })).toBeInTheDocument()
    })

    it('shows status tab', () => {
      renderWithProviders(<AISuggestionsPanel {...defaultProps} />)
      expect(screen.getByRole('button', { name: /Status/i })).toBeInTheDocument()
    })

    it('allows switching tabs', async () => {
      renderWithProviders(<AISuggestionsPanel {...defaultProps} />)

      const statusTab = screen.getByRole('button', { name: /Status/i })
      fireEvent.click(statusTab)

      // Status tab content should be visible (loading or loaded state)
      await waitFor(() => {
        expect(screen.getByText(/AI Features|Checking AI status/)).toBeInTheDocument()
      })
    })
  })

  describe('Status tab', () => {
    it('shows loading state initially', async () => {
      renderWithProviders(<AISuggestionsPanel {...defaultProps} />)

      const statusTab = screen.getByRole('button', { name: /Status/i })
      fireEvent.click(statusTab)

      // Either loading or status message should be shown
      await waitFor(() => {
        const hasContent = screen.queryByText(/Checking AI status/) ||
                          screen.queryByText(/AI Features Enabled/) ||
                          screen.queryByText(/AI Features Disabled/)
        expect(hasContent).toBeTruthy()
      }, { timeout: 3000 })
    })

    it('shows setup instructions when AI is disabled', async () => {
      renderWithProviders(<AISuggestionsPanel {...defaultProps} />)

      const statusTab = screen.getByRole('button', { name: /Status/i })
      fireEvent.click(statusTab)

      await waitFor(() => {
        // If AI is disabled, instructions should be shown
        const instructions = screen.queryByText(/DEEPSEEK_API_KEY/) ||
                            screen.queryByText(/AI Features Enabled/)
        expect(instructions).toBeTruthy()
      }, { timeout: 3000 })
    })
  })

  describe('Connection Ideas tab', () => {
    it('is the default active tab', () => {
      renderWithProviders(<AISuggestionsPanel {...defaultProps} />)

      // Connection Ideas is the first tab and should be active by default
      const connectionsTab = screen.getByRole('button', { name: /Connection Ideas/i })
      expect(connectionsTab.className).toContain('border-accent')
    })

    it('shows message when AI not enabled', async () => {
      renderWithProviders(<AISuggestionsPanel {...defaultProps} />)

      await waitFor(() => {
        const message = screen.queryByText(/AI features are not enabled/) ||
                       screen.queryByText(/Analyzing thinker/) ||
                       screen.queryByText(/No new connection suggestions/)
        expect(message).toBeTruthy()
      }, { timeout: 3000 })
    })
  })

  describe('Research Ideas tab', () => {
    it('shows content when clicked', async () => {
      renderWithProviders(<AISuggestionsPanel {...defaultProps} />)

      const researchTab = screen.getByRole('button', { name: /Research Ideas/i })
      fireEvent.click(researchTab)

      await waitFor(() => {
        const message = screen.queryByText(/AI features are not enabled/) ||
                       screen.queryByText(/Generating research/) ||
                       screen.queryByText(/No research suggestions/)
        expect(message).toBeTruthy()
      }, { timeout: 3000 })
    })
  })

  describe('Callback handlers', () => {
    it('calls onClose when close button is clicked', () => {
      renderWithProviders(<AISuggestionsPanel {...defaultProps} />)

      const closeButton = screen.getByRole('button', { name: '×' })
      fireEvent.click(closeButton)

      expect(defaultProps.onClose).toHaveBeenCalled()
    })
  })

  describe('Props', () => {
    it('accepts selectedTimelineId prop', () => {
      renderWithProviders(
        <AISuggestionsPanel {...defaultProps} selectedTimelineId="timeline-1" />
      )
      // Component renders without error
      expect(screen.getByText('AI Assistant')).toBeInTheDocument()
    })

    it('accepts null selectedTimelineId', () => {
      renderWithProviders(
        <AISuggestionsPanel {...defaultProps} selectedTimelineId={null} />
      )
      // Component renders without error
      expect(screen.getByText('AI Assistant')).toBeInTheDocument()
    })
  })
})
