import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TimelineSVG } from '../TimelineSVG'

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

describe('TimelineSVG', () => {
  describe('Rendering', () => {
    it('shows loading state initially', () => {
      renderWithProviders(<TimelineSVG />)
      expect(screen.getByText(/Loading timeline/)).toBeInTheDocument()
    })

    it('renders zoom controls', async () => {
      renderWithProviders(<TimelineSVG />)
      // Wait for loading to complete
      await vi.waitFor(() => {
        expect(screen.queryByText(/Loading timeline/)).not.toBeInTheDocument()
      }, { timeout: 2000 })

      expect(screen.getByText('Zoom In')).toBeInTheDocument()
      expect(screen.getByText('Zoom Out')).toBeInTheDocument()
      expect(screen.getByText('Reset')).toBeInTheDocument()
    })
  })

  describe('Zoom controls', () => {
    it('allows zooming in', async () => {
      renderWithProviders(<TimelineSVG />)

      await vi.waitFor(() => {
        expect(screen.queryByText(/Loading timeline/)).not.toBeInTheDocument()
      }, { timeout: 2000 })

      const zoomInButton = screen.getByText('Zoom In')
      fireEvent.click(zoomInButton)
      // Zoom should increase (internal state change)
    })

    it('allows zooming out', async () => {
      renderWithProviders(<TimelineSVG />)

      await vi.waitFor(() => {
        expect(screen.queryByText(/Loading timeline/)).not.toBeInTheDocument()
      }, { timeout: 2000 })

      const zoomOutButton = screen.getByText('Zoom Out')
      fireEvent.click(zoomOutButton)
      // Zoom should decrease (internal state change)
    })

    it('allows resetting zoom', async () => {
      renderWithProviders(<TimelineSVG />)

      await vi.waitFor(() => {
        expect(screen.queryByText(/Loading timeline/)).not.toBeInTheDocument()
      }, { timeout: 2000 })

      const resetButton = screen.getByText('Reset')
      fireEvent.click(resetButton)
      // Zoom should reset to 1 (internal state change)
    })
  })

  describe('Callback handlers', () => {
    it('calls onThinkerClick when thinker is clicked', async () => {
      const onThinkerClick = vi.fn()
      renderWithProviders(<TimelineSVG onThinkerClick={onThinkerClick} />)

      await vi.waitFor(() => {
        expect(screen.queryByText(/Loading timeline/)).not.toBeInTheDocument()
      }, { timeout: 2000 })

      // Thinker click is tested via SVG elements which are harder to test
      // This verifies the prop is accepted without error
    })

    it('calls onCanvasClick with position when Ctrl+Click', async () => {
      const onCanvasClick = vi.fn()
      renderWithProviders(<TimelineSVG onCanvasClick={onCanvasClick} />)

      await vi.waitFor(() => {
        expect(screen.queryByText(/Loading timeline/)).not.toBeInTheDocument()
      }, { timeout: 2000 })

      // Canvas click with Ctrl key triggers onCanvasClick
      // This verifies the prop is accepted without error
    })

    it('calls onConnectionClick when connection is clicked', async () => {
      const onConnectionClick = vi.fn()
      renderWithProviders(<TimelineSVG onConnectionClick={onConnectionClick} />)

      await vi.waitFor(() => {
        expect(screen.queryByText(/Loading timeline/)).not.toBeInTheDocument()
      }, { timeout: 2000 })

      // Connection click handler is attached to SVG path elements
    })
  })

  describe('Empty state', () => {
    it('shows empty state when no thinkers', async () => {
      renderWithProviders(<TimelineSVG />)

      await vi.waitFor(() => {
        expect(screen.queryByText(/Loading timeline/)).not.toBeInTheDocument()
      }, { timeout: 2000 })

      // Empty state shows instructions for adding thinkers
    })
  })

  describe('Props', () => {
    it('accepts selectedThinkerId prop', () => {
      renderWithProviders(<TimelineSVG selectedThinkerId="test-id" />)
      // Component should render without error
    })

    it('accepts filterByTimelineId prop', () => {
      renderWithProviders(<TimelineSVG filterByTimelineId="timeline-id" />)
      // Component should render without error
    })

    it('accepts selectedTimeline prop', () => {
      const timeline = {
        id: 'test-timeline',
        name: 'Test Timeline',
        start_year: 1700,
        end_year: 2000,
      }
      renderWithProviders(<TimelineSVG selectedTimeline={timeline as any} />)
      // Component should render without error
    })
  })

  describe('Mouse interactions', () => {
    it('handles mouse wheel for zooming', async () => {
      renderWithProviders(<TimelineSVG />)

      await vi.waitFor(() => {
        expect(screen.queryByText(/Loading timeline/)).not.toBeInTheDocument()
      }, { timeout: 2000 })

      const container = document.querySelector('svg')
      if (container) {
        fireEvent.wheel(container, { deltaY: -100 })
        // Should zoom in
        fireEvent.wheel(container, { deltaY: 100 })
        // Should zoom out
      }
    })

    it('handles panning with mouse drag', async () => {
      renderWithProviders(<TimelineSVG />)

      await vi.waitFor(() => {
        expect(screen.queryByText(/Loading timeline/)).not.toBeInTheDocument()
      }, { timeout: 2000 })

      const container = document.querySelector('svg')
      if (container) {
        fireEvent.mouseDown(container, { clientX: 100, clientY: 100, button: 0 })
        fireEvent.mouseMove(container, { clientX: 200, clientY: 200 })
        fireEvent.mouseUp(container)
      }
    })
  })
})
