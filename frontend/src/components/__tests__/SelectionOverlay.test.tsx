import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SelectionOverlay, isPointInPolygon } from '../SelectionOverlay'

describe('SelectionOverlay', () => {
  const defaultProps = {
    mode: 'none' as const,
    onBoxZoom: vi.fn(),
    onLassoSelect: vi.fn(),
    onModeChange: vi.fn(),
  }

  describe('Rendering', () => {
    it('renders nothing when mode is none', () => {
      const { container } = render(<SelectionOverlay {...defaultProps} mode="none" />)
      expect(container.firstChild).toBeNull()
    })

    it('renders overlay when mode is box-zoom', () => {
      render(<SelectionOverlay {...defaultProps} mode="box-zoom" />)
      expect(screen.getByText(/Box Zoom/)).toBeInTheDocument()
    })

    it('renders overlay when mode is lasso-select', () => {
      render(<SelectionOverlay {...defaultProps} mode="lasso-select" />)
      expect(screen.getByText(/Lasso Select/)).toBeInTheDocument()
    })

    it('shows ESC to cancel hint', () => {
      render(<SelectionOverlay {...defaultProps} mode="box-zoom" />)
      expect(screen.getByText(/ESC to cancel/)).toBeInTheDocument()
    })
  })

  describe('Box zoom interaction', () => {
    it('has zoom-in cursor for box-zoom mode', () => {
      const { container } = render(<SelectionOverlay {...defaultProps} mode="box-zoom" />)
      const overlay = container.firstChild as HTMLElement
      expect(overlay.style.cursor).toBe('zoom-in')
    })

    it('starts selection on mouse down', () => {
      const { container } = render(<SelectionOverlay {...defaultProps} mode="box-zoom" />)
      const overlay = container.firstChild as HTMLElement

      fireEvent.mouseDown(overlay, { clientX: 100, clientY: 100 })
      // Selection rectangle should appear on move
    })

    it('calls onBoxZoom when selection completes', () => {
      const onBoxZoom = vi.fn()
      const { container } = render(
        <SelectionOverlay {...defaultProps} mode="box-zoom" onBoxZoom={onBoxZoom} />
      )
      const overlay = container.firstChild as HTMLElement

      // Mock getBoundingClientRect
      overlay.getBoundingClientRect = vi.fn(() => ({
        left: 0,
        top: 0,
        right: 800,
        bottom: 600,
        width: 800,
        height: 600,
        x: 0,
        y: 0,
        toJSON: () => {},
      }))

      fireEvent.mouseDown(overlay, { clientX: 100, clientY: 100 })
      fireEvent.mouseMove(overlay, { clientX: 200, clientY: 200 })
      fireEvent.mouseUp(overlay)

      expect(onBoxZoom).toHaveBeenCalled()
    })
  })

  describe('Lasso select interaction', () => {
    it('has crosshair cursor for lasso-select mode', () => {
      const { container } = render(<SelectionOverlay {...defaultProps} mode="lasso-select" />)
      const overlay = container.firstChild as HTMLElement
      expect(overlay.style.cursor).toBe('crosshair')
    })

    it('calls onLassoSelect when selection completes', () => {
      const onLassoSelect = vi.fn()
      const { container } = render(
        <SelectionOverlay {...defaultProps} mode="lasso-select" onLassoSelect={onLassoSelect} />
      )
      const overlay = container.firstChild as HTMLElement

      // Mock getBoundingClientRect
      overlay.getBoundingClientRect = vi.fn(() => ({
        left: 0,
        top: 0,
        right: 800,
        bottom: 600,
        width: 800,
        height: 600,
        x: 0,
        y: 0,
        toJSON: () => {},
      }))

      // Draw a triangle
      fireEvent.mouseDown(overlay, { clientX: 100, clientY: 100 })
      fireEvent.mouseMove(overlay, { clientX: 200, clientY: 100 })
      fireEvent.mouseMove(overlay, { clientX: 150, clientY: 200 })
      fireEvent.mouseUp(overlay)

      expect(onLassoSelect).toHaveBeenCalled()
    })
  })

  describe('Keyboard handling', () => {
    it('cancels selection on Escape', () => {
      const onModeChange = vi.fn()
      const { container } = render(
        <SelectionOverlay {...defaultProps} mode="box-zoom" onModeChange={onModeChange} />
      )
      const overlay = container.firstChild as HTMLElement

      // Start selection
      fireEvent.mouseDown(overlay, { clientX: 100, clientY: 100 })

      // Press Escape
      fireEvent.keyDown(window, { key: 'Escape' })

      expect(onModeChange).toHaveBeenCalledWith('none')
    })
  })

  describe('Mouse leave', () => {
    it('completes selection on mouse leave', () => {
      const onBoxZoom = vi.fn()
      const { container } = render(
        <SelectionOverlay {...defaultProps} mode="box-zoom" onBoxZoom={onBoxZoom} />
      )
      const overlay = container.firstChild as HTMLElement

      // Mock getBoundingClientRect
      overlay.getBoundingClientRect = vi.fn(() => ({
        left: 0,
        top: 0,
        right: 800,
        bottom: 600,
        width: 800,
        height: 600,
        x: 0,
        y: 0,
        toJSON: () => {},
      }))

      fireEvent.mouseDown(overlay, { clientX: 100, clientY: 100 })
      fireEvent.mouseMove(overlay, { clientX: 200, clientY: 200 })
      fireEvent.mouseLeave(overlay)

      expect(onBoxZoom).toHaveBeenCalled()
    })
  })
})

describe('isPointInPolygon', () => {
  it('returns true for point inside triangle', () => {
    const polygon = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 50, y: 100 },
    ]
    expect(isPointInPolygon({ x: 50, y: 50 }, polygon)).toBe(true)
  })

  it('returns false for point outside triangle', () => {
    const polygon = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 50, y: 100 },
    ]
    expect(isPointInPolygon({ x: 0, y: 100 }, polygon)).toBe(false)
  })

  it('returns true for point inside square', () => {
    const polygon = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ]
    expect(isPointInPolygon({ x: 50, y: 50 }, polygon)).toBe(true)
  })

  it('returns false for insufficient polygon points', () => {
    const polygon = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ]
    expect(isPointInPolygon({ x: 50, y: 50 }, polygon)).toBe(false)
  })

  it('returns false for point outside square', () => {
    const polygon = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ]
    expect(isPointInPolygon({ x: 150, y: 50 }, polygon)).toBe(false)
  })
})
