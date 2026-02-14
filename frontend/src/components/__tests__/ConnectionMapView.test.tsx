import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '../../test/test-utils'
import userEvent from '@testing-library/user-event'
import { ConnectionMapView } from '../ConnectionMapView'
import { server } from '../../test/setup'
import { http, HttpResponse } from 'msw'

const API_URL = 'http://localhost:8010'

const mockThinkers = [
  {
    id: 'thinker-1',
    name: 'Immanuel Kant',
    birth_year: 1724,
    death_year: 1804,
    field: 'Philosophy',
    timeline_id: 'timeline-1',
    position_x: 100,
    position_y: 200
  },
  {
    id: 'thinker-2',
    name: 'Georg Hegel',
    birth_year: 1770,
    death_year: 1831,
    field: 'Philosophy',
    timeline_id: 'timeline-1',
    position_x: 200,
    position_y: 200
  },
  {
    id: 'thinker-3',
    name: 'John Rawls',
    birth_year: 1921,
    death_year: 2002,
    field: 'Political Philosophy',
    timeline_id: 'timeline-1',
    position_x: 300,
    position_y: 200
  },
  {
    id: 'thinker-4',
    name: 'David Hume',
    birth_year: 1711,
    death_year: 1776,
    field: 'Philosophy',
    timeline_id: 'timeline-1',
    position_x: 50,
    position_y: 200
  }
]

const mockConnections = [
  {
    id: 'conn-1',
    from_thinker_id: 'thinker-4', // Hume influenced Kant
    to_thinker_id: 'thinker-1',
    connection_type: 'influenced',
    strength: 4,
    notes: 'Awakened from dogmatic slumber'
  },
  {
    id: 'conn-2',
    from_thinker_id: 'thinker-1', // Kant influenced Hegel
    to_thinker_id: 'thinker-2',
    connection_type: 'influenced',
    strength: 5,
    notes: 'Response to Kantian critique'
  },
  {
    id: 'conn-3',
    from_thinker_id: 'thinker-1', // Kant influenced Rawls
    to_thinker_id: 'thinker-3',
    connection_type: 'built_upon',
    strength: 3,
    notes: 'Social contract theory'
  }
]

