import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Minimap } from '../Minimap'

const createQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
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

describe('Minimap', () => {
  const defaultProps = {
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    canvasWidth: 800,
    canvasHeight: 600,
    onNavigate: vi.fn(),
    thinkers: [],
    timelines: [],
  }

  it('renders without crashing', () => {
    renderWithQueryClient(<Minimap {...defaultProps} />)
    expect(screen.getByText('Overview')).toBeInTheDocument()
  })

  it('renders the canvas element', () => {
    const { container } = renderWithQueryClient(<Minimap {...defaultProps} />)
    const canvas = container.querySelector('canvas')
    expect(canvas).toBeInTheDocument()
  })

  it('has collapse button', () => {
    renderWithQueryClient(<Minimap {...defaultProps} />)
    expect(screen.getByTitle('Hide minimap')).toBeInTheDocument()
  })

  it('collapses when close button is clicked', () => {
    renderWithQueryClient(<Minimap {...defaultProps} />)

    const closeButton = screen.getByTitle('Hide minimap')
    fireEvent.click(closeButton)

    expect(screen.getByText('Show Minimap')).toBeInTheDocument()
  })

  it('expands when show button is clicked', () => {
    renderWithQueryClient(<Minimap {...defaultProps} />)

    // First collapse
    fireEvent.click(screen.getByTitle('Hide minimap'))

    // Then expand
    fireEvent.click(screen.getByText('Show Minimap'))

    expect(screen.getByText('Overview')).toBeInTheDocument()
  })

  it('calls onNavigate when canvas is clicked', () => {
    const onNavigate = vi.fn()
    const { container } = renderWithQueryClient(
      <Minimap {...defaultProps} onNavigate={onNavigate} />
    )

    const canvas = container.querySelector('canvas')!
    fireEvent.click(canvas, { clientX: 100, clientY: 40 })

    expect(onNavigate).toHaveBeenCalled()
  })

  it('handles drag interaction', () => {
    const onNavigate = vi.fn()
    const { container } = renderWithQueryClient(
      <Minimap {...defaultProps} onNavigate={onNavigate} />
    )

    const canvas = container.querySelector('canvas')!

    fireEvent.mouseDown(canvas, { clientX: 50, clientY: 40 })
    fireEvent.mouseMove(canvas, { clientX: 100, clientY: 40 })
    fireEvent.mouseUp(canvas)
  })

  it('renders with thinkers data', () => {
    const thinkers = [
      { id: '1', name: 'Thinker 1', birth_year: 1800, death_year: 1850 },
      { id: '2', name: 'Thinker 2', birth_year: 1850, death_year: 1900 },
    ]

    renderWithQueryClient(
      <Minimap {...defaultProps} thinkers={thinkers as any} />
    )

    expect(screen.getByText('Overview')).toBeInTheDocument()
  })

  it('renders with timeline filter', () => {
    renderWithQueryClient(
      <Minimap {...defaultProps} filterByTimelineId="timeline-1" />
    )

    expect(screen.getByText('Overview')).toBeInTheDocument()
  })
})
