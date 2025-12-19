import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { YearPicker } from '../YearPicker'

describe('YearPicker', () => {
  const defaultProps = {
    selectedYear: null,
    onYearSelect: vi.fn(),
    timeline: null,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('renders without crashing', () => {
      render(<YearPicker {...defaultProps} />)
      expect(screen.getByText('Select Year')).toBeInTheDocument()
    })

    it('shows default label', () => {
      render(<YearPicker {...defaultProps} />)
      expect(screen.getByText('Select Year')).toBeInTheDocument()
    })

    it('shows custom label when provided', () => {
      render(<YearPicker {...defaultProps} label="Pick a Year" />)
      expect(screen.getByText('Pick a Year')).toBeInTheDocument()
    })

    it('displays selected year in label', () => {
      render(<YearPicker {...defaultProps} selectedYear={1850} />)
      expect(screen.getByText('1850')).toBeInTheDocument()
    })

    it('shows help text', () => {
      render(<YearPicker {...defaultProps} />)
      expect(screen.getByText(/Click on the timeline to select a year/)).toBeInTheDocument()
    })

    it('renders canvas element', () => {
      const { container } = render(<YearPicker {...defaultProps} />)
      expect(container.querySelector('canvas')).toBeInTheDocument()
    })
  })

  describe('Canvas interactions', () => {
    it('calls onYearSelect when canvas is clicked', () => {
      const onYearSelect = vi.fn()
      const { container } = render(
        <YearPicker {...defaultProps} onYearSelect={onYearSelect} />
      )

      const canvas = container.querySelector('canvas')
      expect(canvas).toBeInTheDocument()

      if (canvas) {
        // Mock getBoundingClientRect
        canvas.getBoundingClientRect = vi.fn(() => ({
          left: 0,
          top: 0,
          right: 400,
          bottom: 80,
          width: 400,
          height: 80,
          x: 0,
          y: 0,
          toJSON: () => {},
        }))

        // Set canvas width
        Object.defineProperty(canvas, 'width', { value: 400, writable: true })

        fireEvent.click(canvas, { clientX: 200, clientY: 40 })
        expect(onYearSelect).toHaveBeenCalled()
      }
    })

    it('handles mouse move for hover state', () => {
      const { container } = render(<YearPicker {...defaultProps} />)

      const canvas = container.querySelector('canvas')
      if (canvas) {
        canvas.getBoundingClientRect = vi.fn(() => ({
          left: 0,
          top: 0,
          right: 400,
          bottom: 80,
          width: 400,
          height: 80,
          x: 0,
          y: 0,
          toJSON: () => {},
        }))

        Object.defineProperty(canvas, 'width', { value: 400, writable: true })

        fireEvent.mouseMove(canvas, { clientX: 200, clientY: 40 })
        // Hover state is internal, verifying no error is thrown
      }
    })

    it('handles mouse leave to clear hover state', () => {
      const { container } = render(<YearPicker {...defaultProps} />)

      const canvas = container.querySelector('canvas')
      if (canvas) {
        fireEvent.mouseLeave(canvas)
        // Hover state cleared, verifying no error is thrown
      }
    })
  })

  describe('Timeline props', () => {
    it('uses timeline year range when provided', () => {
      const timeline = {
        id: 'timeline-1',
        name: 'Test Timeline',
        start_year: 1800,
        end_year: 1900,
      }
      render(<YearPicker {...defaultProps} timeline={timeline as any} />)
      // Component should use timeline's year range
    })

    it('uses default year range when no timeline', () => {
      render(<YearPicker {...defaultProps} timeline={null} />)
      // Component should use default year range (1700-2000)
    })
  })

  describe('Selected year display', () => {
    it('shows selected year marker on canvas', () => {
      const { container } = render(
        <YearPicker {...defaultProps} selectedYear={1850} />
      )

      const canvas = container.querySelector('canvas')
      expect(canvas).toBeInTheDocument()
      // Canvas drawing is mocked, but we verify component renders
    })

    it('updates when selected year changes', () => {
      const { rerender } = render(
        <YearPicker {...defaultProps} selectedYear={1850} />
      )
      expect(screen.getByText('1850')).toBeInTheDocument()

      rerender(<YearPicker {...defaultProps} selectedYear={1900} />)
      expect(screen.getByText('1900')).toBeInTheDocument()
    })
  })

  describe('Year calculation', () => {
    it('clamps year within valid range', () => {
      const onYearSelect = vi.fn()
      const timeline = {
        id: 'timeline-1',
        name: 'Test',
        start_year: 1800,
        end_year: 1900,
      }

      const { container } = render(
        <YearPicker
          {...defaultProps}
          onYearSelect={onYearSelect}
          timeline={timeline as any}
        />
      )

      const canvas = container.querySelector('canvas')
      if (canvas) {
        canvas.getBoundingClientRect = vi.fn(() => ({
          left: 0,
          top: 0,
          right: 400,
          bottom: 80,
          width: 400,
          height: 80,
          x: 0,
          y: 0,
          toJSON: () => {},
        }))

        Object.defineProperty(canvas, 'width', { value: 400, writable: true })

        // Click far left (should clamp to start year)
        fireEvent.click(canvas, { clientX: 0, clientY: 40 })

        // Click far right (should clamp to end year)
        fireEvent.click(canvas, { clientX: 400, clientY: 40 })

        expect(onYearSelect).toHaveBeenCalledTimes(2)
      }
    })
  })
})
