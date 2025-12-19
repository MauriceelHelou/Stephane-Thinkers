'use client'

import { useQuery } from '@tanstack/react-query'
import { thinkersApi, connectionsApi, combinedViewsApi } from '@/lib/api'
import { useRef, useEffect, useState, useCallback } from 'react'
import { REFERENCE_CANVAS_WIDTH, TIMELINE_PADDING, TIMELINE_CONTENT_WIDTH_PERCENT } from '@/lib/constants'
import type { Thinker, Connection, TimelineEvent, CombinedViewMember } from '@/types'

interface CombinedTimelineCanvasProps {
  viewId: string
  onThinkerClick?: (thinkerId: string, isShiftClick?: boolean) => void
  onCanvasClick?: (position: { x: number; y: number }, timelineId: string) => void
  onConnectionClick?: (connectionId: string) => void
  selectedThinkerId?: string | null
}

const LANE_LABEL_HEIGHT = 24
const TOP_SCALE_HEIGHT = 40

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
  const [isPanning, setIsPanning] = useState(false)
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 })
  const [canvasSize, setCanvasSize] = useState({ width: 1200, height: 600 })

  const { data: combinedView } = useQuery({
    queryKey: ['combined-view', viewId],
    queryFn: () => combinedViewsApi.getOne(viewId),
  })

  const { data: thinkers = [] } = useQuery({
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
  // Priority: anchor_year (if set) > death_year > birth_year > null
  // This ensures predictable positioning based on available data
  const getThinkerYear = (thinker: Thinker): number | null => {
    // If anchor_year is explicitly set (e.g., after user drag), use it
    if (thinker.anchor_year) {
      return thinker.anchor_year
    }
    // Otherwise, prefer death_year as it represents the end of their productive life
    if (thinker.death_year) {
      return thinker.death_year
    }
    // If only birth_year is available, use that as the position
    if (thinker.birth_year) {
      return thinker.birth_year
    }
    return null
  }

  // Calculate UNIFIED date range across ALL timelines in the combined view
  const calculateUnifiedRange = useCallback(() => {
    if (!combinedView) return { startYear: -500, endYear: 2000 }

    let minYear = Infinity
    let maxYear = -Infinity

    // Consider all timeline bounds
    combinedView.members.forEach((member: CombinedViewMember) => {
      const timeline = member.timeline
      if (timeline.start_year != null) {
        minYear = Math.min(minYear, timeline.start_year)
      }
      if (timeline.end_year != null) {
        maxYear = Math.max(maxYear, timeline.end_year)
      }
    })

    // Also consider all thinkers' years in these timelines
    const timelineIds = new Set(combinedView.members.map((m: CombinedViewMember) => m.timeline_id))
    thinkers.forEach((thinker) => {
      if (timelineIds.has(thinker.timeline_id || '')) {
        if (thinker.birth_year) minYear = Math.min(minYear, thinker.birth_year)
        if (thinker.death_year) maxYear = Math.max(maxYear, thinker.death_year)
      }
    })

    // Also consider events
    timelineEvents.forEach((event) => {
      if (timelineIds.has(event.timeline_id)) {
        minYear = Math.min(minYear, event.year)
        maxYear = Math.max(maxYear, event.year)
      }
    })

    // Handle edge cases
    if (minYear === Infinity) minYear = -500
    if (maxYear === -Infinity) maxYear = 2000

    // Add padding
    const span = maxYear - minYear
    const padding = Math.max(50, span * 0.05)
    return {
      startYear: Math.floor((minYear - padding) / 10) * 10,
      endYear: Math.ceil((maxYear + padding) / 10) * 10
    }
  }, [combinedView, thinkers, timelineEvents])

  // Convert year to X position using UNIFIED scale
  const yearToX = useCallback((year: number, canvasWidth: number): number => {
    const { startYear, endYear } = calculateUnifiedRange()
    const yearSpan = endYear - startYear
    const contentWidth = canvasWidth * TIMELINE_CONTENT_WIDTH_PERCENT
    const pixelsPerYear = contentWidth / yearSpan
    return TIMELINE_PADDING + (year - startYear) * pixelsPerYear * scale + offsetX
  }, [calculateUnifiedRange, scale, offsetX])

  const getEventSymbol = (eventType: string) => {
    switch (eventType) {
      case 'council': return '△'
      case 'publication': return '▢'
      case 'war': return '◇'
      case 'invention': return '★'
      case 'cultural': return '●'
      case 'political': return '■'
      default: return '○'
    }
  }

  // Calculate year interval for labels based on zoom with quarter tick support
  const getYearIntervals = useCallback((yearSpan: number, canvasWidth: number): { majorInterval: number; minorInterval: number } => {
    const minMajorSpacing = 80
    const pixelsPerYear = (canvasWidth * TIMELINE_CONTENT_WIDTH_PERCENT * scale) / yearSpan
    const minMajorInterval = minMajorSpacing / pixelsPerYear

    // Support sub-year granularity
    const majorIntervals = [0.25, 0.5, 1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000]
    let majorInterval = majorIntervals.find(i => i >= minMajorInterval) || 2000

    // Minor ticks are quarter of major (for quarter-year granularity)
    const minorInterval = majorInterval / 4

    return { majorInterval, minorInterval }
  }, [scale])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !combinedView) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // High-DPI canvas scaling to prevent pixelation
    const dpr = window.devicePixelRatio || 1
    const canvasWidth = canvasSize.width
    const canvasHeight = canvasSize.height

    // Set canvas internal resolution to match device pixel ratio
    canvas.width = canvasWidth * dpr
    canvas.height = canvasHeight * dpr

    // Scale the context to match
    ctx.scale(dpr, dpr)

    // Clear canvas
    ctx.clearRect(0, 0, canvasWidth, canvasHeight)

    const { startYear, endYear } = calculateUnifiedRange()
    const yearSpan = endYear - startYear
    const { majorInterval, minorInterval } = getYearIntervals(yearSpan, canvasWidth)
    const numLanes = combinedView.members.length

    // Calculate dynamic lane height to fill screen
    const availableHeight = canvasHeight - TOP_SCALE_HEIGHT
    const laneHeight = numLanes > 0 ? availableHeight / numLanes : availableHeight
    const axisOffset = laneHeight * 0.6 // Position axis 60% down within each lane

    // Draw unified year scale at the top with quarter ticks
    ctx.fillStyle = '#f3f4f6'
    ctx.fillRect(0, 0, canvasWidth, TOP_SCALE_HEIGHT)

    // Draw minor (quarter) ticks first
    const tickStart = Math.floor(startYear / minorInterval) * minorInterval
    for (let year = tickStart; year <= endYear; year += minorInterval) {
      const x = yearToX(year, canvasWidth)
      if (x >= 0 && x <= canvasWidth) {
        const isMajor = Math.abs(year % majorInterval) < 0.001 || Math.abs(year % majorInterval - majorInterval) < 0.001

        if (isMajor) {
          // Major tick - with label
          ctx.fillStyle = '#374151'
          ctx.font = '12px "JetBrains Mono", monospace'
          ctx.textAlign = 'center'
          const label = Number.isInteger(year) ? year.toString() : year.toFixed(2)
          ctx.fillText(label, x, 28)

          // Major grid line
          ctx.strokeStyle = '#e5e7eb'
          ctx.lineWidth = 1
        } else {
          // Minor tick - just a subtle grid line
          ctx.strokeStyle = '#f3f4f6'
          ctx.lineWidth = 0.5
        }

        ctx.beginPath()
        ctx.moveTo(x, TOP_SCALE_HEIGHT)
        ctx.lineTo(x, canvasHeight)
        ctx.stroke()
      }
    }

    // Draw each timeline lane - evenly distributed to fill screen
    combinedView.members.forEach((member: CombinedViewMember, index: number) => {
      const laneTop = TOP_SCALE_HEIGHT + index * laneHeight
      const timeline = member.timeline

      // Lane background - alternating colors
      ctx.fillStyle = index % 2 === 0 ? '#fafafa' : '#f5f5f5'
      ctx.fillRect(0, laneTop, canvasWidth, laneHeight)

      // Lane border
      ctx.strokeStyle = '#e5e7eb'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(0, laneTop + laneHeight)
      ctx.lineTo(canvasWidth, laneTop + laneHeight)
      ctx.stroke()

      // Timeline name label (fixed on left side, in a badge)
      ctx.fillStyle = 'rgba(255,255,255,0.9)'
      ctx.fillRect(5, laneTop + 5, ctx.measureText(timeline.name).width + 20, 22)
      ctx.fillStyle = '#1f2937'
      ctx.font = 'bold 13px "Inter", sans-serif'
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.fillText(timeline.name, 15, laneTop + 16)

      // Timeline axis line
      const axisY = laneTop + axisOffset
      ctx.strokeStyle = '#d1d5db'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(0, axisY)
      ctx.lineTo(canvasWidth, axisY)
      ctx.stroke()

      // Collect all items for this lane to stack them together
      const laneEvents = timelineEvents.filter(e => e.timeline_id === timeline.id)
      const laneThinkers = thinkers.filter(t => t.timeline_id === timeline.id)

      // Combined placement tracking for both events and thinkers
      type PlacedItem = { x: number; y: number; width: number; height: number; type: 'event' | 'thinker' }
      const placedItems: PlacedItem[] = []

      const horizontalMargin = Math.max(5, 15 / scale)
      const verticalSpacing = Math.max(4, 8 / Math.sqrt(scale))

      // Place events first (above the axis)
      laneEvents.forEach((event: TimelineEvent) => {
        const x = yearToX(event.year, canvasWidth)
        if (x < -100 || x > canvasWidth + 100) return

        ctx.font = '9px "Inter", sans-serif'
        const truncatedName = event.name.length > 18 ? event.name.substring(0, 15) + '...' : event.name
        const labelWidth = ctx.measureText(truncatedName).width + 10
        const itemHeight = 30

        // Find non-overlapping position
        let y = axisY - 35
        let foundPosition = false
        let attempts = 0
        while (!foundPosition && attempts < 20) {
          foundPosition = true
          for (const placed of placedItems) {
            const hOverlap = Math.abs(x - placed.x) < (labelWidth + placed.width) / 2 + horizontalMargin
            const vOverlap = Math.abs(y - placed.y) < (itemHeight + placed.height) / 2 + verticalSpacing
            if (hOverlap && vOverlap) {
              y = placed.y - placed.height / 2 - itemHeight / 2 - verticalSpacing
              foundPosition = false
              break
            }
          }
          attempts++
        }

        // Clamp to lane bounds
        y = Math.max(laneTop + itemHeight / 2 + 5, y)

        placedItems.push({ x, y, width: labelWidth, height: itemHeight, type: 'event' })

        // Draw event
        ctx.fillStyle = '#8B4513'
        ctx.font = '16px sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(getEventSymbol(event.event_type), x, y + 8)

        ctx.fillStyle = '#4b5563'
        ctx.font = '9px "Inter", sans-serif'
        ctx.fillText(truncatedName, x, y - 8)
      })

      // Place thinkers
      laneThinkers.forEach((thinker: Thinker) => {
        const year = getThinkerYear(thinker)
        if (!year) return

        const x = yearToX(year, canvasWidth)
        if (x < -100 || x > canvasWidth + 100) return

        const isSelected = thinker.id === selectedThinkerId

        ctx.font = '12px "Crimson Text", serif'
        const textWidth = ctx.measureText(thinker.name).width
        const boxWidth = textWidth + 16
        const boxHeight = 24

        // Find non-overlapping position
        let y = axisY - 45
        let foundPosition = false
        let attempts = 0
        while (!foundPosition && attempts < 20) {
          foundPosition = true
          for (const placed of placedItems) {
            const hOverlap = Math.abs(x - placed.x) < (boxWidth + placed.width) / 2 + horizontalMargin
            const vOverlap = Math.abs(y - placed.y) < (boxHeight + placed.height) / 2 + verticalSpacing
            if (hOverlap && vOverlap) {
              y = placed.y - placed.height / 2 - boxHeight / 2 - verticalSpacing
              foundPosition = false
              break
            }
          }
          attempts++
        }

        // Clamp to lane bounds
        y = Math.max(laneTop + boxHeight / 2 + 25, y)

        placedItems.push({ x, y, width: boxWidth, height: boxHeight, type: 'thinker' })

        // Draw thinker box
        ctx.fillStyle = isSelected ? '#8B4513' : '#ffffff'
        ctx.strokeStyle = isSelected ? '#6B3410' : '#d1d5db'
        ctx.lineWidth = isSelected ? 2 : 1

        ctx.fillRect(x - boxWidth / 2, y - boxHeight / 2, boxWidth, boxHeight)
        ctx.strokeRect(x - boxWidth / 2, y - boxHeight / 2, boxWidth, boxHeight)

        // Draw thinker name
        ctx.fillStyle = isSelected ? '#ffffff' : '#1f2937'
        ctx.font = '12px "Crimson Text", serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(thinker.name, x, y)
      })
    })

    // Calculate lane positions for connection drawing
    const getLaneAxisY = (laneIndex: number) => TOP_SCALE_HEIGHT + laneIndex * laneHeight + axisOffset

    // Draw connections ACROSS all lanes (for cross-timeline connections)
    const timelineIds = new Set(combinedView.members.map((m: CombinedViewMember) => m.timeline_id))
    const relevantConnections = connections.filter(c => {
      const from = thinkers.find(t => t.id === c.from_thinker_id)
      const to = thinkers.find(t => t.id === c.to_thinker_id)
      return from && to && timelineIds.has(from.timeline_id || '') && timelineIds.has(to.timeline_id || '')
    })

    relevantConnections.forEach((conn: Connection) => {
      const fromThinker = thinkers.find(t => t.id === conn.from_thinker_id)
      const toThinker = thinkers.find(t => t.id === conn.to_thinker_id)
      if (!fromThinker || !toThinker) return

      const fromYear = getThinkerYear(fromThinker)
      const toYear = getThinkerYear(toThinker)
      if (!fromYear || !toYear) return

      // Find lane indices for both thinkers
      const fromLaneIndex = combinedView.members.findIndex((m: CombinedViewMember) => m.timeline_id === fromThinker.timeline_id)
      const toLaneIndex = combinedView.members.findIndex((m: CombinedViewMember) => m.timeline_id === toThinker.timeline_id)
      if (fromLaneIndex === -1 || toLaneIndex === -1) return

      const fromX = yearToX(fromYear, canvasWidth)
      const toX = yearToX(toYear, canvasWidth)

      const fromY = getLaneAxisY(fromLaneIndex) - 45
      const toY = getLaneAxisY(toLaneIndex) - 45

      // Draw thin connection line with bezier curve
      ctx.strokeStyle = 'rgba(100, 100, 100, 0.5)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(fromX, fromY + 12)

      // Curve control points - go below the connection if same lane, between lanes otherwise
      const sameLane = fromLaneIndex === toLaneIndex
      const midY = sameLane
        ? Math.max(fromY, toY) + 40  // Below both thinkers
        : (getLaneAxisY(fromLaneIndex) + getLaneAxisY(toLaneIndex)) / 2

      ctx.bezierCurveTo(fromX, midY, toX, midY, toX, toY + 12)
      ctx.stroke()

      // Arrow at destination
      const arrowSize = 5
      ctx.beginPath()
      ctx.moveTo(toX, toY + 12)
      ctx.lineTo(toX - arrowSize, toY + 12 - arrowSize)
      ctx.lineTo(toX + arrowSize, toY + 12 - arrowSize)
      ctx.closePath()
      ctx.fillStyle = 'rgba(100, 100, 100, 0.5)'
      ctx.fill()

      // Connection label if exists
      if (conn.name) {
        const labelX = (fromX + toX) / 2
        const labelY = midY - 5
        ctx.font = '9px "Inter", sans-serif'
        ctx.fillStyle = '#666666'
        ctx.textAlign = 'center'
        ctx.fillText(conn.name, labelX, labelY)
      }
    })

  }, [combinedView, thinkers, connections, timelineEvents, scale, offsetX, selectedThinkerId, canvasSize, calculateUnifiedRange, yearToX, getYearIntervals])

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsPanning(true)
    setLastMousePos({ x: e.clientX, y: e.clientY })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return

    const dx = e.clientX - lastMousePos.x
    setOffsetX(prev => prev + dx)
    setLastMousePos({ x: e.clientX, y: e.clientY })
  }

  const handleMouseUp = () => {
    setIsPanning(false)
  }

  // Use native event listener for wheel to enable passive: false
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const handleWheelNative = (e: WheelEvent) => {
      e.preventDefault()

      const rect = canvas.getBoundingClientRect()

      // INVERTED: Regular scroll = zoom, Cmd/Ctrl+scroll = pan
      // Pinch-to-zoom on trackpad sends ctrlKey=true (still zooms)
      const isPan = e.ctrlKey || e.metaKey
      const isPinchZoom = Math.abs(e.deltaY) < 10 && e.ctrlKey // Trackpad pinch gesture

      if (!isPan || isPinchZoom) {
        // ZOOM: Regular scroll wheel or pinch gesture
        const mouseX = e.clientX - rect.left
        const oldScale = scale

        // Adaptive zoom sensitivity
        const zoomSensitivity = Math.abs(e.deltaY) < 10 ? 0.03 : 0.001
        const delta = 1 - e.deltaY * zoomSensitivity
        const newScale = Math.max(0.1, Math.min(50, oldScale * delta))

        // Zoom toward mouse position
        const { startYear, endYear } = calculateUnifiedRange()
        const yearSpan = endYear - startYear
        const contentWidth = rect.width * TIMELINE_CONTENT_WIDTH_PERCENT
        const pixelsPerYear = contentWidth / yearSpan

        const mouseXBeforeZoom = (mouseX - offsetX - TIMELINE_PADDING) / (pixelsPerYear * oldScale)
        const mouseXAfterZoom = mouseXBeforeZoom * pixelsPerYear * newScale
        const newOffsetX = mouseX - TIMELINE_PADDING - mouseXAfterZoom

        setScale(newScale)
        setOffsetX(newOffsetX)
      } else {
        // PAN: Cmd/Ctrl + scroll
        const panMultiplier = 1.5
        // Use deltaY for vertical scroll to pan horizontally
        const dx = -e.deltaY * panMultiplier
        setOffsetX(prev => prev + dx)
      }
    }

    canvas.addEventListener('wheel', handleWheelNative, { passive: false })
    return () => canvas.removeEventListener('wheel', handleWheelNative)
  }, [scale, offsetX, calculateUnifiedRange])

  const handleClick = (e: React.MouseEvent) => {
    if (!combinedView) return

    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const clickY = e.clientY - rect.top
    const isShiftClick = e.shiftKey

    // Calculate dynamic lane height (same as in draw)
    const numLanes = combinedView.members.length
    const availableHeight = canvasSize.height - TOP_SCALE_HEIGHT
    const laneHeight = numLanes > 0 ? availableHeight / numLanes : availableHeight
    const axisOffset = laneHeight * 0.6

    // Check for thinker clicks
    const timelineIds = new Set(combinedView.members.map((m: CombinedViewMember) => m.timeline_id))

    for (const thinker of thinkers) {
      if (!timelineIds.has(thinker.timeline_id || '')) continue

      const year = getThinkerYear(thinker)
      if (!year) continue

      // Use CSS dimensions (canvasSize) not DPR-scaled canvas dimensions
      const x = yearToX(year, canvasSize.width)
      const laneIndex = combinedView.members.findIndex((m: CombinedViewMember) => m.timeline_id === thinker.timeline_id)
      if (laneIndex === -1) continue

      const laneTop = TOP_SCALE_HEIGHT + laneIndex * laneHeight
      const axisY = laneTop + axisOffset
      // Approximate thinker Y position (slightly above axis)
      const y = axisY - 45

      // Measure text width for hit detection
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.font = '12px "Crimson Text", serif'
        const textWidth = ctx.measureText(thinker.name).width
        const boxWidth = textWidth + 16
        const boxHeight = 24

        // Expand hit area slightly for better UX
        if (clickX >= x - boxWidth / 2 - 5 && clickX <= x + boxWidth / 2 + 5 &&
            clickY >= y - boxHeight / 2 - 20 && clickY <= axisY + 10) {
          onThinkerClick?.(thinker.id, isShiftClick)
          return
        }
      }
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
          onClick={() => { setScale(1); setOffsetX(0) }}
          className="px-3 py-2 bg-white border border-gray-200 rounded shadow-sm hover:bg-gray-50 text-sm"
          data-testid="reset-view-button"
        >
          Reset
        </button>
      </div>
    </div>
  )
}