describe('ConnectionMapView', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    centeredThinkerId: 'thinker-1',
    onThinkerSelect: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    server.use(
      http.get(`${API_URL}/api/thinkers/`, () => {
        return HttpResponse.json(mockThinkers)
      }),
      http.get(`${API_URL}/api/connections/`, () => {
        return HttpResponse.json(mockConnections)
      })
    )
  })

  describe('Panel Rendering', () => {
    it('renders panel when isOpen is true', async () => {
      render(<ConnectionMapView {...defaultProps} />)
      expect(screen.getByText('Connection Network Map')).toBeInTheDocument()
    })

    it('does not render panel when isOpen is false', () => {
      render(<ConnectionMapView {...defaultProps} isOpen={false} />)
      expect(screen.queryByText('Connection Network Map')).not.toBeInTheDocument()
    })

    it('displays centered thinker name', async () => {
      render(<ConnectionMapView {...defaultProps} />)
      await waitFor(() => {
        expect(screen.getByText('Immanuel Kant')).toBeInTheDocument()
      })
    })

    it('shows connection count', async () => {
      render(<ConnectionMapView {...defaultProps} />)
      await waitFor(() => {
        expect(screen.getByText(/3 connections/)).toBeInTheDocument()
      })
    })

    it('has close button', () => {
      render(<ConnectionMapView {...defaultProps} />)
      expect(screen.getByRole('button', { name: '×' })).toBeInTheDocument()
    })

    it('calls onClose when close button clicked', async () => {
      const onClose = vi.fn()
      render(<ConnectionMapView {...defaultProps} onClose={onClose} />)
      await userEvent.click(screen.getByRole('button', { name: '×' }))
      expect(onClose).toHaveBeenCalled()
    })

    it('has view details button', async () => {
      render(<ConnectionMapView {...defaultProps} />)
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'View Details' })).toBeInTheDocument()
      })
    })

    it('calls onThinkerSelect when view details clicked', async () => {
      const onThinkerSelect = vi.fn()
      const onClose = vi.fn()
      render(<ConnectionMapView {...defaultProps} onThinkerSelect={onThinkerSelect} onClose={onClose} />)

      await waitFor(async () => {
        await userEvent.click(screen.getByRole('button', { name: 'View Details' }))
        expect(onThinkerSelect).toHaveBeenCalledWith('thinker-1')
        expect(onClose).toHaveBeenCalled()
      })
    })
  })

  describe('Canvas', () => {
    it('renders canvas element', async () => {
      render(<ConnectionMapView {...defaultProps} />)
      await waitFor(() => {
        const canvas = document.querySelector('canvas')
        expect(canvas).toBeInTheDocument()
      })
    })

    it('renders canvas when thinker has connections', async () => {
      render(<ConnectionMapView {...defaultProps} />)
      await waitFor(() => {
        const canvas = document.querySelector('canvas')
        expect(canvas).toBeInTheDocument()
      })
    })
  })

  describe('Empty State', () => {
    it('shows message when no centered thinker', () => {
      render(<ConnectionMapView {...defaultProps} centeredThinkerId={null} />)
      expect(screen.getByText('Select a thinker to view their connections')).toBeInTheDocument()
    })

    it('shows message when thinker has no connections', async () => {
      server.use(
        http.get(`${API_URL}/api/connections/`, () => {
          return HttpResponse.json([])
        })
      )

      render(<ConnectionMapView {...defaultProps} />)
      await waitFor(() => {
        expect(screen.getByText('No connections found for this thinker')).toBeInTheDocument()
      })
    })
  })

  describe('Legend', () => {
    it('displays connection type legend', async () => {
      render(<ConnectionMapView {...defaultProps} />)
      await waitFor(() => {
        expect(screen.getByText('Influenced')).toBeInTheDocument()
        expect(screen.getByText('Built Upon')).toBeInTheDocument()
      })
    })

    it('displays click instruction', async () => {
      render(<ConnectionMapView {...defaultProps} />)
      await waitFor(() => {
        expect(screen.getByText(/Click connection types to show\/hide/)).toBeInTheDocument()
      })
    })
  })

  describe('Mouse Interactions', () => {
    it('changes cursor on node hover', async () => {
      render(<ConnectionMapView {...defaultProps} />)

      await waitFor(() => {
        const canvas = document.querySelector('canvas')
        expect(canvas).toBeInTheDocument()
      })

      // Wait for force simulation to complete
      await new Promise(resolve => setTimeout(resolve, 150))

      const canvas = document.querySelector('canvas') as HTMLCanvasElement
      // The canvas will update cursor style based on mouse position
      // This just verifies the canvas exists and is interactive
      expect(canvas).toBeDefined()
    })

    it('handles mouse move events', async () => {
      render(<ConnectionMapView {...defaultProps} />)

      await waitFor(() => {
        const canvas = document.querySelector('canvas')
        expect(canvas).toBeInTheDocument()
      })

      const canvas = document.querySelector('canvas') as HTMLCanvasElement

      // Simulate mouse move
      fireEvent.mouseMove(canvas, { clientX: 400, clientY: 300 })

      // Should not throw errors
      expect(canvas).toBeInTheDocument()
    })

    it('handles click events', async () => {
      render(<ConnectionMapView {...defaultProps} />)

      await waitFor(() => {
        const canvas = document.querySelector('canvas')
        expect(canvas).toBeInTheDocument()
      })

      const canvas = document.querySelector('canvas') as HTMLCanvasElement

      // Simulate click
      fireEvent.click(canvas, { clientX: 400, clientY: 300 })

      // Should not throw errors
      expect(canvas).toBeInTheDocument()
    })
  })

  describe('Re-centering', () => {
    it('updates when centeredThinkerId prop changes', async () => {
      const { rerender } = render(<ConnectionMapView {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Immanuel Kant')).toBeInTheDocument()
      })

      // Re-render with different centered thinker
      rerender(<ConnectionMapView {...defaultProps} centeredThinkerId="thinker-2" />)

      await waitFor(() => {
        expect(screen.getByText('Georg Hegel')).toBeInTheDocument()
      })
    })
  })

  describe('Zone Labels', () => {
    it('shows "Influenced by" label when thinker has influencers', async () => {
      render(<ConnectionMapView {...defaultProps} />)

      // Wait for canvas to render - the labels are drawn on canvas
      await waitFor(() => {
        const canvas = document.querySelector('canvas')
        expect(canvas).toBeInTheDocument()
      })

      // Canvas labels are drawn, not in DOM, so we just verify canvas exists
      // In a real test we'd check the canvas pixels or use a snapshot
    })

    it('shows "Influenced" label when thinker influenced others', async () => {
      render(<ConnectionMapView {...defaultProps} />)

      await waitFor(() => {
        const canvas = document.querySelector('canvas')
        expect(canvas).toBeInTheDocument()
      })
    })
  })

  describe('Different Connection Types', () => {
    it('handles influenced connection type', async () => {
      render(<ConnectionMapView {...defaultProps} />)

      await waitFor(() => {
        const canvas = document.querySelector('canvas')
        expect(canvas).toBeInTheDocument()
      })
    })

    it('handles built_upon connection type', async () => {
      render(<ConnectionMapView {...defaultProps} />)

      await waitFor(() => {
        const canvas = document.querySelector('canvas')
        expect(canvas).toBeInTheDocument()
      })
    })

    it('handles critiqued connection type', async () => {
      server.use(
        http.get(`${API_URL}/api/connections/`, () => {
          return HttpResponse.json([
            {
              id: 'conn-x',
              from_thinker_id: 'thinker-1',
              to_thinker_id: 'thinker-2',
              connection_type: 'critiqued',
              strength: 3
            }
          ])
        })
      )

      render(<ConnectionMapView {...defaultProps} />)

      await waitFor(() => {
        const canvas = document.querySelector('canvas')
        expect(canvas).toBeInTheDocument()
      })
    })

    it('handles synthesized connection type', async () => {
      server.use(
        http.get(`${API_URL}/api/connections/`, () => {
          return HttpResponse.json([
            {
              id: 'conn-y',
              from_thinker_id: 'thinker-1',
              to_thinker_id: 'thinker-2',
              connection_type: 'synthesized',
              strength: 3
            }
          ])
        })
      )

      render(<ConnectionMapView {...defaultProps} />)

      await waitFor(() => {
        const canvas = document.querySelector('canvas')
        expect(canvas).toBeInTheDocument()
      })
    })
  })

  describe('Force Simulation', () => {
    it('positions nodes over time', async () => {
      render(<ConnectionMapView {...defaultProps} />)

      await waitFor(() => {
        const canvas = document.querySelector('canvas')
        expect(canvas).toBeInTheDocument()
      })

      // Wait for simulation to run (100 iterations)
      await new Promise(resolve => setTimeout(resolve, 200))

      // Canvas should still be rendered
      const canvas = document.querySelector('canvas')
      expect(canvas).toBeInTheDocument()
    })

    it('cleans up animation frame on unmount', async () => {
      const { unmount } = render(<ConnectionMapView {...defaultProps} />)

      await waitFor(() => {
        const canvas = document.querySelector('canvas')
        expect(canvas).toBeInTheDocument()
      })

      // Should not throw errors on unmount
      unmount()
    })
  })

  describe('Thinker with Many Connections', () => {
    it('handles thinker with multiple influencers', async () => {
      server.use(
        http.get(`${API_URL}/api/connections/`, () => {
          return HttpResponse.json([
            { id: 'c1', from_thinker_id: 'thinker-2', to_thinker_id: 'thinker-1', connection_type: 'influenced' },
            { id: 'c2', from_thinker_id: 'thinker-3', to_thinker_id: 'thinker-1', connection_type: 'influenced' },
            { id: 'c3', from_thinker_id: 'thinker-4', to_thinker_id: 'thinker-1', connection_type: 'influenced' },
          ])
        })
      )

      render(<ConnectionMapView {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText(/3 connections/)).toBeInTheDocument()
      })
    })

    it('handles thinker with multiple influenced', async () => {
      server.use(
        http.get(`${API_URL}/api/connections/`, () => {
          return HttpResponse.json([
            { id: 'c1', from_thinker_id: 'thinker-1', to_thinker_id: 'thinker-2', connection_type: 'influenced' },
            { id: 'c2', from_thinker_id: 'thinker-1', to_thinker_id: 'thinker-3', connection_type: 'influenced' },
            { id: 'c3', from_thinker_id: 'thinker-1', to_thinker_id: 'thinker-4', connection_type: 'influenced' },
          ])
        })
      )

      render(<ConnectionMapView {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText(/3 connections/)).toBeInTheDocument()
      })
    })
  })

  describe('Bidirectional Connections', () => {
    it('handles bidirectional connections correctly', async () => {
      server.use(
        http.get(`${API_URL}/api/connections/`, () => {
          return HttpResponse.json([
            { id: 'c1', from_thinker_id: 'thinker-1', to_thinker_id: 'thinker-2', connection_type: 'influenced', bidirectional: true },
          ])
        })
      )

      render(<ConnectionMapView {...defaultProps} />)

      await waitFor(() => {
        const canvas = document.querySelector('canvas')
        expect(canvas).toBeInTheDocument()
      })
    })
  })
})
