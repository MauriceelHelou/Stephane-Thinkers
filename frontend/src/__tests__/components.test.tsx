/**
 * Tests for React components
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Test utilities
function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })
}

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = createTestQueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  )
}

// Mock components for testing in isolation
describe('Component Tests', () => {
  describe('ConnectionLegend', () => {
    it('should render connection types', async () => {
      const { ConnectionLegend } = await import('@/components/ConnectionLegend')
      const mockOnToggle = vi.fn()
      const mockOnToggleAll = vi.fn()

      renderWithProviders(
        <ConnectionLegend
          visibleTypes={['influenced', 'critiqued', 'built_upon', 'synthesized']}
          onToggleType={mockOnToggle}
          onToggleAll={mockOnToggleAll}
        />
      )

      expect(screen.getByText('Influenced')).toBeInTheDocument()
      expect(screen.getByText('Critiqued')).toBeInTheDocument()
      expect(screen.getByText('Built Upon')).toBeInTheDocument()
      expect(screen.getByText('Synthesized')).toBeInTheDocument()
    })

    it('should call onToggleType when checkbox clicked', async () => {
      const { ConnectionLegend } = await import('@/components/ConnectionLegend')
      const mockOnToggle = vi.fn()
      const mockOnToggleAll = vi.fn()

      renderWithProviders(
        <ConnectionLegend
          visibleTypes={['influenced', 'critiqued', 'built_upon', 'synthesized']}
          onToggleType={mockOnToggle}
          onToggleAll={mockOnToggleAll}
        />
      )

      const checkboxes = screen.getAllByRole('checkbox')
      await userEvent.click(checkboxes[0])

      expect(mockOnToggle).toHaveBeenCalled()
    })
  })

  describe('NetworkMetricsPanel', () => {
    it('should not render when closed', async () => {
      const { NetworkMetricsPanel } = await import('@/components/NetworkMetricsPanel')

      const { container } = renderWithProviders(
        <NetworkMetricsPanel
          isOpen={false}
          onClose={vi.fn()}
        />
      )

      expect(container.firstChild).toBeNull()
    })

    it('should render when open', async () => {
      const { NetworkMetricsPanel } = await import('@/components/NetworkMetricsPanel')

      renderWithProviders(
        <NetworkMetricsPanel
          isOpen={true}
          onClose={vi.fn()}
        />
      )

      // Should render the panel title
      expect(screen.getByText('Network Analysis')).toBeInTheDocument()
    })

    it('should call onClose when close button clicked', async () => {
      const { NetworkMetricsPanel } = await import('@/components/NetworkMetricsPanel')
      const mockOnClose = vi.fn()

      renderWithProviders(
        <NetworkMetricsPanel
          isOpen={true}
          onClose={mockOnClose}
        />
      )

      const closeButton = screen.getByText('×')
      await userEvent.click(closeButton)

      expect(mockOnClose).toHaveBeenCalled()
    })
  })

  describe('TimelineAnimationControls', () => {
    it('should render play button with title', async () => {
      const { TimelineAnimationControls } = await import('@/components/TimelineAnimationControls')

      renderWithProviders(
        <TimelineAnimationControls
          startYear={1800}
          endYear={2000}
          currentYear={null}
          isPlaying={false}
          speed={2}
          onPlayPauseToggle={vi.fn()}
          onSpeedChange={vi.fn()}
          onYearChange={vi.fn()}
        />
      )

      // Button uses title attribute instead of text
      expect(screen.getByTitle('Play')).toBeInTheDocument()
    })

    it('should show pause button when playing', async () => {
      const { TimelineAnimationControls } = await import('@/components/TimelineAnimationControls')

      renderWithProviders(
        <TimelineAnimationControls
          startYear={1800}
          endYear={2000}
          currentYear={1900}
          isPlaying={true}
          speed={2}
          onPlayPauseToggle={vi.fn()}
          onSpeedChange={vi.fn()}
          onYearChange={vi.fn()}
        />
      )

      // Button uses title attribute instead of text
      expect(screen.getByTitle('Pause')).toBeInTheDocument()
    })

    it('should display current year', async () => {
      const { TimelineAnimationControls } = await import('@/components/TimelineAnimationControls')

      renderWithProviders(
        <TimelineAnimationControls
          startYear={1800}
          endYear={2000}
          currentYear={1950}
          isPlaying={true}
          speed={2}
          onPlayPauseToggle={vi.fn()}
          onSpeedChange={vi.fn()}
          onYearChange={vi.fn()}
        />
      )

      expect(screen.getByText('1950')).toBeInTheDocument()
    })
  })

  describe('AISuggestionsPanel', () => {
    it('should render tabs when open', async () => {
      const { AISuggestionsPanel } = await import('@/components/AISuggestionsPanel')
      
      renderWithProviders(
        <AISuggestionsPanel
          isOpen={true}
          onClose={vi.fn()}
        />
      )
      
      expect(screen.getByText('Connection Ideas')).toBeInTheDocument()
      expect(screen.getByText('Research Ideas')).toBeInTheDocument()
      expect(screen.getByText('Status')).toBeInTheDocument()
    })

    it('should not render when closed', async () => {
      const { AISuggestionsPanel } = await import('@/components/AISuggestionsPanel')
      
      const { container } = renderWithProviders(
        <AISuggestionsPanel
          isOpen={false}
          onClose={vi.fn()}
        />
      )
      
      expect(container.firstChild).toBeNull()
    })

    it('should show AI Assistant title', async () => {
      const { AISuggestionsPanel } = await import('@/components/AISuggestionsPanel')
      
      renderWithProviders(
        <AISuggestionsPanel
          isOpen={true}
          onClose={vi.fn()}
        />
      )
      
      expect(screen.getByText('AI Assistant')).toBeInTheDocument()
    })
  })

  describe('TimelineComparisonView', () => {
    it('should render when open', async () => {
      const { TimelineComparisonView } = await import('@/components/TimelineComparisonView')

      renderWithProviders(
        <TimelineComparisonView
          isOpen={true}
          onClose={vi.fn()}
        />
      )

      expect(screen.getByText('Timeline Comparison')).toBeInTheDocument()
    })

    it('should not render when closed', async () => {
      const { TimelineComparisonView } = await import('@/components/TimelineComparisonView')

      const { container } = renderWithProviders(
        <TimelineComparisonView
          isOpen={false}
          onClose={vi.fn()}
        />
      )

      expect(container.firstChild).toBeNull()
    })
  })
})

describe('Network Metrics Utilities', () => {
  it('should calculate all metrics correctly', async () => {
    const { calculateAllMetrics } = await import('@/lib/networkMetrics')

    const thinkers = [
      { id: 't1', name: 'A' },
      { id: 't2', name: 'B' },
      { id: 't3', name: 'C' }
    ] as any[]

    const connections = [
      { from_thinker_id: 't1', to_thinker_id: 't2' },
      { from_thinker_id: 't2', to_thinker_id: 't3' },
      { from_thinker_id: 't3', to_thinker_id: 't1' }
    ] as any[]

    const metrics = calculateAllMetrics(thinkers, connections)

    expect(metrics.length).toBe(3)
    expect(metrics[0]).toHaveProperty('thinkerId')
    expect(metrics[0]).toHaveProperty('pageRank')
  })

  it('should find shortest path', async () => {
    const { findShortestPath } = await import('@/lib/networkMetrics')

    const thinkers = [
      { id: 't1', name: 'A' },
      { id: 't2', name: 'B' },
      { id: 't3', name: 'C' }
    ] as any[]

    const connections = [
      { from_thinker_id: 't1', to_thinker_id: 't2' },
      { from_thinker_id: 't2', to_thinker_id: 't3' }
    ] as any[]

    const result = findShortestPath('t1', 't3', thinkers, connections)

    expect(result).not.toBeNull()
    expect(result?.path).toEqual(['t1', 't2', 't3'])
    expect(result?.length).toBe(2)
  })

  it('should return null for unreachable nodes', async () => {
    const { findShortestPath } = await import('@/lib/networkMetrics')

    const thinkers = [
      { id: 't1', name: 'A' },
      { id: 't2', name: 'B' }
    ] as any[]

    const connections: any[] = []

    const result = findShortestPath('t1', 't2', thinkers, connections)

    expect(result).toBeNull()
  })

  it('should calculate network stats', async () => {
    const { calculateNetworkStats } = await import('@/lib/networkMetrics')

    const thinkers = [
      { id: 't1', name: 'A' },
      { id: 't2', name: 'B' }
    ] as any[]

    const connections = [
      { from_thinker_id: 't1', to_thinker_id: 't2' }
    ] as any[]

    const stats = calculateNetworkStats(thinkers, connections)

    expect(stats).toHaveProperty('totalThinkers')
    expect(stats).toHaveProperty('totalConnections')
    expect(stats).toHaveProperty('averageDegree')
    expect(stats).toHaveProperty('networkDensity')
    expect(stats.totalThinkers).toBe(2)
    expect(stats.totalConnections).toBe(1)
  })

  it('should detect clusters', async () => {
    const { detectClusters } = await import('@/lib/networkMetrics')

    const thinkers = [
      { id: 't1', name: 'A' },
      { id: 't2', name: 'B' },
      { id: 't3', name: 'C' }
    ] as any[]

    const connections = [
      { from_thinker_id: 't1', to_thinker_id: 't2', bidirectional: true },
      { from_thinker_id: 't2', to_thinker_id: 't3', bidirectional: true }
    ] as any[]

    const clusters = detectClusters(thinkers, connections)

    expect(clusters instanceof Map).toBe(true)
    expect(clusters.size).toBe(3)
  })
})

describe('Connection Styles', () => {
  it('should have all connection types defined', async () => {
    const { CONNECTION_STYLES } = await import('@/lib/constants')
    
    expect(CONNECTION_STYLES.influenced).toBeDefined()
    expect(CONNECTION_STYLES.critiqued).toBeDefined()
    expect(CONNECTION_STYLES.built_upon).toBeDefined()
    expect(CONNECTION_STYLES.synthesized).toBeDefined()
  })

  it('should have colors for each type', async () => {
    const { CONNECTION_STYLES } = await import('@/lib/constants')
    
    expect(CONNECTION_STYLES.influenced.color).toBeDefined()
    expect(CONNECTION_STYLES.critiqued.color).toBeDefined()
    expect(CONNECTION_STYLES.built_upon.color).toBeDefined()
    expect(CONNECTION_STYLES.synthesized.color).toBeDefined()
  })

  it('should calculate line width from strength', async () => {
    const { getConnectionLineWidth } = await import('@/lib/constants')
    
    // Strength 1 should give minimum width
    expect(getConnectionLineWidth(1)).toBeGreaterThan(0)
    
    // Strength 5 should give maximum width
    expect(getConnectionLineWidth(5)).toBeGreaterThan(getConnectionLineWidth(1))
    
    // Default when null
    expect(getConnectionLineWidth(null)).toBeDefined()
  })
})
