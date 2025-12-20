'use client'

import { useQuery } from '@tanstack/react-query'
import { thinkersApi, connectionsApi, combinedViewsApi } from '@/lib/api'
import { useRef, useEffect, useState, useMemo, useCallback } from 'react'
import { DEFAULT_START_YEAR, DEFAULT_END_YEAR, TIMELINE_PADDING, TIMELINE_CONTENT_WIDTH_PERCENT, CONNECTION_STYLES, getConnectionLineWidth, ConnectionStyleType } from '@/lib/constants'
import type { Thinker, Connection, TimelineEvent, CombinedViewMember, Timeline } from '@/types'

interface CombinedTimelineCanvasProps {
  viewId: string
  onThinkerClick?: (thinkerId: string, isShiftClick?: boolean) => void
  onCanvasClick?: (position: { x: number; y: number }, timelineId: string) => void
  onConnectionClick?: (connectionId: string) => void
  selectedThinkerId?: string | null
}

// Timeline color palette for distinguishing thinkers from different timelines
const TIMELINE_COLORS = [
  { bg: '#DBEAFE', border: '#3B82F6', dot: '#2563EB', name: 'blue' },    // Blue
  { bg: '#FCE7F3', border: '#EC4899', dot: '#DB2777', name: 'pink' },    // Pink
  { bg: '#D1FAE5', border: '#10B981', dot: '#059669', name: 'green' },   // Green
  { bg: '#FEF3C7', border: '#F59E0B', dot: '#D97706', name: 'yellow' },  // Yellow
  { bg: '#E9D5FF', border: '#A855F7', dot: '#9333EA', name: 'purple' },  // Purple
  { bg: '#FFEDD5', border: '#F97316', dot: '#EA580C', name: 'orange' },  // Orange
  { bg: '#CFFAFE', border: '#06B6D4', dot: '#0891B2', name: 'cyan' },    // Cyan
]

