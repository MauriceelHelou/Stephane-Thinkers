'use client'

import { useState, useCallback, useRef, useEffect } from 'react'

type SelectionMode = 'none' | 'box-zoom' | 'lasso-select'

interface Point {
  x: number
  y: number
}

interface SelectionOverlayProps {
  mode: SelectionMode
  onBoxZoom?: (startX: number, startY: number, endX: number, endY: number) => void
  onLassoSelect?: (points: Point[]) => void
  onModeChange?: (mode: SelectionMode) => void
}

export function SelectionOverlay({
  mode,
  onBoxZoom,
  onLassoSelect,
  onModeChange,
}: SelectionOverlayProps) {
  const [isSelecting, setIsSelecting] = useState(false)
  const [startPoint, setStartPoint] = useState<Point | null>(null)
  const [currentPoint, setCurrentPoint] = useState<Point | null>(null)
  const [lassoPoints, setLassoPoints] = useState<Point[]>([])
  const overlayRef = useRef<HTMLDivElement>(null)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (mode === 'none') return

    const rect = overlayRef.current?.getBoundingClientRect()
    if (!rect) return

    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    setIsSelecting(true)
    setStartPoint({ x, y })
    setCurrentPoint({ x, y })

    if (mode === 'lasso-select') {
      setLassoPoints([{ x, y }])
    }
  }, [mode])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isSelecting) return

    const rect = overlayRef.current?.getBoundingClientRect()
    if (!rect) return

    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    setCurrentPoint({ x, y })

    if (mode === 'lasso-select') {
      setLassoPoints(prev => [...prev, { x, y }])
    }
  }, [isSelecting, mode])

  const handleMouseUp = useCallback(() => {
    if (!isSelecting) return

    if (mode === 'box-zoom' && startPoint && currentPoint && onBoxZoom) {
      onBoxZoom(startPoint.x, startPoint.y, currentPoint.x, currentPoint.y)
    }

    if (mode === 'lasso-select' && lassoPoints.length > 2 && onLassoSelect) {
      onLassoSelect(lassoPoints)
    }

    setIsSelecting(false)
    setStartPoint(null)
    setCurrentPoint(null)
    setLassoPoints([])
    onModeChange?.('none')
  }, [isSelecting, mode, startPoint, currentPoint, lassoPoints, onBoxZoom, onLassoSelect, onModeChange])

  // Handle escape to cancel selection
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isSelecting) {
        setIsSelecting(false)
        setStartPoint(null)
        setCurrentPoint(null)
        setLassoPoints([])
        onModeChange?.('none')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isSelecting, onModeChange])

  if (mode === 'none') return null

  // Calculate box selection rect
  const getBoxRect = () => {
    if (!startPoint || !currentPoint) return null

    return {
      left: Math.min(startPoint.x, currentPoint.x),
      top: Math.min(startPoint.y, currentPoint.y),
      width: Math.abs(currentPoint.x - startPoint.x),
      height: Math.abs(currentPoint.y - startPoint.y),
    }
  }

  // Generate lasso SVG path
  const getLassoPath = () => {
    if (lassoPoints.length < 2) return ''

    return lassoPoints
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
      .join(' ') + ' Z'
  }

  const boxRect = getBoxRect()

  return (
    <div
      ref={overlayRef}
      className="absolute inset-0 z-20"
      style={{
        cursor: mode === 'box-zoom' ? 'zoom-in' : mode === 'lasso-select' ? 'crosshair' : 'default',
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Mode indicator */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-accent text-white px-3 py-1 rounded-full text-sm font-sans shadow-lg">
        {mode === 'box-zoom' ? 'Box Zoom - Click and drag' : 'Lasso Select - Draw around items'}
        <span className="ml-2 opacity-75">(ESC to cancel)</span>
      </div>

      {/* Box selection rectangle */}
      {mode === 'box-zoom' && isSelecting && boxRect && (
        <div
          className="absolute border-2 border-accent bg-accent/10 pointer-events-none"
          style={{
            left: boxRect.left,
            top: boxRect.top,
            width: boxRect.width,
            height: boxRect.height,
          }}
        />
      )}

      {/* Lasso selection path */}
      {mode === 'lasso-select' && isSelecting && lassoPoints.length > 1 && (
        <svg className="absolute inset-0 pointer-events-none">
          <path
            d={getLassoPath()}
            fill="rgba(139, 69, 19, 0.1)"
            stroke="#8B4513"
            strokeWidth="2"
            strokeDasharray="5,5"
          />
        </svg>
      )}
    </div>
  )
}

// Hook for managing selection mode
export function useSelectionMode() {
  const [mode, setMode] = useState<SelectionMode>('none')

  const activateBoxZoom = useCallback(() => setMode('box-zoom'), [])
  const activateLassoSelect = useCallback(() => setMode('lasso-select'), [])
  const deactivate = useCallback(() => setMode('none'), [])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // B for box zoom (when not in input)
      if (e.key === 'b' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        e.preventDefault()
        setMode(prev => prev === 'box-zoom' ? 'none' : 'box-zoom')
      }
      // L for lasso select (when not in input)
      if (e.key === 'l' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        e.preventDefault()
        setMode(prev => prev === 'lasso-select' ? 'none' : 'lasso-select')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return {
    mode,
    setMode,
    activateBoxZoom,
    activateLassoSelect,
    deactivate,
    isActive: mode !== 'none',
  }
}

// Utility function to check if a point is inside a polygon (for lasso selection)
export function isPointInPolygon(point: Point, polygon: Point[]): boolean {
  if (polygon.length < 3) return false

  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x
    const yi = polygon[i].y
    const xj = polygon[j].x
    const yj = polygon[j].y

    if (((yi > point.y) !== (yj > point.y)) &&
        (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi)) {
      inside = !inside
    }
  }

  return inside
}
