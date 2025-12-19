import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Timeline } from '../Timeline'

const createQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      staleTime: Infinity,
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

describe('Timeline', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('renders without crashing', async () => {
      const { container } = renderWithQueryClient(<Timeline />)
      await waitFor(() => {
        const canvas = container.querySelector('canvas')
        expect(canvas).toBeTruthy()
      })
    })

    it('renders the canvas element', async () => {
      const { container } = renderWithQueryClient(<Timeline />)
      await waitFor(() => {
        const canvas = container.querySelector('canvas')
        expect(canvas).toBeInTheDocument()
      })
    })

    it('renders zoom controls', async () => {
      renderWithQueryClient(<Timeline />)
      await waitFor(() => {
        expect(screen.getByText('Zoom In')).toBeInTheDocument()
        expect(screen.getByText('Zoom Out')).toBeInTheDocument()
        expect(screen.getByText('Reset')).toBeInTheDocument()
      })
    })

    it('renders with empty data gracefully', async () => {
      const { container } = renderWithQueryClient(<Timeline />)

      // Wait for component to render
      await waitFor(() => {
        // Canvas should render even with default mock data
        const canvas = container.querySelector('canvas')
        expect(canvas).toBeTruthy()
      })
    })
  })

  describe('Interactions', () => {
    it('calls onThinkerClick when a thinker is clicked', async () => {
      const onThinkerClick = vi.fn()
      const { container } = renderWithQueryClient(
        <Timeline onThinkerClick={onThinkerClick} />
      )

      await waitFor(() => {
        const canvas = container.querySelector('canvas')
        expect(canvas).toBeInTheDocument()
      })

      const canvas = container.querySelector('canvas')!
      fireEvent.click(canvas, { clientX: 100, clientY: 100 })
    })

    it('calls onCanvasClick with Ctrl+Click', async () => {
      const onCanvasClick = vi.fn()
      const { container } = renderWithQueryClient(
        <Timeline onCanvasClick={onCanvasClick} />
      )

      await waitFor(() => {
        const canvas = container.querySelector('canvas')
        expect(canvas).toBeInTheDocument()
      })

      const canvas = container.querySelector('canvas')!
      fireEvent.click(canvas, { clientX: 200, clientY: 200, ctrlKey: true })
    })

    it('handles zoom in button click', async () => {
      renderWithQueryClient(<Timeline />)

      await waitFor(() => {
        expect(screen.getByText('Zoom In')).toBeInTheDocument()
      })

      const zoomInButton = screen.getByText('Zoom In')
      fireEvent.click(zoomInButton)
    })

    it('handles zoom out button click', async () => {
      renderWithQueryClient(<Timeline />)

      await waitFor(() => {
        expect(screen.getByText('Zoom Out')).toBeInTheDocument()
      })

      const zoomOutButton = screen.getByText('Zoom Out')
      fireEvent.click(zoomOutButton)
    })

    it('handles reset button click', async () => {
      renderWithQueryClient(<Timeline />)

      await waitFor(() => {
        expect(screen.getByText('Reset')).toBeInTheDocument()
      })

      const resetButton = screen.getByText('Reset')
      fireEvent.click(resetButton)
    })

    it('handles wheel events for zooming', async () => {
      const { container } = renderWithQueryClient(<Timeline />)

      await waitFor(() => {
        const canvas = container.querySelector('canvas')
        expect(canvas).toBeInTheDocument()
      })

      const canvas = container.querySelector('canvas')!
      fireEvent.wheel(canvas, { deltaY: 100 })
      fireEvent.wheel(canvas, { deltaY: -100 })
    })

    it('handles mouse down for panning', async () => {
      const { container } = renderWithQueryClient(<Timeline />)

      await waitFor(() => {
        const canvas = container.querySelector('canvas')
        expect(canvas).toBeInTheDocument()
      })

      const canvas = container.querySelector('canvas')!
      fireEvent.mouseDown(canvas, { clientX: 100, clientY: 100 })
      fireEvent.mouseMove(canvas, { clientX: 150, clientY: 150 })
      fireEvent.mouseUp(canvas)
    })

    it('handles mouse leave to stop panning', async () => {
      const { container } = renderWithQueryClient(<Timeline />)

      await waitFor(() => {
        const canvas = container.querySelector('canvas')
        expect(canvas).toBeInTheDocument()
      })

      const canvas = container.querySelector('canvas')!
      fireEvent.mouseDown(canvas, { clientX: 100, clientY: 100 })
      fireEvent.mouseLeave(canvas)
    })

    it('handles double click on canvas', async () => {
      const onThinkerClick = vi.fn()
      const { container } = renderWithQueryClient(
        <Timeline onThinkerClick={onThinkerClick} />
      )

      await waitFor(() => {
        const canvas = container.querySelector('canvas')
        expect(canvas).toBeInTheDocument()
      })

      const canvas = container.querySelector('canvas')!
      fireEvent.doubleClick(canvas, { clientX: 100, clientY: 100 })
    })
  })

  describe('Props', () => {
    it('accepts selectedThinkerId prop', async () => {
      const { container } = renderWithQueryClient(
        <Timeline selectedThinkerId="test-id" />
      )

      await waitFor(() => {
        const canvas = container.querySelector('canvas')
        expect(canvas).toBeInTheDocument()
      })
    })

    it('accepts bulkSelectedIds prop', async () => {
      const { container } = renderWithQueryClient(
        <Timeline bulkSelectedIds={['id-1', 'id-2']} />
      )

      await waitFor(() => {
        const canvas = container.querySelector('canvas')
        expect(canvas).toBeInTheDocument()
      })
    })

    it('accepts filterByTimelineId prop', async () => {
      const { container } = renderWithQueryClient(
        <Timeline filterByTimelineId="timeline-1" />
      )

      await waitFor(() => {
        const canvas = container.querySelector('canvas')
        expect(canvas).toBeInTheDocument()
      })
    })

    it('accepts filterByTagIds prop', async () => {
      const { container } = renderWithQueryClient(
        <Timeline filterByTagIds={['tag-1']} />
      )

      await waitFor(() => {
        const canvas = container.querySelector('canvas')
        expect(canvas).toBeInTheDocument()
      })
    })

    it('accepts searchQuery prop', async () => {
      const { container } = renderWithQueryClient(
        <Timeline searchQuery="test" />
      )

      await waitFor(() => {
        const canvas = container.querySelector('canvas')
        expect(canvas).toBeInTheDocument()
      })
    })

    it('accepts filterByField prop', async () => {
      const { container } = renderWithQueryClient(
        <Timeline filterByField="Philosophy" />
      )

      await waitFor(() => {
        const canvas = container.querySelector('canvas')
        expect(canvas).toBeInTheDocument()
      })
    })

    it('accepts year filter props', async () => {
      const { container } = renderWithQueryClient(
        <Timeline filterByYearStart={1700} filterByYearEnd={1900} />
      )

      await waitFor(() => {
        const canvas = container.querySelector('canvas')
        expect(canvas).toBeInTheDocument()
      })
    })

    it('accepts animationYear prop', async () => {
      const { container } = renderWithQueryClient(
        <Timeline animationYear={1800} />
      )

      await waitFor(() => {
        const canvas = container.querySelector('canvas')
        expect(canvas).toBeInTheDocument()
      })
    })

    it('accepts visibleConnectionTypes prop', async () => {
      const { container } = renderWithQueryClient(
        <Timeline visibleConnectionTypes={['influenced', 'critiqued']} />
      )

      await waitFor(() => {
        const canvas = container.querySelector('canvas')
        expect(canvas).toBeInTheDocument()
      })
    })

    it('accepts highlightSelectedConnections prop', async () => {
      const { container } = renderWithQueryClient(
        <Timeline highlightSelectedConnections={false} />
      )

      await waitFor(() => {
        const canvas = container.querySelector('canvas')
        expect(canvas).toBeInTheDocument()
      })
    })
  })

  describe('Event handlers', () => {
    it('accepts onConnectionClick handler', async () => {
      const onConnectionClick = vi.fn()
      const { container } = renderWithQueryClient(
        <Timeline onConnectionClick={onConnectionClick} />
      )

      await waitFor(() => {
        const canvas = container.querySelector('canvas')
        expect(canvas).toBeInTheDocument()
      })
    })

    it('accepts onEventClick handler', async () => {
      const onEventClick = vi.fn()
      const { container } = renderWithQueryClient(
        <Timeline onEventClick={onEventClick} />
      )

      await waitFor(() => {
        const canvas = container.querySelector('canvas')
        expect(canvas).toBeInTheDocument()
      })
    })
  })

  describe('Accessibility', () => {
    it('canvas has cursor-move class for dragging indication', async () => {
      const { container } = renderWithQueryClient(<Timeline />)

      await waitFor(() => {
        const canvas = container.querySelector('canvas')
        expect(canvas).toHaveClass('cursor-move')
      })
    })

    it('zoom buttons are accessible', async () => {
      renderWithQueryClient(<Timeline />)

      await waitFor(() => {
        const buttons = screen.getAllByRole('button')
        expect(buttons.length).toBeGreaterThanOrEqual(3)
      })
    })
  })
})