export function CombinedTimelineCanvas({
  viewId,
  onThinkerClick,
  onCanvasClick,
  onConnectionClick,
  selectedThinkerId
}: CombinedTimelineCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [offsetX, setOffsetX] = useState(0)
  const [offsetY, setOffsetY] = useState(0)
  const [isPanning, setIsPanning] = useState(false)
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 })
  const [canvasSize, setCanvasSize] = useState({ width: 1200, height: 600 })

  const { data: combinedView } = useQuery({
    queryKey: ['combined-view', viewId],
    queryFn: () => combinedViewsApi.getOne(viewId),
  })

  const { data: allThinkers = [] } = useQuery({
    queryKey: ['thinkers'],
    queryFn: () => thinkersApi.getAll(),
  })

  const { data: connections = [] } = useQuery({
    queryKey: ['connections'],
    queryFn: connectionsApi.getAll,
  })

  const { data: timelineEvents = [] } = useQuery({
    queryKey: ['combined-view-events', viewId],
    queryFn: () => combinedViewsApi.getEvents(viewId),
    enabled: !!viewId,
  })

  // Get timeline IDs and create a color map
  const timelineColorMap = useMemo(() => {
    if (!combinedView) return new Map<string, typeof TIMELINE_COLORS[0]>()
    const map = new Map<string, typeof TIMELINE_COLORS[0]>()
    combinedView.members.forEach((member: CombinedViewMember, index: number) => {
      map.set(member.timeline_id, TIMELINE_COLORS[index % TIMELINE_COLORS.length])
    })
    return map
  }, [combinedView])

  // Filter thinkers to only those in the combined view's timelines
  const filteredThinkers = useMemo(() => {
    if (!combinedView) return []
    const timelineIds = new Set(combinedView.members.map((m: CombinedViewMember) => m.timeline_id))
    return allThinkers.filter(t => timelineIds.has(t.timeline_id || ''))
  }, [allThinkers, combinedView])

  // Filter connections to only those between visible thinkers
  const filteredConnections = useMemo(() => {
    const visibleThinkerIds = new Set(filteredThinkers.map(t => t.id))
    return connections.filter(
      c => visibleThinkerIds.has(c.from_thinker_id) && visibleThinkerIds.has(c.to_thinker_id)
    )
  }, [connections, filteredThinkers])

  // Resize canvas to fit container
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setCanvasSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height
        })
      }
    })

    resizeObserver.observe(container)
    return () => resizeObserver.disconnect()
  }, [])

  // Helper function to calculate the year to use for positioning a thinker
  // Priority: anchor_year > midpoint of birth/death > death_year > birth_year
  const getThinkerYear = (thinker: Thinker): number | null => {
    if (thinker.anchor_year) return thinker.anchor_year
    // If both birth and death years are available, use the midpoint
    if (thinker.birth_year && thinker.death_year) {
      return Math.round((thinker.birth_year + thinker.death_year) / 2)
    }
    if (thinker.death_year) return thinker.death_year
    if (thinker.birth_year) return thinker.birth_year
    return null
  }

  // Calculate unified year range across all timelines
  const calculateYearRange = useCallback(() => {
    if (!combinedView) return { startYear: DEFAULT_START_YEAR, endYear: DEFAULT_END_YEAR }

    let minYear = Infinity
    let maxYear = -Infinity

    // Consider all timeline bounds
    combinedView.members.forEach((member: CombinedViewMember) => {
      const timeline = member.timeline
      if (timeline.start_year != null) minYear = Math.min(minYear, timeline.start_year)
      if (timeline.end_year != null) maxYear = Math.max(maxYear, timeline.end_year)
    })

    // Consider all thinkers' years
    filteredThinkers.forEach((thinker) => {
      if (thinker.birth_year) minYear = Math.min(minYear, thinker.birth_year)
      if (thinker.death_year) maxYear = Math.max(maxYear, thinker.death_year)
    })

    // Consider all events
    timelineEvents.forEach((event) => {
      minYear = Math.min(minYear, event.year)
      maxYear = Math.max(maxYear, event.year)
    })

    if (minYear === Infinity) minYear = DEFAULT_START_YEAR
    if (maxYear === -Infinity) maxYear = DEFAULT_END_YEAR

    // Add padding
    const padding = Math.max(50, Math.floor((maxYear - minYear) * 0.1))
    return {
      startYear: Math.floor((minYear - padding) / 10) * 10,
      endYear: Math.ceil((maxYear + padding) / 10) * 10
    }
  }, [combinedView, filteredThinkers, timelineEvents])

  // Convert year to X position
  const yearToX = useCallback((year: number, canvasWidth: number): number => {
    const { startYear, endYear } = calculateYearRange()
    const yearSpan = endYear - startYear
    const pixelsPerYear = (canvasWidth * TIMELINE_CONTENT_WIDTH_PERCENT) / yearSpan
    return (TIMELINE_PADDING + (year - startYear) * pixelsPerYear) * scale + offsetX
  }, [calculateYearRange, scale, offsetX])

  // Convert X position back to year
  const xToYear = useCallback((x: number, canvasWidth: number): number => {
    const { startYear, endYear } = calculateYearRange()
    const yearSpan = endYear - startYear
    const pixelsPerYear = (canvasWidth * TIMELINE_CONTENT_WIDTH_PERCENT) / yearSpan
    const baseX = (x - offsetX) / scale
    return Math.round((baseX - TIMELINE_PADDING) / pixelsPerYear + startYear)
  }, [calculateYearRange, scale, offsetX])

  // Calculate year interval for labels based on zoom
  const getYearInterval = useCallback((canvasWidth: number, yearSpan: number): number => {
    const minPixelSpacing = 80
    const pixelsPerYear = (canvasWidth * TIMELINE_CONTENT_WIDTH_PERCENT * scale) / yearSpan
    const minYearInterval = minPixelSpacing / pixelsPerYear
    const niceIntervals = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000]
    return niceIntervals.find(i => i >= minYearInterval) || 5000
  }, [scale])

  // Calculate thinker positions with collision detection
  const calculateThinkerPositions = useCallback((
    thinkers: Thinker[],
    canvasWidth: number,
    canvasHeight: number
  ): Map<string, { x: number; y: number; width: number; height: number }> => {
    const positions = new Map<string, { x: number; y: number; width: number; height: number }>()
    const canvas = canvasRef.current
    if (!canvas) return positions
    const ctx = canvas.getContext('2d')
    if (!ctx) return positions

    const centerY = canvasHeight / 2

    // First pass: calculate base positions and sizes
    const thinkerData: { id: string; x: number; baseY: number; width: number; height: number }[] = []

    thinkers.forEach((thinker) => {
      const thinkerYear = getThinkerYear(thinker)
      if (!thinkerYear) return

      const x = yearToX(thinkerYear, canvasWidth)

      ctx.font = '13px "Crimson Text", serif'
      const metrics = ctx.measureText(thinker.name)
      const padding = 8
      // Add extra width for timeline indicator dot
      const bgWidth = metrics.width + padding * 2 + 16
      const bgHeight = 24

      thinkerData.push({
        id: thinker.id,
        x,
        baseY: thinker.position_y ? thinker.position_y + centerY : centerY,
        width: bgWidth,
        height: bgHeight
      })
    })

    // Sort by x position for collision detection
    thinkerData.sort((a, b) => a.x - b.x)

    // Collision detection parameters
    const MIN_HORIZONTAL_GAP = 8
    const MIN_VERTICAL_GAP = 6
    const elevationOffset = -5 // Small offset to position thinkers just above the timeline line

    // Second pass: resolve collisions
    const placed: { x: number; y: number; width: number; height: number }[] = []

    thinkerData.forEach((thinker) => {
      let y = thinker.baseY + elevationOffset
      let foundPosition = false
      let attempts = 0
      const maxAttempts = 30

      while (!foundPosition && attempts < maxAttempts) {
        foundPosition = true

        for (const existing of placed) {
          const horizontalOverlap = Math.abs(thinker.x - existing.x) < (thinker.width + existing.width) / 2 + MIN_HORIZONTAL_GAP
          if (horizontalOverlap) {
            const verticalOverlap = Math.abs(y - existing.y) < (thinker.height + existing.height) / 2 + MIN_VERTICAL_GAP
            if (verticalOverlap) {
              // Alternate stacking direction
              if (attempts % 2 === 0) {
                y = existing.y - existing.height / 2 - thinker.height / 2 - MIN_VERTICAL_GAP
              } else {
                y = existing.y + existing.height / 2 + thinker.height / 2 + MIN_VERTICAL_GAP
              }
              foundPosition = false
              break
            }
          }
        }
        attempts++
      }

      placed.push({ x: thinker.x, y, width: thinker.width, height: thinker.height })
      positions.set(thinker.id, { x: thinker.x, y, width: thinker.width, height: thinker.height })
    })

    return positions
  }, [yearToX])

  // Main drawing effect
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !combinedView) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // High-DPI canvas scaling
    const dpr = window.devicePixelRatio || 1
    const canvasWidth = canvasSize.width
    const canvasHeight = canvasSize.height

    canvas.width = canvasWidth * dpr
    canvas.height = canvasHeight * dpr
    ctx.scale(dpr, dpr)

    ctx.clearRect(0, 0, canvasWidth, canvasHeight)

    const { startYear, endYear } = calculateYearRange()
    const yearSpan = endYear - startYear
    const centerY = canvasHeight / 2

    // Draw grid
    ctx.strokeStyle = '#F0F0F0'
    ctx.lineWidth = 1
    const gridSize = 50
    for (let x = 0; x < canvasWidth; x += gridSize) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, canvasHeight)
      ctx.stroke()
    }
    for (let y = 0; y < canvasHeight; y += gridSize) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(canvasWidth, y)
      ctx.stroke()
    }

    // Draw main timeline axis
    ctx.strokeStyle = '#E0E0E0'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(0, centerY)
    ctx.lineTo(canvasWidth, centerY)
    ctx.stroke()

    // Draw year labels
    const interval = getYearInterval(canvasWidth, yearSpan)
    ctx.fillStyle = '#666666'
    ctx.font = '12px "JetBrains Mono", monospace'
    ctx.textAlign = 'center'

    for (let year = Math.ceil(startYear / interval) * interval; year <= endYear; year += interval) {
      const x = yearToX(year, canvasWidth)
      if (x >= 0 && x <= canvasWidth) {
        ctx.fillText(year.toString(), x, centerY + 30)

        ctx.strokeStyle = '#CCCCCC'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(x, centerY - 10)
        ctx.lineTo(x, centerY + 10)
        ctx.stroke()
      }
    }

    // Draw timeline events
    timelineEvents.forEach((event: TimelineEvent) => {
      const x = yearToX(event.year, canvasWidth)
      if (x < 0 || x > canvasWidth) return

      const y = centerY - 15
      const timelineColor = timelineColorMap.get(event.timeline_id)

      ctx.fillStyle = timelineColor?.dot || '#8B4513'
      ctx.strokeStyle = timelineColor?.border || '#6B3410'
      ctx.lineWidth = 2

      const size = 8
      switch (event.event_type) {
        case 'council':
          ctx.beginPath()
          ctx.moveTo(x, y - size)
          ctx.lineTo(x - size, y + size)
          ctx.lineTo(x + size, y + size)
          ctx.closePath()
          ctx.fill()
          ctx.stroke()
          break
        case 'publication':
          ctx.fillRect(x - size, y - size, size * 2, size * 2)
          ctx.strokeRect(x - size, y - size, size * 2, size * 2)
          break
        default:
          ctx.beginPath()
          ctx.arc(x, y, size, 0, Math.PI * 2)
          ctx.fill()
          ctx.stroke()
      }

      ctx.fillStyle = '#333333'
      ctx.font = '10px "JetBrains Mono", monospace'
      ctx.textAlign = 'center'
      ctx.fillText(event.name, x, y - size - 5)
    })

    // Calculate thinker positions
    const positions = calculateThinkerPositions(filteredThinkers, canvasWidth, canvasHeight)

    // Draw connections
    filteredConnections.forEach((conn: Connection) => {
      const fromThinker = filteredThinkers.find(t => t.id === conn.from_thinker_id)
      const toThinker = filteredThinkers.find(t => t.id === conn.to_thinker_id)
      if (!fromThinker || !toThinker) return

      const fromPos = positions.get(fromThinker.id)
      const toPos = positions.get(toThinker.id)
      if (!fromPos || !toPos) return

      const connType = conn.connection_type as ConnectionStyleType
      const style = CONNECTION_STYLES[connType] || CONNECTION_STYLES.influenced
      const isHighlighted = selectedThinkerId &&
        (conn.from_thinker_id === selectedThinkerId || conn.to_thinker_id === selectedThinkerId)

      const baseLineWidth = getConnectionLineWidth(conn.strength)
      ctx.strokeStyle = isHighlighted ? style.highlightColor : style.color
      ctx.lineWidth = isHighlighted ? baseLineWidth + 1 : baseLineWidth
      ctx.globalAlpha = isHighlighted ? 1.0 : 0.5
      ctx.setLineDash(style.dashPattern)

      const fromX = fromPos.x
      const fromY = fromPos.y + fromPos.height / 2
      const toX = toPos.x
      const toY = toPos.y + toPos.height / 2

      ctx.beginPath()
      ctx.moveTo(fromX, fromY)
      const midY = Math.max(fromY, toY) + 30
      ctx.bezierCurveTo(fromX, midY, toX, midY, toX, toY)
      ctx.stroke()

      // Arrow
      ctx.setLineDash([])
      const arrowSize = 6 + ctx.lineWidth
      const angle = Math.atan2(toY - midY, toX - toX)
      ctx.beginPath()
      ctx.moveTo(toX, toY)
      ctx.lineTo(toX - arrowSize, toY + arrowSize)
      ctx.lineTo(toX + arrowSize, toY + arrowSize)
      ctx.closePath()
      ctx.fillStyle = isHighlighted ? style.highlightColor : style.color
      ctx.fill()

      ctx.globalAlpha = 1.0
    })

    // Draw thinkers
    filteredThinkers.forEach((thinker) => {
      const pos = positions.get(thinker.id)
      if (!pos) return

      const { x, y, width: bgWidth, height: bgHeight } = pos
      const isSelected = thinker.id === selectedThinkerId
      const timelineColor = timelineColorMap.get(thinker.timeline_id || '')

      // Draw background rectangle with timeline color tint
      if (isSelected) {
        ctx.fillStyle = '#8B4513'
        ctx.strokeStyle = '#6B3410'
        ctx.lineWidth = 2
      } else {
        ctx.fillStyle = timelineColor?.bg || '#FFFFFF'
        ctx.strokeStyle = timelineColor?.border || '#CCCCCC'
        ctx.lineWidth = 1
      }

      // Rounded rectangle
      const radius = 4
      ctx.beginPath()
      ctx.moveTo(x - bgWidth / 2 + radius, y - bgHeight / 2)
      ctx.lineTo(x + bgWidth / 2 - radius, y - bgHeight / 2)
      ctx.quadraticCurveTo(x + bgWidth / 2, y - bgHeight / 2, x + bgWidth / 2, y - bgHeight / 2 + radius)
      ctx.lineTo(x + bgWidth / 2, y + bgHeight / 2 - radius)
      ctx.quadraticCurveTo(x + bgWidth / 2, y + bgHeight / 2, x + bgWidth / 2 - radius, y + bgHeight / 2)
      ctx.lineTo(x - bgWidth / 2 + radius, y + bgHeight / 2)
      ctx.quadraticCurveTo(x - bgWidth / 2, y + bgHeight / 2, x - bgWidth / 2, y + bgHeight / 2 - radius)
      ctx.lineTo(x - bgWidth / 2, y - bgHeight / 2 + radius)
      ctx.quadraticCurveTo(x - bgWidth / 2, y - bgHeight / 2, x - bgWidth / 2 + radius, y - bgHeight / 2)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()

      // Draw timeline indicator dot
      const dotRadius = 5
      const dotX = x - bgWidth / 2 + 10
      ctx.beginPath()
      ctx.arc(dotX, y, dotRadius, 0, Math.PI * 2)
      ctx.fillStyle = timelineColor?.dot || '#666666'
      ctx.fill()

      // Draw name
      ctx.fillStyle = isSelected ? '#FFFFFF' : '#1A1A1A'
      ctx.font = '13px "Crimson Text", serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(thinker.name, x + 6, y)
    })

    // Draw legend for timeline colors (top-right corner)
    if (combinedView && combinedView.members.length > 0) {
      const legendX = canvasWidth - 20
      const legendY = 20
      const legendItemHeight = 22
      const legendPadding = 10

      // Calculate legend width based on longest timeline name
      ctx.font = '11px "Inter", sans-serif'
      let maxNameWidth = 0
      combinedView.members.forEach((member: CombinedViewMember) => {
        const width = ctx.measureText(member.timeline.name).width
        if (width > maxNameWidth) maxNameWidth = width
      })

      const legendWidth = maxNameWidth + 35 + legendPadding * 2
      const legendHeight = combinedView.members.length * legendItemHeight + legendPadding * 2

      // Draw legend background
      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)'
      ctx.strokeStyle = '#E5E7EB'
      ctx.lineWidth = 1
      ctx.fillRect(legendX - legendWidth, legendY, legendWidth, legendHeight)
      ctx.strokeRect(legendX - legendWidth, legendY, legendWidth, legendHeight)

      // Draw legend items
      combinedView.members.forEach((member: CombinedViewMember, index: number) => {
        const color = timelineColorMap.get(member.timeline_id)
        const itemY = legendY + legendPadding + index * legendItemHeight + 10

        // Color dot
        ctx.beginPath()
        ctx.arc(legendX - legendWidth + legendPadding + 8, itemY, 6, 0, Math.PI * 2)
        ctx.fillStyle = color?.dot || '#666666'
        ctx.fill()

        // Timeline name
        ctx.fillStyle = '#374151'
        ctx.font = '11px "Inter", sans-serif'
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        ctx.fillText(member.timeline.name, legendX - legendWidth + legendPadding + 22, itemY)
      })
    }

  }, [combinedView, filteredThinkers, filteredConnections, timelineEvents, scale, offsetX, offsetY, selectedThinkerId, canvasSize, calculateYearRange, yearToX, getYearInterval, calculateThinkerPositions, timelineColorMap])

  // Handle wheel for zoom/pan
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const handleWheelNative = (e: WheelEvent) => {
      e.preventDefault()

      const rect = canvas.getBoundingClientRect()

      // INVERTED: Regular scroll = zoom, Cmd/Ctrl+scroll = pan
      const isPan = e.ctrlKey || e.metaKey
      const isPinchZoom = Math.abs(e.deltaY) < 10 && e.ctrlKey

      if (!isPan || isPinchZoom) {
        // ZOOM
        const mouseX = e.clientX - rect.left
        const oldScale = scale

        const zoomSensitivity = Math.abs(e.deltaY) < 10 ? 0.03 : 0.001
        const delta = 1 - e.deltaY * zoomSensitivity
        const newScale = Math.max(0.1, Math.min(50, oldScale * delta))

        // Zoom toward mouse position
        const { startYear, endYear } = calculateYearRange()
        const yearSpan = endYear - startYear
        const pixelsPerYear = (rect.width * TIMELINE_CONTENT_WIDTH_PERCENT) / yearSpan

        const mouseXBeforeZoom = (mouseX - offsetX - TIMELINE_PADDING * oldScale) / (pixelsPerYear * oldScale)
        const mouseXAfterZoom = mouseXBeforeZoom * pixelsPerYear * newScale
        const newOffsetX = mouseX - TIMELINE_PADDING * newScale - mouseXAfterZoom

        setScale(newScale)
        setOffsetX(newOffsetX)
      } else {
        // PAN
        const panMultiplier = 1.5
        setOffsetX(prev => prev - e.deltaY * panMultiplier)
        setOffsetY(prev => prev - e.deltaX * panMultiplier)
      }
    }

    canvas.addEventListener('wheel', handleWheelNative, { passive: false })
    return () => canvas.removeEventListener('wheel', handleWheelNative)
  }, [scale, offsetX, offsetY, calculateYearRange])

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsPanning(true)
    setLastMousePos({ x: e.clientX, y: e.clientY })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return

    const dx = e.clientX - lastMousePos.x
    const dy = e.clientY - lastMousePos.y
    setOffsetX(prev => prev + dx)
    setOffsetY(prev => prev + dy)
    setLastMousePos({ x: e.clientX, y: e.clientY })
  }

  const handleMouseUp = () => {
    setIsPanning(false)
  }

  const getThinkerAtPosition = (clickX: number, clickY: number): Thinker | null => {
    const positions = calculateThinkerPositions(filteredThinkers, canvasSize.width, canvasSize.height)

    for (const thinker of filteredThinkers) {
      const pos = positions.get(thinker.id)
      if (!pos) continue

      const { x, y, width: bgWidth, height: bgHeight } = pos
      if (clickX >= x - bgWidth / 2 && clickX <= x + bgWidth / 2 &&
          clickY >= y - bgHeight / 2 && clickY <= y + bgHeight / 2) {
        return thinker
      }
    }
    return null
  }

  const handleClick = (e: React.MouseEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const clickY = e.clientY - rect.top
    const isShiftClick = e.shiftKey

    const thinker = getThinkerAtPosition(clickX, clickY)
    if (thinker) {
      onThinkerClick?.(thinker.id, isShiftClick)
    }
  }

  return (
    <div ref={containerRef} className="w-full h-full overflow-hidden relative" data-testid="combined-timeline-container">
      <canvas
        ref={canvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleClick}
        className="cursor-grab active:cursor-grabbing"
        style={{ touchAction: 'none' }}
        data-testid="combined-timeline-canvas"
      />
      {/* Zoom indicator */}
      <div
        className="absolute bottom-4 left-4 bg-white/80 px-2 py-1 rounded text-xs font-mono text-gray-600 border border-gray-200"
        data-testid="zoom-indicator"
      >
        {Math.round(scale * 100)}%
      </div>
      {/* Zoom controls */}
      <div className="absolute bottom-4 right-4 flex gap-2">
        <button
          onClick={() => setScale(prev => Math.min(50, prev * 1.2))}
          className="px-3 py-2 bg-white border border-gray-200 rounded shadow-sm hover:bg-gray-50 text-sm"
          data-testid="zoom-in-button"
        >
          +
        </button>
        <button
          onClick={() => setScale(prev => Math.max(0.1, prev * 0.8))}
          className="px-3 py-2 bg-white border border-gray-200 rounded shadow-sm hover:bg-gray-50 text-sm"
          data-testid="zoom-out-button"
        >
          −
        </button>
        <button
          onClick={() => { setScale(1); setOffsetX(0); setOffsetY(0) }}
          className="px-3 py-2 bg-white border border-gray-200 rounded shadow-sm hover:bg-gray-50 text-sm"
          data-testid="reset-view-button"
        >
          Reset
        </button>
      </div>
    </div>
  )
}
