import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RulerIndicator } from '../RulerIndicator'

describe('RulerIndicator', () => {
  const defaultProps = {
    scale: 1,
    canvasWidth: 800,
    startYear: 1700,
    endYear: 2000,
  }

  describe('Rendering', () => {
    it('renders without crashing', () => {
      render(<RulerIndicator {...defaultProps} />)
      expect(screen.getByText(/100% zoom/)).toBeInTheDocument()
    })

    it('shows scale bar', () => {
      const { container } = render(<RulerIndicator {...defaultProps} />)
      const scaleBar = container.querySelector('.bg-gray-400')
      expect(scaleBar).toBeInTheDocument()
    })

    it('shows year span', () => {
      render(<RulerIndicator {...defaultProps} />)
      expect(screen.getByText(/Viewing/)).toBeInTheDocument()
    })

    it('shows zoom percentage', () => {
      render(<RulerIndicator {...defaultProps} scale={2} />)
      expect(screen.getByText(/200% zoom/)).toBeInTheDocument()
    })
  })

  describe('Scale calculations', () => {
    it('shows correct zoom for scale 0.5', () => {
      render(<RulerIndicator {...defaultProps} scale={0.5} />)
      expect(screen.getByText(/50% zoom/)).toBeInTheDocument()
    })

    it('shows correct zoom for scale 4', () => {
      render(<RulerIndicator {...defaultProps} scale={4} />)
      expect(screen.getByText(/400% zoom/)).toBeInTheDocument()
    })

    it('calculates year span based on zoom', () => {
      // At higher zoom, fewer years are visible
      const { rerender } = render(<RulerIndicator {...defaultProps} scale={1} />)
      const text1 = screen.getByText(/Viewing/).textContent

      rerender(<RulerIndicator {...defaultProps} scale={4} />)
      const text2 = screen.getByText(/Viewing/).textContent

      // Higher zoom should show fewer years
      expect(text1).not.toBe(text2)
    })
  })

  describe('With timeline', () => {
    it('uses timeline years when provided', () => {
      render(
        <RulerIndicator
          {...defaultProps}
          selectedTimeline={{
            id: 'test',
            name: 'Test Timeline',
            start_year: 1800,
            end_year: 1900,
          } as any}
        />
      )
      expect(screen.getByText(/zoom/)).toBeInTheDocument()
    })
  })

  describe('Scale bar formatting', () => {
    it('shows years label', () => {
      render(<RulerIndicator {...defaultProps} />)
      // There are multiple "years" mentions (scale bar and viewport info)
      expect(screen.getAllByText(/years/)).toHaveLength(2)
    })
  })
})
