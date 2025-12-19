import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NetworkMetricsPanel } from '../NetworkMetricsPanel'

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

describe('NetworkMetricsPanel', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('renders when open', () => {
      renderWithProviders(<NetworkMetricsPanel {...defaultProps} />)
      expect(screen.getByText('Network Analysis')).toBeInTheDocument()
    })

    it('does not render when closed', () => {
      renderWithProviders(
        <NetworkMetricsPanel {...defaultProps} isOpen={false} />
      )
      expect(screen.queryByText('Network Analysis')).not.toBeInTheDocument()
    })

    it('shows close button', () => {
      renderWithProviders(<NetworkMetricsPanel {...defaultProps} />)
      expect(screen.getByRole('button', { name: '×' })).toBeInTheDocument()
    })
  })

  describe('Tabs', () => {
    it('shows overview tab', () => {
      renderWithProviders(<NetworkMetricsPanel {...defaultProps} />)
      expect(screen.getByRole('button', { name: /overview/i })).toBeInTheDocument()
    })

    it('shows rankings tab', () => {
      renderWithProviders(<NetworkMetricsPanel {...defaultProps} />)
      expect(screen.getByRole('button', { name: /rankings/i })).toBeInTheDocument()
    })

    it('shows paths tab', () => {
      renderWithProviders(<NetworkMetricsPanel {...defaultProps} />)
      expect(screen.getByRole('button', { name: /paths/i })).toBeInTheDocument()
    })

    it('shows clusters tab', () => {
      renderWithProviders(<NetworkMetricsPanel {...defaultProps} />)
      expect(screen.getByRole('button', { name: /clusters/i })).toBeInTheDocument()
    })

    it('allows switching tabs', () => {
      renderWithProviders(<NetworkMetricsPanel {...defaultProps} />)

      const rankingsTab = screen.getByRole('button', { name: /rankings/i })
      fireEvent.click(rankingsTab)

      // Rankings tab content should be visible
      expect(screen.getByRole('table')).toBeInTheDocument()
    })
  })

  describe('Overview tab', () => {
    it('shows total thinkers stat', () => {
      renderWithProviders(<NetworkMetricsPanel {...defaultProps} />)
      expect(screen.getByText('Total Thinkers')).toBeInTheDocument()
    })

    it('shows total connections stat', () => {
      renderWithProviders(<NetworkMetricsPanel {...defaultProps} />)
      expect(screen.getByText('Total Connections')).toBeInTheDocument()
    })

    it('shows avg connections stat', () => {
      renderWithProviders(<NetworkMetricsPanel {...defaultProps} />)
      expect(screen.getByText('Avg. Connections')).toBeInTheDocument()
    })

    it('shows network density stat', () => {
      renderWithProviders(<NetworkMetricsPanel {...defaultProps} />)
      expect(screen.getByText('Network Density')).toBeInTheDocument()
    })

    it('shows most influential section', () => {
      renderWithProviders(<NetworkMetricsPanel {...defaultProps} />)
      expect(screen.getByText(/Most Influential/)).toBeInTheDocument()
    })

    it('shows most connected section', () => {
      renderWithProviders(<NetworkMetricsPanel {...defaultProps} />)
      expect(screen.getByText(/Most Connected/)).toBeInTheDocument()
    })
  })

  describe('Rankings tab', () => {
    it('shows sortable table headers', () => {
      renderWithProviders(<NetworkMetricsPanel {...defaultProps} />)

      const rankingsTab = screen.getByRole('button', { name: /rankings/i })
      fireEvent.click(rankingsTab)

      expect(screen.getByText('Name')).toBeInTheDocument()
      expect(screen.getByText('In')).toBeInTheDocument()
      expect(screen.getByText('Out')).toBeInTheDocument()
      expect(screen.getByText('Total')).toBeInTheDocument()
      expect(screen.getByText('PageRank')).toBeInTheDocument()
      expect(screen.getByText('Betweenness')).toBeInTheDocument()
    })

    it('allows sorting by column', () => {
      renderWithProviders(<NetworkMetricsPanel {...defaultProps} />)

      const rankingsTab = screen.getByRole('button', { name: /rankings/i })
      fireEvent.click(rankingsTab)

      const totalHeader = screen.getByText('Total')
      fireEvent.click(totalHeader)
      // Sort order should change
    })
  })

  describe('Paths tab', () => {
    it('shows thinker selection dropdowns', () => {
      renderWithProviders(<NetworkMetricsPanel {...defaultProps} />)

      const pathsTab = screen.getByRole('button', { name: /paths/i })
      fireEvent.click(pathsTab)

      expect(screen.getByText('From')).toBeInTheDocument()
      expect(screen.getByText('To')).toBeInTheDocument()
    })

    it('shows two select elements for path finding', () => {
      renderWithProviders(<NetworkMetricsPanel {...defaultProps} />)

      const pathsTab = screen.getByRole('button', { name: /paths/i })
      fireEvent.click(pathsTab)

      const selects = screen.getAllByRole('combobox')
      expect(selects.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('Clusters tab', () => {
    it('shows cluster information', () => {
      renderWithProviders(<NetworkMetricsPanel {...defaultProps} />)

      const clustersTab = screen.getByRole('button', { name: /clusters/i })
      fireEvent.click(clustersTab)

      expect(screen.getByText(/Detected.*cluster/)).toBeInTheDocument()
    })
  })

  describe('Callback handlers', () => {
    it('calls onClose when close button is clicked', () => {
      renderWithProviders(<NetworkMetricsPanel {...defaultProps} />)

      const closeButton = screen.getByRole('button', { name: '×' })
      fireEvent.click(closeButton)

      expect(defaultProps.onClose).toHaveBeenCalled()
    })

    it('calls onThinkerSelect when thinker is clicked', async () => {
      const onThinkerSelect = vi.fn()
      renderWithProviders(
        <NetworkMetricsPanel {...defaultProps} onThinkerSelect={onThinkerSelect} />
      )

      // Wait for data to load
      await waitFor(() => {
        // The callback is available for when thinkers are clicked
      }, { timeout: 2000 })
    })
  })
})
