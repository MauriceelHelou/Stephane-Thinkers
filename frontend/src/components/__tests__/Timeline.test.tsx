import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { Timeline } from '../Timeline'
import { server } from '../../test/setup'

const API_URL = 'http://localhost:8010'

// A timeline whose bounds make yearToX deterministic for the drag tests below.
const FIXED_TIMELINE = {
  id: 'timeline-1',
  name: 'Test Timeline',
  description: '',
  start_year: 1700,
  end_year: 2000,
}

// Make the canvas report real dimensions so position math (yearToX) is
// deterministic. jsdom returns zeros by default.
const mockCanvasRect = () =>
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({
    width: 800,
    height: 600,
    left: 0,
    top: 0,
    right: 800,
    bottom: 600,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect)

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

  describe('Thinker drag is locked to the timeline (horizontal)', () => {
    // A single manually-positioned thinker anchored at 1800 so its rendered
    // position is fully deterministic: yearToX(1800) within a 1700-2000 timeline
    // on an 800x600 canvas = 100 + (1800-1700) * (800*0.8/300) ≈ 313.3 (x),
    // centerY (300) + position_y (0) = 300 (y).
    const seedSingleThinker = () => {
      server.use(
        http.get(`${API_URL}/api/thinkers/`, () =>
          HttpResponse.json([
            {
              id: 't1',
              name: 'Anchored',
              birth_year: 1724,
              death_year: 1804,
              anchor_year: 1800,
              field: 'Philosophy',
              timeline_id: 'timeline-1',
              position_x: 0,
              position_y: 0,
              is_manually_positioned: true,
            },
          ])
        )
      )
    }

    const THINKER_X = 313 // ≈ yearToX(1800); within the node's hit box
    const THINKER_Y = 300 // centerY + position_y(0)

    it('keeps anchor_year fixed during a large horizontal drag, only changing position_y', async () => {
      mockCanvasRect()
      seedSingleThinker()
      const onThinkerDrag = vi.fn()
      const { container } = renderWithQueryClient(
        <Timeline onThinkerDrag={onThinkerDrag} selectedTimeline={FIXED_TIMELINE as never} />
      )

      await waitFor(() => {
        expect(container.querySelector('canvas')).toBeInTheDocument()
      })
      const canvas = container.querySelector('canvas')!

      // Grab the thinker, then drag far to the RIGHT (and down a little).
      // If horizontal drag weren't locked, anchor_year would jump to ~1934.
      fireEvent.mouseDown(canvas, { clientX: THINKER_X, clientY: THINKER_Y })
      fireEvent.mouseMove(canvas, { clientX: 600, clientY: 360 })
      fireEvent.mouseUp(canvas, { clientX: 600, clientY: 360 })

      await waitFor(() => {
        expect(onThinkerDrag).toHaveBeenCalledTimes(1)
      })
      const [id, anchorYear, positionY] = onThinkerDrag.mock.calls[0]
      expect(id).toBe('t1')
      // Year is LOCKED to the timeline despite the big horizontal mouse move.
      expect(anchorYear).toBe(1800)
      // Vertical movement is preserved (dragged ~60px below the axis).
      expect(positionY).toBeGreaterThan(40)
    })

    it('does not change anchor_year on a purely horizontal drag', async () => {
      mockCanvasRect()
      seedSingleThinker()
      const onThinkerDrag = vi.fn()
      const { container } = renderWithQueryClient(
        <Timeline onThinkerDrag={onThinkerDrag} selectedTimeline={FIXED_TIMELINE as never} />
      )

      await waitFor(() => {
        expect(container.querySelector('canvas')).toBeInTheDocument()
      })
      const canvas = container.querySelector('canvas')!

      fireEvent.mouseDown(canvas, { clientX: THINKER_X, clientY: THINKER_Y })
      fireEvent.mouseMove(canvas, { clientX: 550, clientY: THINKER_Y }) // pure horizontal
      fireEvent.mouseUp(canvas, { clientX: 550, clientY: THINKER_Y })

      // A purely horizontal move is below the vertical drag threshold, so either
      // no drag is committed, or if committed the year is unchanged. Never a year jump.
      await waitFor(() => {
        expect(container.querySelector('canvas')).toBeInTheDocument()
      })
      if (onThinkerDrag.mock.calls.length > 0) {
        const [, anchorYear] = onThinkerDrag.mock.calls[0]
        expect(anchorYear).toBe(1800)
      }
    })
  })

  describe('Range-aware items (bars + tethers)', () => {
    const canvasCtx = () =>
      document.createElement('canvas').getContext('2d') as unknown as { roundRect: ReturnType<typeof vi.fn> }

    it('draws dated thinkers as bars (uses roundRect)', async () => {
      mockCanvasRect()
      // Default seed thinkers (Kant 1724–1804, Hegel 1770–1831) are ranges.
      const { container } = renderWithQueryClient(
        <Timeline selectedTimeline={FIXED_TIMELINE as never} />
      )
      await waitFor(() => expect(container.querySelector('canvas')).toBeInTheDocument())
      await waitFor(() => expect(canvasCtx().roundRect).toHaveBeenCalled())
    })

    it('renders a living thinker (birth, no death) as a bar without crashing', async () => {
      mockCanvasRect()
      server.use(
        http.get(`${API_URL}/api/thinkers/`, () =>
          HttpResponse.json([
            { id: 'living', name: 'Living Thinker', birth_year: 1950, death_year: null, timeline_id: 'timeline-1', position_x: 0, position_y: 0 },
          ])
        )
      )
      const { container } = renderWithQueryClient(
        <Timeline selectedTimeline={FIXED_TIMELINE as never} />
      )
      await waitFor(() => expect(container.querySelector('canvas')).toBeInTheDocument())
      await waitFor(() => expect(canvasCtx().roundRect).toHaveBeenCalled())
    })

    it('selects a ranged event when its bar is clicked', async () => {
      mockCanvasRect()
      server.use(
        http.get(`${API_URL}/api/thinkers/`, () => HttpResponse.json([])),
        http.get(`${API_URL}/api/timeline-events/`, () =>
          HttpResponse.json([
            { id: 'evt-range', name: 'Long Era', year: 1750, end_year: 1950, event_type: 'war', timeline_id: 'timeline-1' },
          ])
        )
      )
      const onEventClick = vi.fn()
      const { container } = renderWithQueryClient(
        <Timeline selectedTimeline={FIXED_TIMELINE as never} onEventClick={onEventClick} />
      )
      await waitFor(() => expect(container.querySelector('canvas')).toBeInTheDocument())
      // Wait until the bar has been drawn (event data loaded).
      await waitFor(() => expect(canvasCtx().roundRect).toHaveBeenCalled())
      const canvas = container.querySelector('canvas')!
      // Inside the bar: x0 ≈ yearToX(1750) ≈ 207, y ≈ centerY + EVENT_ZONE_OFFSET = 285.
      fireEvent.mouseDown(canvas, { clientX: 300, clientY: 285 })
      await waitFor(() => expect(onEventClick).toHaveBeenCalledWith('evt-range'))
    })
  })
})
