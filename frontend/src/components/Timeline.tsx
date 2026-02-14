'use client'

import { useQuery } from '@tanstack/react-query'
import { thinkersApi, connectionsApi, timelineEventsApi, API_URL } from '@/lib/api'
import { useRef, useEffect, useState, useMemo, useCallback } from 'react'
import { REFERENCE_CANVAS_WIDTH, DEFAULT_START_YEAR, DEFAULT_END_YEAR, TIMELINE_PADDING, TIMELINE_CONTENT_WIDTH_PERCENT, CONNECTION_STYLES, getConnectionLineWidth, ConnectionStyleType } from '@/lib/constants'
import type { Thinker, Connection, Timeline as TimelineType, TimelineEvent, Note, NoteColor } from '@/types'

// Event layout constants
const EVENT_SHAPE_SIZE = 8
const EVENT_LABEL_HEIGHT = 12
const EVENT_VERTICAL_GAP = 4
const EVENT_ZONE_OFFSET = -15 // Base Y offset from centerY for events
const EVENT_BBOX_HEIGHT = EVENT_SHAPE_SIZE * 2 + EVENT_LABEL_HEIGHT // shape + label
const EVENT_BBOX_WIDTH = EVENT_SHAPE_SIZE * 4 // generous horizontal hitbox
const CANVAS_VERTICAL_PADDING = 12

// Sticky note color palette - more realistic sticky note colors with shadow and fold
const STICKY_NOTE_COLORS: Record<NoteColor, { bg: string; fold: string; border: string; text: string; shadow: string }> = {
  yellow: { bg: '#FFFBCC', fold: '#F5E79E', border: '#E6D56C', text: '#5C4813', shadow: 'rgba(0,0,0,0.15)' },
  pink: { bg: '#FFECF0', fold: '#F8C8D4', border: '#F0A0B8', text: '#7A2D42', shadow: 'rgba(0,0,0,0.12)' },
  blue: { bg: '#E8F4FD', fold: '#C4DCF0', border: '#9CC4E4', text: '#1E4A6D', shadow: 'rgba(0,0,0,0.12)' },
  green: { bg: '#E8F8E8', fold: '#C0E8C0', border: '#90D090', text: '#1D4A1D', shadow: 'rgba(0,0,0,0.12)' },
}

interface TimelineProps {
  onThinkerClick?: (thinkerId: string, isShiftClick?: boolean, isCtrlClick?: boolean, isAltClick?: boolean) => void
  onCanvasClick?: (position: { x: number; y: number }) => void
  onConnectionClick?: (connectionId: string) => void
  onEventClick?: (eventId: string) => void
  onThinkerDrag?: (thinkerId: string, anchorYear: number, positionY: number) => void
  onEmptyClick?: () => void
  // Sticky notes support
  canvasNotes?: Note[]
  onNoteClick?: (noteId: string) => void
  onNoteDrag?: (noteId: string, positionX: number, positionY: number) => void
  stickyNotePreviewLength?: number
  selectedThinkerId?: string | null
  bulkSelectedIds?: string[]
  filterByTimelineId?: string | null
  filterByTagIds?: string[]
  searchQuery?: string
  filterByField?: string
  filterByYearStart?: number | null
  filterByYearEnd?: number | null
  selectedTimeline?: TimelineType | null
  // Connection visualization options
  visibleConnectionTypes?: ConnectionStyleType[]
  showConnectionLabels?: boolean
  highlightSelectedConnections?: boolean
  // Animation support
  animationYear?: number | null
  // Sticky note mode - allows clicking anywhere to place a note
  stickyNoteMode?: boolean
}

export function Timeline({ onThinkerClick, onCanvasClick, onConnectionClick, onEventClick, onThinkerDrag, onEmptyClick, canvasNotes = [], onNoteClick, onNoteDrag, stickyNotePreviewLength = 50, selectedThinkerId, bulkSelectedIds = [], filterByTimelineId, filterByTagIds = [], searchQuery = '', filterByField = '', filterByYearStart = null, filterByYearEnd = null, selectedTimeline, visibleConnectionTypes, showConnectionLabels = true, highlightSelectedConnections = true, animationYear = null, stickyNoteMode = false }: TimelineProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [scale, setScale] = useState(1)
  const [offsetX, setOffsetX] = useState(0)
  const [offsetY, setOffsetY] = useState(0)
  const [isPanning, setIsPanning] = useState(false)
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 })
  // Thinker dragging state
  const [draggedThinkerId, setDraggedThinkerId] = useState<string | null>(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [draggedThinkerPos, setDraggedThinkerPos] = useState<{ x: number; y: number } | null>(null)
  const [hasDragged, setHasDragged] = useState(false) // Track if actual dragging occurred (not just a click)

  // Note dragging state
  const [draggedNoteId, setDraggedNoteId] = useState<string | null>(null)
  const [draggedNotePos, setDraggedNotePos] = useState<{ x: number; y: number } | null>(null)
  const [noteDragOffset, setNoteDragOffset] = useState({ x: 0, y: 0 })
  const [hasNoteDragged, setHasNoteDragged] = useState(false)

  // Ref to track if we just completed a drag (to prevent click after drag)
  const justDraggedRef = useRef(false)

  const { data: timelines = [] } = useQuery({
    queryKey: ['timelines'],
    queryFn: async () => {
      const response = await fetch(`${API_URL}/api/timelines/`)
      return response.json()
    },
  })

  const { data: thinkers = [], isLoading: thinkersLoading } = useQuery({
    queryKey: ['thinkers', filterByTimelineId],
    queryFn: () => thinkersApi.getAll(filterByTimelineId || undefined),
    refetchOnMount: 'always',
  })

  const { data: connections = [], isLoading: connectionsLoading } = useQuery({
    queryKey: ['connections'],
    queryFn: connectionsApi.getAll,
    refetchOnMount: 'always',
  })

  const { data: timelineEvents = [], isLoading: eventsLoading } = useQuery({
    queryKey: ['timeline-events', filterByTimelineId],
    queryFn: () => timelineEventsApi.getAll(filterByTimelineId || undefined),
  })

  // Helper function to calculate the year to use for positioning a thinker
  // Priority: anchor_year (if set) > midpoint of birth/death > death_year > birth_year > null
  const getThinkerYear = (thinker: Thinker): number | null => {
    // If anchor_year is explicitly set (e.g., after user drag), use it
    if (thinker.anchor_year != null) {
      return thinker.anchor_year
    }
    // If both birth and death years are available, use the midpoint
    if (thinker.birth_year != null && thinker.death_year != null) {
      return Math.round((thinker.birth_year + thinker.death_year) / 2)
    }
    // If only death_year is available, use that
    if (thinker.death_year != null) {
      return thinker.death_year
    }
    // If only birth_year is available, use that as the position
    if (thinker.birth_year != null) {
      return thinker.birth_year
    }
    return null
  }

  // Calculate year range for "All Thinkers" view based on all thinkers' years AND all timeline bounds
  // BUG #2 FIX: Initialize with Infinity/-Infinity, only apply defaults when no data
  // BUG #13 FIX: Also consider timeline start_year/end_year bounds
  const calculateAllThinkersRange = () => {
    let minYear = Infinity
    let maxYear = -Infinity
    let hasData = false

    // Consider all thinkers' birth/death years
    thinkers.forEach(t => {
      if (t.birth_year != null) {
        minYear = Math.min(minYear, t.birth_year)
        hasData = true
      }
      if (t.death_year != null) {
        maxYear = Math.max(maxYear, t.death_year)
        hasData = true
      }
    })

    // BUG #13 FIX: Also consider all timeline bounds to expand master view
    timelines.forEach((timeline: { start_year?: number; end_year?: number }) => {
      if (timeline.start_year != null) {
        minYear = Math.min(minYear, timeline.start_year)
        hasData = true
      }
      if (timeline.end_year != null) {
        maxYear = Math.max(maxYear, timeline.end_year)
        hasData = true
      }
    })

    // If no data found, use defaults
    if (!hasData) {
      return { startYear: DEFAULT_START_YEAR, endYear: DEFAULT_END_YEAR }
    }

    // Ensure we have valid min/max (handle edge cases where only birth or death is set)
    if (minYear === Infinity) minYear = maxYear - 100
    if (maxYear === -Infinity) maxYear = minYear + 100

    // Add some padding
    const padding = Math.max(50, Math.floor((maxYear - minYear) * 0.1))
    return {
      startYear: Math.floor((minYear - padding) / 10) * 10,
      endYear: Math.ceil((maxYear + padding) / 10) * 10
    }
  }

  // Helper function to convert year to x position
  // Now accepts horizontalScale to apply zoom only to X axis
  const yearToX = (year: number, canvasWidth: number, horizontalScale: number = 1): number => {
    let startYear, endYear

    if (selectedTimeline) {
      // Use timeline's specific bounds
      startYear = selectedTimeline.start_year ?? DEFAULT_START_YEAR
      endYear = selectedTimeline.end_year ?? DEFAULT_END_YEAR
    } else {
      // For "All Thinkers" view, use calculated range based on all thinkers
      const range = calculateAllThinkersRange()
      startYear = range.startYear
      endYear = range.endYear
    }

    const yearSpan = endYear - startYear
    const pixelsPerYear = (canvasWidth * TIMELINE_CONTENT_WIDTH_PERCENT) / yearSpan
    const baseX = TIMELINE_PADDING + (year - startYear) * pixelsPerYear
    return baseX * horizontalScale  // Apply horizontal zoom
  }

  // Helper function to convert X position back to year (inverse of yearToX)
  const xToYear = (x: number, canvasWidth: number, horizontalScale: number = 1): number => {
    let startYear, endYear

    if (selectedTimeline) {
      startYear = selectedTimeline.start_year ?? DEFAULT_START_YEAR
      endYear = selectedTimeline.end_year ?? DEFAULT_END_YEAR
    } else {
      const range = calculateAllThinkersRange()
      startYear = range.startYear
      endYear = range.endYear
    }

    const yearSpan = endYear - startYear
    const pixelsPerYear = (canvasWidth * TIMELINE_CONTENT_WIDTH_PERCENT) / yearSpan
    // Reverse the yearToX calculation: x = (TIMELINE_PADDING + (year - startYear) * pixelsPerYear) * scale
    // So: year = ((x / scale) - TIMELINE_PADDING) / pixelsPerYear + startYear
    const baseX = x / horizontalScale
    const year = (baseX - TIMELINE_PADDING) / pixelsPerYear + startYear
    return Math.round(year)
  }

  // Helper function to scale X coordinates (for stored positions)
  const scaleX = (x: number): number => x * scale

  // Memoized filter for thinkers by timeline, tags, search query, field, and year range
  const filteredThinkers = useMemo(() => {
    return thinkers.filter((t) => {
      // Filter by timeline if specified
      if (filterByTimelineId && t.timeline_id !== filterByTimelineId) {
        return false
      }
      // Filter by tags if any are selected (thinker must have ALL selected tags)
      if (filterByTagIds.length > 0) {
        // Tags are included in the API response but not in the base Thinker type
        const thinkerWithTags = t as Thinker & { tags?: { id: string }[] }
        const thinkerTagIds = thinkerWithTags.tags?.map((tag) => tag.id) || []
        const hasAllTags = filterByTagIds.every((tagId) => thinkerTagIds.includes(tagId))
        if (!hasAllTags) return false
      }
      // Filter by search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase()
        const nameMatch = t.name?.toLowerCase().includes(query)
        const fieldMatch = t.field?.toLowerCase().includes(query)
        const biographyMatch = t.biography_notes?.toLowerCase().includes(query)
        if (!nameMatch && !fieldMatch && !biographyMatch) return false
      }
      // Filter by field
      if (filterByField && t.field !== filterByField) {
        return false
      }
      // Filter by year range (checks if thinker's active period overlaps with filter range)
      if (filterByYearStart !== null || filterByYearEnd !== null) {
        const thinkerStart = t.birth_year ?? null
        const thinkerEnd = t.death_year ?? null

        // If thinker has no dates, exclude them when year filter is active
        if (thinkerStart === null && thinkerEnd === null) {
          return false
        }

        // Check if thinker's life span overlaps with filter range
        if (filterByYearStart !== null && thinkerEnd !== null && thinkerEnd < filterByYearStart) {
          return false
        }
        if (filterByYearEnd !== null && thinkerStart !== null && thinkerStart > filterByYearEnd) {
          return false
        }
      }

      // Animation year filter: show only thinkers alive at the animation year
      if (animationYear !== null) {
        const thinkerStart = t.birth_year ?? null
        const thinkerEnd = t.death_year ?? new Date().getFullYear()

        // If thinker has no birth year, we can't determine if they were alive
        if (thinkerStart === null) {
          return false
        }

        // Check if thinker was alive at animation year
        if (animationYear < thinkerStart || animationYear > thinkerEnd) {
          return false
        }
      }

      return true
    })
  }, [thinkers, filterByTimelineId, filterByTagIds, searchQuery, filterByField, filterByYearStart, filterByYearEnd, animationYear])

  // Memoized filter for connections to only show those between visible thinkers
  const filteredConnections = useMemo(() => {
    const visibleThinkerIds = new Set(filteredThinkers.map((t) => t.id))
    return connections.filter(
      (c) => visibleThinkerIds.has(c.from_thinker_id) && visibleThinkerIds.has(c.to_thinker_id)
    )
  }, [connections, filteredThinkers])

  const filterConnectionsByVisibleTypes = useCallback((inputConnections: Connection[]): Connection[] => {
    if (!visibleConnectionTypes || !Array.isArray(visibleConnectionTypes)) {
      return inputConnections
    }

    const visibleTypes = new Set<ConnectionStyleType>(visibleConnectionTypes)
    return inputConnections.filter((conn) =>
      visibleTypes.has(conn.connection_type as ConnectionStyleType)
    )
  }, [visibleConnectionTypes])

  const visibleFilteredConnections = useMemo(
    () => filterConnectionsByVisibleTypes(filteredConnections),
    [filteredConnections, filterConnectionsByVisibleTypes]
  )

  // Prevent browser zoom on the timeline container - only for pinch-to-zoom gestures
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const preventZoom = (e: WheelEvent) => {
      // Only prevent default for pinch-to-zoom (Ctrl/Meta + wheel)
      // This prevents browser zoom while allowing our custom zoom
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        // Don't stop propagation - let our handler process it
      }
    }

    // Use capture phase to intercept before it bubbles
    canvas.addEventListener('wheel', preventZoom, { passive: false, capture: true })
    return () => canvas.removeEventListener('wheel', preventZoom, { capture: true })
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // High-DPI canvas scaling to prevent pixelation
    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()

    // Set canvas internal resolution to match device pixel ratio
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr

    // Scale the context to match
    ctx.scale(dpr, dpr)

    // Use CSS dimensions for layout calculations
    const canvasWidth = rect.width
    const canvasHeight = rect.height

    ctx.clearRect(0, 0, canvasWidth, canvasHeight)

    ctx.save()
    ctx.translate(offsetX, offsetY)
    // Removed ctx.scale(scale, scale) - we now scale X coordinates manually for horizontal-only zoom

    drawGrid(ctx, canvasWidth, canvasHeight)
    drawTimeline(ctx, canvasWidth, canvasHeight)

    // Calculate all positions once per frame
    const eventPositions = timelineEvents.length > 0
      ? calculateEventPositions(timelineEvents, canvasWidth, canvasHeight)
      : undefined
    const thinkerPositions = filteredThinkers.length > 0
      ? calculateThinkerPositions(filteredThinkers, canvasWidth, canvasHeight, eventPositions)
      : new Map<string, { x: number; y: number; width: number; height: number }>()

    // Draw events at calculated positions
    if (eventPositions && timelineEvents.length > 0) {
      drawTimelineEvents(ctx, timelineEvents, canvasWidth, canvasHeight, eventPositions)
    }

    // Draw connections and thinkers using pre-computed positions
    if (visibleFilteredConnections.length > 0) {
      drawConnections(ctx, visibleFilteredConnections, filteredThinkers, thinkerPositions)
    }

    if (filteredThinkers.length > 0) {
      drawThinkers(ctx, filteredThinkers, thinkerPositions, selectedThinkerId, bulkSelectedIds, draggedThinkerId, draggedThinkerPos)
    } else {
      drawEmptyState(ctx, canvasWidth, canvasHeight)
    }

    // Draw sticky notes on top of everything
    if (canvasNotes.length > 0) {
      drawStickyNotes(ctx, canvasNotes, draggedNoteId, draggedNotePos)
    }

    ctx.restore()
  }, [thinkers, connections, timelineEvents, timelines, scale, offsetX, offsetY, selectedThinkerId, bulkSelectedIds, filteredThinkers, visibleFilteredConnections, filterByTimelineId, filterByTagIds, searchQuery, filterByField, filterByYearStart, filterByYearEnd, selectedTimeline, draggedThinkerId, draggedThinkerPos, canvasNotes, stickyNotePreviewLength, draggedNoteId, draggedNotePos, showConnectionLabels])

  const drawGrid = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.strokeStyle = '#F0F0F0'
    ctx.lineWidth = 1

    const gridSize = 50

    // Calculate visible area in world coordinates (accounting for pan offset)
    const visibleStartX = -offsetX / scale
    const visibleEndX = (width - offsetX) / scale
    const visibleStartY = -offsetY
    const visibleEndY = height - offsetY

    // Calculate grid start positions (snap to grid)
    const gridStartX = Math.floor(visibleStartX / gridSize) * gridSize
    const gridStartY = Math.floor(visibleStartY / gridSize) * gridSize

    // Vertical grid lines - draw across visible area
    for (let x = gridStartX; x <= visibleEndX + gridSize; x += gridSize) {
      const screenX = x * scale
      ctx.beginPath()
      ctx.moveTo(screenX, visibleStartY)
      ctx.lineTo(screenX, visibleEndY + gridSize)
      ctx.stroke()
    }

    // Horizontal grid lines - draw across visible area
    for (let y = gridStartY; y <= visibleEndY + gridSize; y += gridSize) {
      ctx.beginPath()
      ctx.moveTo(visibleStartX * scale, y)
      ctx.lineTo((visibleEndX + gridSize) * scale, y)
      ctx.stroke()
    }
  }

  // Helper function to calculate appropriate year interval based on zoom level
  const getYearInterval = (width: number, yearSpan: number, currentScale: number): number => {
    // Minimum pixel spacing between year labels to avoid overlap
    const minPixelSpacing = 80

    // Calculate actual pixels per year considering zoom
    const pixelsPerYear = (width * 0.8 * currentScale) / yearSpan

    // Calculate minimum year interval needed to maintain spacing
    const minYearInterval = minPixelSpacing / pixelsPerYear

    // Round up to a "nice" interval - now includes sub-year intervals for deep zoom
    const niceIntervals = [0.01, 0.02, 0.05, 0.1, 0.2, 0.25, 0.5, 1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000, 10000]

    for (const interval of niceIntervals) {
      if (interval >= minYearInterval) {
        return interval
      }
    }

    // For very zoomed out views, use larger intervals
    return Math.ceil(minYearInterval / 10000) * 10000
  }

  const drawTimeline = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.strokeStyle = '#E0E0E0'
    ctx.lineWidth = 2

    const centerY = height / 2
    ctx.beginPath()
    ctx.moveTo(0, centerY)
    ctx.lineTo(width, centerY)
    ctx.stroke()

    ctx.fillStyle = '#666666'
    ctx.font = '12px "JetBrains Mono", monospace'
    ctx.textAlign = 'center'

    // Use the same year range calculation as yearToX
    let startYear, endYear
    if (selectedTimeline) {
      startYear = selectedTimeline.start_year ?? DEFAULT_START_YEAR
      endYear = selectedTimeline.end_year ?? DEFAULT_END_YEAR
    } else {
      const range = calculateAllThinkersRange()
      startYear = range.startYear
      endYear = range.endYear
    }

    const yearSpan = endYear - startYear

    // Use dynamic interval based on zoom level
    const interval = getYearInterval(width, yearSpan, scale)

    // Draw main year markers
    for (let year = Math.ceil(startYear / interval) * interval; year <= endYear; year += interval) {
      const x = yearToX(year, width, scale)
      // Format year nicely - remove trailing zeros for decimals
      const yearLabel = interval < 1 ? year.toFixed(2).replace(/\.?0+$/, '') : year.toString()
      ctx.fillStyle = '#666666'
      ctx.fillText(yearLabel, x, centerY + 30)

      ctx.strokeStyle = '#CCCCCC'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x, centerY - 10)
      ctx.lineTo(x, centerY + 10)
      ctx.stroke()
    }

    // Draw quarter dashes when zoomed in (show sub-intervals)
    // Show quarter marks between main intervals for finer granularity
    if (scale >= 1) {
      const quarterInterval = interval / 4
      ctx.strokeStyle = '#DDDDDD'
      ctx.lineWidth = 0.5

      for (let year = Math.ceil(startYear / quarterInterval) * quarterInterval; year <= endYear; year += quarterInterval) {
        // Skip if this is a main interval marker (use tolerance for floating point)
        if (Math.abs(year % interval) < 0.0001 || Math.abs(year % interval - interval) < 0.0001) continue

        const x = yearToX(year, width, scale)
        ctx.beginPath()
        ctx.moveTo(x, centerY - 5)
        ctx.lineTo(x, centerY + 5)
        ctx.stroke()
      }
    }

    // Draw even finer marks (twelfths/months) at higher zoom
    if (scale >= 4) {
      const monthInterval = interval / 12
      ctx.strokeStyle = '#EEEEEE'
      ctx.lineWidth = 0.5

      for (let year = Math.ceil(startYear / monthInterval) * monthInterval; year <= endYear; year += monthInterval) {
        // Skip if this is a main interval or quarter marker (use tolerance for floating point)
        const quarterRemainder = year % (interval / 4)
        if (Math.abs(quarterRemainder) < 0.0001 || Math.abs(quarterRemainder - interval / 4) < 0.0001) continue

        const x = yearToX(year, width, scale)
        ctx.beginPath()
        ctx.moveTo(x, centerY - 3)
        ctx.lineTo(x, centerY + 3)
        ctx.stroke()
      }
    }
  }

  // Calculate thinker positions with zoom-aware collision detection
  const calculateThinkerPositions = (thinkers: Thinker[], canvasWidth: number, canvasHeight: number, eventPositions?: Map<string, { x: number; y: number }>): Map<string, { x: number; y: number; width: number; height: number }> => {
    const positions = new Map<string, { x: number; y: number; width: number; height: number }>()
    const centerY = canvasHeight / 2
    const canvas = canvasRef.current
    if (!canvas) return positions
    const ctx = canvas.getContext('2d')
    if (!ctx) return positions

    // First pass: calculate base positions and sizes
    const thinkerData: { id: string; x: number; baseY: number; width: number; height: number; isManuallyPositioned: boolean }[] = []

    thinkers.forEach((thinker) => {
      const thinkerYear = getThinkerYear(thinker)
      const x = thinkerYear != null
        ? yearToX(thinkerYear, canvasWidth, scale)
        : scaleX(thinker.position_x ?? canvasWidth / 2)

      ctx.font = '14px "Crimson Text", serif'
      const metrics = ctx.measureText(thinker.name)
      const padding = 8
      const bgWidth = metrics.width + padding * 2
      const bgHeight = 24

      // position_y is stored as an offset from the timeline axis (0 = on the timeline)
      // Positive values go below, negative values go above
      const yOffset = thinker.position_y ?? 0
      thinkerData.push({
        id: thinker.id,
        x,
        baseY: centerY + yOffset,
        width: bgWidth,
        height: bgHeight,
        isManuallyPositioned: thinker.is_manually_positioned === true,
      })
    })

    // Sort by x position for collision detection
    thinkerData.sort((a, b) => a.x - b.x)

    // Zoom-dependent collision detection parameters
    // Spacing grows with sqrt(scale) so items spread more when zoomed in
    // sqrt gives ~1.4x at scale=2, ~2x at scale=4, capped at 3x
    const MIN_HORIZONTAL_GAP_BASE = 10
    const MIN_VERTICAL_GAP_BASE = 6
    const MIN_LABEL_WIDTH = 56
    const HORIZONTAL_COMPRESSION_FACTORS = [1, 0.92, 0.85, 0.78, 0.72, 0.66, 0.6]
    // Quantize to steps of 0.5 so positions don't shift continuously during zoom
    const SPACING_ZOOM_FACTOR = Math.round(Math.min(3, Math.max(1, Math.sqrt(scale))) * 2) / 2
    const horizontalMargin = MIN_HORIZONTAL_GAP_BASE * SPACING_ZOOM_FACTOR
    const verticalSpacing = MIN_VERTICAL_GAP_BASE * SPACING_ZOOM_FACTOR
    const elevationOffset = -5 // Small offset to position thinkers just above the timeline line

    // Second pass: resolve collisions by moving thinkers vertically
    const placed: { x: number; y: number; width: number; height: number; id: string }[] = []

    const manuallyPositionedThinkers = thinkerData.filter((thinker) => thinker.isManuallyPositioned)
    const autoPositionedThinkers = thinkerData.filter((thinker) => !thinker.isManuallyPositioned)

    manuallyPositionedThinkers.forEach((thinker) => {
      const y = thinker.baseY
      placed.push({ x: thinker.x, y, width: thinker.width, height: thinker.height, id: thinker.id })
      positions.set(thinker.id, { x: thinker.x, y, width: thinker.width, height: thinker.height })
    })

    // Add event positions as obstacles so thinkers avoid overlapping events
    if (eventPositions) {
      for (const [, ePos] of eventPositions) {
        placed.push({
          x: ePos.x,
          y: ePos.y,
          width: EVENT_BBOX_WIDTH,
          height: EVENT_BBOX_HEIGHT,
          id: '__event__',
        })
      }
    }

    autoPositionedThinkers.forEach((thinker) => {
      const defaultY = thinker.baseY + elevationOffset
      const minY = CANVAS_VERTICAL_PADDING + thinker.height / 2
      const maxY = canvasHeight - CANVAS_VERTICAL_PADDING - thinker.height / 2
      const laneStep = thinker.height + verticalSpacing

      // Generate candidate lanes from center outward (up, down) to use full vertical space.
      const candidateYs: number[] = []
      let ring = 0
      while (true) {
        const upY = defaultY - ring * laneStep
        const downY = defaultY + ring * laneStep
        let addedCandidate = false

        if (ring === 0) {
          if (upY >= minY && upY <= maxY) {
            candidateYs.push(upY)
            addedCandidate = true
          }
        } else {
          if (upY >= minY && upY <= maxY) {
            candidateYs.push(upY)
            addedCandidate = true
          }
          if (downY >= minY && downY <= maxY) {
            candidateYs.push(downY)
            addedCandidate = true
          }
        }

        if (!addedCandidate && upY < minY && downY > maxY) break
        ring += 1
      }

      if (candidateYs.length === 0) {
        candidateYs.push(Math.min(maxY, Math.max(minY, defaultY)))
      }

      let y = candidateYs[0]
      let width = thinker.width
      let bestCollisionCount = Number.POSITIVE_INFINITY
      let bestCollisionPenalty = Number.POSITIVE_INFINITY
      let bestVerticalDistance = Number.POSITIVE_INFINITY
      let foundCollisionFreePlacement = false

      // Stage 1: spread vertically as much as possible at natural width.
      // Stage 2: if needed, progressively compress horizontal label width.
      for (const compressionFactor of HORIZONTAL_COMPRESSION_FACTORS) {
        const candidateWidth = Math.max(MIN_LABEL_WIDTH, thinker.width * compressionFactor)

        for (const candidateY of candidateYs) {
          let collisionCount = 0
          let collisionPenalty = 0

          for (const existing of placed) {
            const horizontalThreshold = (candidateWidth + existing.width) / 2 + horizontalMargin
            const horizontalDistance = Math.abs(thinker.x - existing.x)
            if (horizontalDistance >= horizontalThreshold) continue

            const verticalThreshold = (thinker.height + existing.height) / 2 + verticalSpacing
            const verticalDistance = Math.abs(candidateY - existing.y)
            if (verticalDistance >= verticalThreshold) continue

            collisionCount += 1
            collisionPenalty += (horizontalThreshold - horizontalDistance) * (verticalThreshold - verticalDistance)
          }

          const verticalDistanceFromDefault = Math.abs(candidateY - defaultY)

          if (collisionCount === 0) {
            if (!foundCollisionFreePlacement || verticalDistanceFromDefault < bestVerticalDistance) {
              y = candidateY
              width = candidateWidth
              bestCollisionCount = 0
              bestCollisionPenalty = 0
              bestVerticalDistance = verticalDistanceFromDefault
              foundCollisionFreePlacement = true
            }
            continue
          }

          if (foundCollisionFreePlacement) {
            continue
          }

          if (
            collisionCount < bestCollisionCount ||
            (collisionCount === bestCollisionCount && collisionPenalty < bestCollisionPenalty) ||
            (
              collisionCount === bestCollisionCount &&
              collisionPenalty === bestCollisionPenalty &&
              verticalDistanceFromDefault < bestVerticalDistance
            )
          ) {
            y = candidateY
            width = candidateWidth
            bestCollisionCount = collisionCount
            bestCollisionPenalty = collisionPenalty
            bestVerticalDistance = verticalDistanceFromDefault
          }
        }

        if (foundCollisionFreePlacement) {
          break
        }
      }

      placed.push({ x: thinker.x, y, width, height: thinker.height, id: thinker.id })
      positions.set(thinker.id, { x: thinker.x, y, width, height: thinker.height })
    })

    return positions
  }

  const fitTextToWidth = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string => {
    if (ctx.measureText(text).width <= maxWidth) return text

    const ellipsis = '...'
    let truncated = text
    while (truncated.length > 1 && ctx.measureText(`${truncated}${ellipsis}`).width > maxWidth) {
      truncated = truncated.slice(0, -1)
    }
    return `${truncated}${ellipsis}`
  }

  const drawThinkers = (ctx: CanvasRenderingContext2D, thinkers: Thinker[], positions: Map<string, { x: number; y: number; width: number; height: number }>, selectedId?: string | null, bulkSelected: string[] = [], dragId?: string | null, dragPos?: { x: number; y: number } | null) => {

    thinkers.forEach((thinker) => {
      const pos = positions.get(thinker.id)
      if (!pos) return

      // Use dragged position if this thinker is being dragged
      let { x, y, width: bgWidth, height: bgHeight } = pos
      if (dragId === thinker.id && dragPos) {
        x = dragPos.x
        y = dragPos.y
      }
      const isSelected = thinker.id === selectedId
      const isBulkSelected = bulkSelected.includes(thinker.id)

      // Draw name label with background
      ctx.font = '14px "Crimson Text", serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      // Draw background rectangle
      if (isSelected) {
        ctx.fillStyle = '#8B4513'
        ctx.strokeStyle = '#6B3410'
        ctx.lineWidth = 2
      } else if (isBulkSelected) {
        ctx.fillStyle = '#E0F2FE'  // Light blue for bulk selection
        ctx.strokeStyle = '#0284C7'  // Blue border
        ctx.lineWidth = 2
      } else {
        ctx.fillStyle = '#FFFFFF'
        ctx.strokeStyle = '#CCCCCC'
        ctx.lineWidth = 1
      }

      ctx.fillRect(x - bgWidth / 2, y - bgHeight / 2, bgWidth, bgHeight)
      ctx.strokeRect(x - bgWidth / 2, y - bgHeight / 2, bgWidth, bgHeight)

      // Draw text (name only - no date labels)
      ctx.fillStyle = isSelected ? '#FFFFFF' : '#1A1A1A'
      const textPadding = 8
      const maxTextWidth = Math.max(10, bgWidth - textPadding * 2)
      const displayName = fitTextToWidth(ctx, thinker.name, maxTextWidth)
      ctx.fillText(displayName, x, y)

      // Draw checkbox indicator for bulk selected items
      if (isBulkSelected) {
        const checkboxSize = 12
        const checkboxX = x - bgWidth / 2 - checkboxSize - 4
        const checkboxY = y - checkboxSize / 2

        ctx.fillStyle = '#0284C7'
        ctx.fillRect(checkboxX, checkboxY, checkboxSize, checkboxSize)

        // Draw checkmark
        ctx.strokeStyle = '#FFFFFF'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(checkboxX + 3, checkboxY + 6)
        ctx.lineTo(checkboxX + 5, checkboxY + 9)
        ctx.lineTo(checkboxX + 9, checkboxY + 3)
        ctx.stroke()
      }
    })
  }

  // Draw sticky notes on the canvas
  const drawStickyNotes = (
    ctx: CanvasRenderingContext2D,
    notes: Note[],
    dragNoteId?: string | null,
    dragNotePos?: { x: number; y: number } | null
  ) => {
    const PADDING = 10
    const MIN_WIDTH = 100
    const MAX_WIDTH = 160
    const FOLD_SIZE = 14 // Size of the folded corner
    const LINE_HEIGHT = 14

    notes.forEach((note) => {
      if (!note.is_canvas_note || note.position_x == null || note.position_y == null) return

      // Use dragged position if this note is being dragged
      let x = note.position_x
      let y = note.position_y
      if (dragNoteId === note.id && dragNotePos) {
        x = dragNotePos.x
        y = dragNotePos.y
      }
      const color = (note.color as NoteColor) || 'yellow'
      const colors = STICKY_NOTE_COLORS[color] || STICKY_NOTE_COLORS.yellow

      // Calculate dimensions
      ctx.font = 'bold 11px "Inter", sans-serif'
      const displayTitle = note.title || 'Note'
      const titleWidth = ctx.measureText(displayTitle).width
      const STICKY_WIDTH = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, titleWidth + PADDING * 2 + FOLD_SIZE))

      // Calculate height based on content
      const hasContent = note.content && note.content.length > 0
      const showPreview = hasContent && note.title // Only show preview if there's both title and content
      const STICKY_HEIGHT = showPreview ? 56 : 40

      // Draw shadow (offset slightly for 3D effect)
      ctx.shadowColor = colors.shadow
      ctx.shadowBlur = 6
      ctx.shadowOffsetX = 2
      ctx.shadowOffsetY = 3

      // Draw main sticky note body (with cut corner for fold)
      ctx.fillStyle = colors.bg
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x + STICKY_WIDTH - FOLD_SIZE, y)
      ctx.lineTo(x + STICKY_WIDTH, y + FOLD_SIZE)
      ctx.lineTo(x + STICKY_WIDTH, y + STICKY_HEIGHT)
      ctx.lineTo(x, y + STICKY_HEIGHT)
      ctx.closePath()
      ctx.fill()

      // Reset shadow
      ctx.shadowColor = 'transparent'
      ctx.shadowBlur = 0
      ctx.shadowOffsetX = 0
      ctx.shadowOffsetY = 0

      // Draw the folded corner triangle
      ctx.fillStyle = colors.fold
      ctx.beginPath()
      ctx.moveTo(x + STICKY_WIDTH - FOLD_SIZE, y)
      ctx.lineTo(x + STICKY_WIDTH - FOLD_SIZE, y + FOLD_SIZE)
      ctx.lineTo(x + STICKY_WIDTH, y + FOLD_SIZE)
      ctx.closePath()
      ctx.fill()

      // Draw fold crease line
      ctx.strokeStyle = colors.border
      ctx.lineWidth = 0.5
      ctx.beginPath()
      ctx.moveTo(x + STICKY_WIDTH - FOLD_SIZE, y)
      ctx.lineTo(x + STICKY_WIDTH - FOLD_SIZE, y + FOLD_SIZE)
      ctx.lineTo(x + STICKY_WIDTH, y + FOLD_SIZE)
      ctx.stroke()

      // Draw subtle border on main note
      ctx.strokeStyle = colors.border
      ctx.lineWidth = 0.8
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x + STICKY_WIDTH - FOLD_SIZE, y)
      ctx.moveTo(x + STICKY_WIDTH, y + FOLD_SIZE)
      ctx.lineTo(x + STICKY_WIDTH, y + STICKY_HEIGHT)
      ctx.lineTo(x, y + STICKY_HEIGHT)
      ctx.lineTo(x, y)
      ctx.stroke()

      // Draw title text inside the note
      ctx.fillStyle = colors.text
      ctx.font = 'bold 11px "Inter", sans-serif'
      ctx.textBaseline = 'top'
      ctx.textAlign = 'left'
      const maxTitleWidth = STICKY_WIDTH - PADDING * 2 - 4
      let truncatedTitle = displayTitle
      if (ctx.measureText(truncatedTitle).width > maxTitleWidth) {
        while (ctx.measureText(truncatedTitle + '...').width > maxTitleWidth && truncatedTitle.length > 3) {
          truncatedTitle = truncatedTitle.slice(0, -1)
        }
        truncatedTitle += '...'
      }
      ctx.fillText(truncatedTitle, x + PADDING, y + PADDING + 1)

      // Draw content preview if there's content
      if (showPreview) {
        ctx.font = '10px "Inter", sans-serif'
        ctx.fillStyle = colors.text
        ctx.textBaseline = 'top'
        ctx.textAlign = 'left'
        ctx.globalAlpha = 0.7
        const preview = note.content.substring(0, 30) + (note.content.length > 30 ? '...' : '')
        let truncatedPreview = preview
        if (ctx.measureText(truncatedPreview).width > maxTitleWidth) {
          while (ctx.measureText(truncatedPreview + '...').width > maxTitleWidth && truncatedPreview.length > 3) {
            truncatedPreview = truncatedPreview.slice(0, -1)
          }
          truncatedPreview += '...'
        }
        ctx.fillText(truncatedPreview, x + PADDING, y + PADDING + LINE_HEIGHT + 5)
        ctx.globalAlpha = 1
      }

      // If no title but has content, show content as main text
      if (!note.title && hasContent) {
        ctx.font = '10px "Inter", sans-serif'
        ctx.fillStyle = colors.text
        ctx.textBaseline = 'top'
        ctx.textAlign = 'left'
        const preview = note.content.substring(0, 40) + (note.content.length > 40 ? '...' : '')
        let truncatedPreview = preview
        if (ctx.measureText(truncatedPreview).width > maxTitleWidth) {
          while (ctx.measureText(truncatedPreview + '...').width > maxTitleWidth && truncatedPreview.length > 3) {
            truncatedPreview = truncatedPreview.slice(0, -1)
          }
          truncatedPreview += '...'
        }
        ctx.fillText(truncatedPreview, x + PADDING, y + PADDING + LINE_HEIGHT + 1)
      }

      ctx.textBaseline = 'alphabetic' // Reset to default
      ctx.textAlign = 'center' // Reset to default
    })
  }

  // Store sticky note dimensions for click detection (needs to match drawing)
  const getStickyNoteDimensions = (note: Note): { width: number; height: number } => {
    const PADDING = 10
    const MIN_WIDTH = 100
    const MAX_WIDTH = 160
    const FOLD_SIZE = 14
    const displayTitle = note.title || 'Note'
    // Approximate text width (7px per character for bold 11px font)
    const titleWidth = displayTitle.length * 7
    const width = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, titleWidth + PADDING * 2 + FOLD_SIZE))
    const hasContent = note.content && note.content.length > 0
    const showPreview = hasContent && note.title
    const height = showPreview ? 56 : 40
    return { width, height }
  }

  const CONNECTION_CURVE_OFFSET_STEP = 25
  const CONNECTION_CURVE_BASE_DEPTH = 30

  const getConnectionPairKey = (connection: Connection): string => {
    const ids = [connection.from_thinker_id, connection.to_thinker_id].sort()
    return `${ids[0]}-${ids[1]}`
  }

  const getConnectionOffsets = (inputConnections: Connection[]): Map<string, number> => {
    const pairConnections = new Map<string, Connection[]>()

    inputConnections.forEach((connection) => {
      const pairKey = getConnectionPairKey(connection)
      const existing = pairConnections.get(pairKey)
      if (existing) {
        existing.push(connection)
      } else {
        pairConnections.set(pairKey, [connection])
      }
    })

    const offsets = new Map<string, number>()

    pairConnections.forEach((connectionsForPair) => {
      // Keep offsets stable so lines do not jump when highlight state changes.
      const stableOrder = [...connectionsForPair].sort((a, b) => a.id.localeCompare(b.id))
      const totalOffset = (stableOrder.length - 1) * CONNECTION_CURVE_OFFSET_STEP

      stableOrder.forEach((connection, index) => {
        const curveOffset = index * CONNECTION_CURVE_OFFSET_STEP - totalOffset / 2
        offsets.set(connection.id, curveOffset)
      })
    })

    return offsets
  }

  const orderConnectionsForRendering = (inputConnections: Connection[]): Connection[] => {
    const nonHighlighted: Connection[] = []
    const highlighted: Connection[] = []

    inputConnections.forEach((connection) => {
      const isHighlighted = Boolean(
        highlightSelectedConnections &&
        selectedThinkerId &&
        (connection.from_thinker_id === selectedThinkerId || connection.to_thinker_id === selectedThinkerId)
      )

      if (isHighlighted) {
        highlighted.push(connection)
      } else {
        nonHighlighted.push(connection)
      }
    })

    return [...nonHighlighted, ...highlighted]
  }

  const getConnectionCurvePoints = (
    connection: Connection,
    positions: Map<string, { x: number; y: number; width: number; height: number }>,
    thinkersById: Map<string, Thinker>,
    curveOffsetsById: Map<string, number>
  ): {
    fromX: number
    fromY: number
    toX: number
    toY: number
    controlX1: number
    controlY1: number
    controlX2: number
    controlY2: number
  } | null => {
    const fromThinker = thinkersById.get(connection.from_thinker_id)
    const toThinker = thinkersById.get(connection.to_thinker_id)

    if (!fromThinker || !toThinker) return null

    const fromPos = positions.get(fromThinker.id)
    const toPos = positions.get(toThinker.id)
    if (!fromPos || !toPos) return null

    const fromX = fromPos.x
    const fromY = fromPos.y + fromPos.height / 2
    const toX = toPos.x
    const toY = toPos.y + toPos.height / 2
    const curveOffset = curveOffsetsById.get(connection.id) ?? 0
    const controlY = Math.max(fromY, toY) + CONNECTION_CURVE_BASE_DEPTH + curveOffset

    return {
      fromX,
      fromY,
      toX,
      toY,
      controlX1: fromX,
      controlY1: controlY,
      controlX2: toX,
      controlY2: controlY,
    }
  }

  const drawConnections = (ctx: CanvasRenderingContext2D, connections: Connection[], thinkers: Thinker[], positions: Map<string, { x: number; y: number; width: number; height: number }>) => {
    const thinkersById = new Map(thinkers.map((thinker) => [thinker.id, thinker]))
    const allConns = orderConnectionsForRendering(connections)
    const curveOffsetsById = getConnectionOffsets(connections)

    allConns.forEach((conn) => {
      const curve = getConnectionCurvePoints(conn, positions, thinkersById, curveOffsetsById)
      if (!curve) return

      const { fromX, fromY, toX, toY, controlX1, controlY1, controlX2, controlY2 } = curve

      // Get connection style based on type
      const connType = conn.connection_type as ConnectionStyleType
      const style = CONNECTION_STYLES[connType] || CONNECTION_STYLES.influenced

      // Determine if this connection is highlighted (involves selected thinker)
      const isHighlighted = highlightSelectedConnections && selectedThinkerId &&
        (conn.from_thinker_id === selectedThinkerId || conn.to_thinker_id === selectedThinkerId)

      // Line width based on strength (1-5 maps to 1-4 pixels)
      const baseLineWidth = getConnectionLineWidth(conn.strength)
      const lineWidth = isHighlighted ? baseLineWidth + 1 : baseLineWidth

      // Opacity based on highlight state
      const opacity = isHighlighted ? 1.0 : 0.6

      // Use connection type color
      const color = isHighlighted ? style.highlightColor : style.color
      ctx.strokeStyle = color
      ctx.lineWidth = lineWidth
      ctx.globalAlpha = opacity

      // Set dash pattern for connection type
      ctx.setLineDash(style.dashPattern)

      ctx.beginPath()
      ctx.moveTo(fromX, fromY)

      ctx.bezierCurveTo(controlX1, controlY1, controlX2, controlY2, toX, toY)
      ctx.stroke()

      // Reset line dash for arrow
      ctx.setLineDash([])

      // Arrow - size based on line width
      const arrowSize = 6 + lineWidth
      const angle = Math.atan2(toY - controlY2, toX - controlX2)
      ctx.beginPath()
      ctx.moveTo(toX, toY)
      ctx.lineTo(
        toX - arrowSize * Math.cos(angle - Math.PI / 6),
        toY - arrowSize * Math.sin(angle - Math.PI / 6)
      )
      ctx.lineTo(
        toX - arrowSize * Math.cos(angle + Math.PI / 6),
        toY - arrowSize * Math.sin(angle + Math.PI / 6)
      )
      ctx.closePath()
      ctx.fillStyle = color
      ctx.fill()

      // Draw connection name or type label (only if showConnectionLabels is true)
      if (showConnectionLabels) {
        const labelText = conn.name || style.label

        // Calculate the midpoint of the bezier curve (t=0.5)
        const t = 0.5
        const curveX =
          Math.pow(1 - t, 3) * fromX +
          3 * Math.pow(1 - t, 2) * t * controlX1 +
          3 * (1 - t) * Math.pow(t, 2) * controlX2 +
          Math.pow(t, 3) * toX

        const curveY =
          Math.pow(1 - t, 3) * fromY +
          3 * Math.pow(1 - t, 2) * t * controlY1 +
          3 * (1 - t) * Math.pow(t, 2) * controlY2 +
          Math.pow(t, 3) * toY

        // Draw label with background
        ctx.font = isHighlighted ? 'bold 10px "Inter", sans-serif' : '10px "Inter", sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'

        const metrics = ctx.measureText(labelText)
        const padding = 4
        const bgWidth = metrics.width + padding * 2
        const bgHeight = 14

        // Position label above the curve, with collision avoidance
        let labelY = curveY - 8
        const MIN_LABEL_GAP = 4 // Minimum gap between labels

        // Check for collisions with thinker labels and nudge if necessary
        let hasCollision = true
        let nudgeAttempts = 0
        const maxNudgeAttempts = 10
        const nudgeStep = 15 // How much to move the label each attempt

        while (hasCollision && nudgeAttempts < maxNudgeAttempts) {
          hasCollision = false

          // Check against all thinker positions
          for (const [, pos] of positions) {
            const horizontalOverlap = Math.abs(curveX - pos.x) < (bgWidth + pos.width) / 2 + MIN_LABEL_GAP
            const verticalOverlap = Math.abs(labelY - pos.y) < (bgHeight + pos.height) / 2 + MIN_LABEL_GAP

            if (horizontalOverlap && verticalOverlap) {
              hasCollision = true
              // Nudge label down (away from thinker labels which are above timeline)
              labelY += nudgeStep
              break
            }
          }
          nudgeAttempts++
        }

        // Draw background rectangle with connection color tint
        ctx.globalAlpha = 0.95
        ctx.fillStyle = isHighlighted ? '#FFFFFF' : 'rgba(255, 255, 255, 0.9)'
        ctx.fillRect(curveX - bgWidth / 2, labelY - bgHeight / 2, bgWidth, bgHeight)

        // Draw border in connection color
        ctx.strokeStyle = color
        ctx.lineWidth = 1
        ctx.strokeRect(curveX - bgWidth / 2, labelY - bgHeight / 2, bgWidth, bgHeight)

        // Draw text in connection color
        ctx.globalAlpha = 1.0
        ctx.fillStyle = color
        ctx.fillText(labelText, curveX, labelY)
      }
    })

    // Reset global alpha
    ctx.globalAlpha = 1.0
    ctx.setLineDash([])
  }

  // Calculate event positions with collision detection (text-aware bounding boxes)
  const calculateEventPositions = (events: TimelineEvent[], canvasWidth: number, canvasHeight: number): Map<string, { x: number; y: number }> => {
    const positions = new Map<string, { x: number; y: number }>()
    const centerY = canvasHeight / 2
    const canvas = canvasRef.current
    if (!canvas) return positions
    const ctx = canvas.getContext('2d')
    if (!ctx) return positions

    // Zoom-dependent spacing for events (quantized to avoid jitter during zoom)
    const zoomFactor = Math.round(Math.min(3, Math.max(1, Math.sqrt(scale))) * 2) / 2
    const eventGap = EVENT_VERTICAL_GAP * zoomFactor

    // Sort events by year for left-to-right processing
    const sortedEvents = [...events].sort((a, b) => a.year - b.year)

    // Pre-measure text widths for each event
    ctx.font = '10px "JetBrains Mono", monospace'
    const eventWidths = new Map<string, number>()
    sortedEvents.forEach((event) => {
      const textWidth = ctx.measureText(event.name).width
      // Bounding box width = max of shape width and label text width
      eventWidths.set(event.id, Math.max(EVENT_BBOX_WIDTH, textWidth + 4))
    })

    // Track placed events for collision detection
    const placed: { x: number; y: number; width: number; height: number }[] = []

    sortedEvents.forEach((event) => {
      const x = yearToX(event.year, canvasWidth, scale)
      const baseY = centerY + EVENT_ZONE_OFFSET
      const evtWidth = eventWidths.get(event.id) || EVENT_BBOX_WIDTH

      let bestY = baseY
      let foundFree = false

      // Generate candidates spiraling away from baseY
      for (let ring = 0; ring < 20; ring++) {
        const candidates = ring === 0
          ? [baseY]
          : [baseY - ring * (EVENT_BBOX_HEIGHT + eventGap), baseY + ring * (EVENT_BBOX_HEIGHT + eventGap)]

        for (const candidateY of candidates) {
          if (candidateY < CANVAS_VERTICAL_PADDING || candidateY > canvasHeight - CANVAS_VERTICAL_PADDING) continue

          let hasCollision = false

          for (const existing of placed) {
            const hOverlap = Math.abs(x - existing.x) < (evtWidth + existing.width) / 2
            const vOverlap = Math.abs(candidateY - existing.y) < (EVENT_BBOX_HEIGHT + existing.height) / 2 + eventGap
            if (hOverlap && vOverlap) {
              hasCollision = true
              break
            }
          }

          if (!hasCollision) {
            bestY = candidateY
            foundFree = true
            break
          }
        }
        if (foundFree) break
      }

      placed.push({ x, y: bestY, width: evtWidth, height: EVENT_BBOX_HEIGHT })
      positions.set(event.id, { x, y: bestY })
    })

    return positions
  }

  const drawTimelineEvents = (ctx: CanvasRenderingContext2D, events: TimelineEvent[], canvasWidth: number, canvasHeight: number, eventPositions: Map<string, { x: number; y: number }>) => {
    events.forEach((event) => {
      const pos = eventPositions.get(event.id)
      if (!pos) return
      const { x, y } = pos

      // Different shapes for different event types
      ctx.fillStyle = '#8B4513'  // Brown color for events
      ctx.strokeStyle = '#6B3410'
      ctx.lineWidth = 2

      const size = EVENT_SHAPE_SIZE

      switch (event.event_type) {
        case 'council':
          // Triangle
          ctx.beginPath()
          ctx.moveTo(x, y - size)
          ctx.lineTo(x - size, y + size)
          ctx.lineTo(x + size, y + size)
          ctx.closePath()
          ctx.fill()
          ctx.stroke()
          break

        case 'publication':
          // Rectangle
          ctx.fillRect(x - size, y - size, size * 2, size * 2)
          ctx.strokeRect(x - size, y - size, size * 2, size * 2)
          break

        case 'war':
          // Diamond
          ctx.beginPath()
          ctx.moveTo(x, y - size)
          ctx.lineTo(x + size, y)
          ctx.lineTo(x, y + size)
          ctx.lineTo(x - size, y)
          ctx.closePath()
          ctx.fill()
          ctx.stroke()
          break

        case 'invention':
          // Star
          ctx.beginPath()
          for (let i = 0; i < 5; i++) {
            const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2
            const r = i % 2 === 0 ? size : size / 2
            const px = x + r * Math.cos(angle)
            const py = y + r * Math.sin(angle)
            if (i === 0) ctx.moveTo(px, py)
            else ctx.lineTo(px, py)
          }
          ctx.closePath()
          ctx.fill()
          ctx.stroke()
          break

        case 'cultural':
        case 'political':
        case 'other':
        default:
          // Circle
          ctx.beginPath()
          ctx.arc(x, y, size, 0, Math.PI * 2)
          ctx.fill()
          ctx.stroke()
          break
      }

      // Event label
      ctx.fillStyle = '#333333'
      ctx.font = '10px "JetBrains Mono", monospace'
      ctx.textAlign = 'center'
      ctx.fillText(event.name, x, y - size - 5)
    })
  }

  const drawEmptyState = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.fillStyle = '#666666'
    ctx.font = '16px "Crimson Text", serif'
    ctx.textAlign = 'center'
    ctx.fillText('Cmd/Ctrl+Click to add your first thinker', width / 2, height / 2 - 20)
    ctx.font = '14px "Inter", sans-serif'
    ctx.fillText('Double-click thinkers to edit', width / 2, height / 2 + 5)
  }

  const getCanvasCoordinates = (e: React.MouseEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return null

    const rect = canvas.getBoundingClientRect()
    // Return canvas-space coordinates (after translate, matching what's drawn)
    const x = e.clientX - rect.left - offsetX
    const y = e.clientY - rect.top - offsetY

    return { x, y }
  }

  const getThinkerAtPosition = (x: number, y: number): Thinker | null => {
    const canvas = canvasRef.current
    if (!canvas) return null

    // Use CSS dimensions (not DPR-scaled canvas dimensions) to match click coordinates
    const rect = canvas.getBoundingClientRect()
    const eventPos = timelineEvents.length > 0
      ? calculateEventPositions(timelineEvents, rect.width, rect.height)
      : undefined
    const positions = calculateThinkerPositions(filteredThinkers, rect.width, rect.height, eventPos)

    for (const thinker of filteredThinkers) {
      const pos = positions.get(thinker.id)
      if (!pos) continue

      const { x: tx, y: ty, width: bgWidth, height: bgHeight } = pos

      // Check if click is within the thinker's bounding box
      const halfWidth = bgWidth / 2
      const halfHeight = bgHeight / 2
      if (x >= tx - halfWidth && x <= tx + halfWidth &&
          y >= ty - halfHeight && y <= ty + halfHeight) {
        return thinker
      }
    }
    return null
  }

  // Check if a click position is inside a sticky note
  const getNoteAtPosition = (x: number, y: number): Note | null => {
    // Check in reverse order so notes drawn on top are checked first
    for (let i = canvasNotes.length - 1; i >= 0; i--) {
      const note = canvasNotes[i]
      if (!note.is_canvas_note || note.position_x == null || note.position_y == null) continue

      // Input x,y are in canvas-space (offset already subtracted), so compare directly
      const nx = note.position_x
      const ny = note.position_y
      const { width, height } = getStickyNoteDimensions(note)

      if (x >= nx && x <= nx + width && y >= ny && y <= ny + height) {
        return note
      }
    }
    return null
  }

  const getConnectionAtPosition = (x: number, y: number): Connection | null => {
    const canvas = canvasRef.current
    if (!canvas) return null

    // Use CSS dimensions (not DPR-scaled canvas dimensions) to match click coordinates
    const rect = canvas.getBoundingClientRect()
    const eventPos = timelineEvents.length > 0
      ? calculateEventPositions(timelineEvents, rect.width, rect.height)
      : undefined
    const positions = calculateThinkerPositions(filteredThinkers, rect.width, rect.height, eventPos)
    const thinkersById = new Map(filteredThinkers.map((thinker) => [thinker.id, thinker]))
    const orderedConnections = orderConnectionsForRendering(visibleFilteredConnections)
    const curveOffsetsById = getConnectionOffsets(visibleFilteredConnections)

    // Check top-most connections first (matches draw order with highlighted links on top).
    for (let index = orderedConnections.length - 1; index >= 0; index--) {
      const conn = orderedConnections[index]
      const curve = getConnectionCurvePoints(conn, positions, thinkersById, curveOffsetsById)
      if (!curve) continue

      const {
        fromX,
        fromY,
        toX,
        toY,
        controlX1,
        controlY1,
        controlX2,
        controlY2,
      } = curve

      const clickThreshold = 10 + getConnectionLineWidth(conn.strength) / 2

      // Sample points along the bezier curve and check if click is near any of them
      for (let t = 0; t <= 1; t += 0.02) {
        // Bezier curve formula
        const curveX =
          Math.pow(1 - t, 3) * fromX +
          3 * Math.pow(1 - t, 2) * t * controlX1 +
          3 * (1 - t) * Math.pow(t, 2) * controlX2 +
          Math.pow(t, 3) * toX

        const curveY =
          Math.pow(1 - t, 3) * fromY +
          3 * Math.pow(1 - t, 2) * t * controlY1 +
          3 * (1 - t) * Math.pow(t, 2) * controlY2 +
          Math.pow(t, 3) * toY

        const distance = Math.sqrt((x - curveX) ** 2 + (y - curveY) ** 2)

        if (distance <= clickThreshold) {
          return conn
        }
      }
    }
    return null
  }

  const getEventAtPosition = (x: number, y: number): TimelineEvent | null => {
    const canvas = canvasRef.current
    if (!canvas) return null

    // Use CSS dimensions (not DPR-scaled canvas dimensions) to match click coordinates
    const rect = canvas.getBoundingClientRect()

    // Use calculated event positions (same as rendering)
    const eventPositions = calculateEventPositions(timelineEvents, rect.width, rect.height)

    for (const event of timelineEvents) {
      const pos = eventPositions.get(event.id)
      if (!pos) continue

      const size = EVENT_SHAPE_SIZE

      // Check if click is within event bounds (generous hit area)
      if (x >= pos.x - size * 2 && x <= pos.x + size * 2 &&
          y >= pos.y - size * 2 && y <= pos.y + size * 2) {
        return event
      }
    }
    return null
  }

  // Dynamic zoom bounds based on the actual timeline year span
  const calculateZoomBounds = (): { minScale: number; maxScale: number } => {
    let startYear, endYear
    if (selectedTimeline) {
      startYear = selectedTimeline.start_year ?? DEFAULT_START_YEAR
      endYear = selectedTimeline.end_year ?? DEFAULT_END_YEAR
    } else {
      const range = calculateAllThinkersRange()
      startYear = range.startYear
      endYear = range.endYear
    }
    const yearSpan = endYear - startYear

    // MIN SCALE (zoom out limit): full timeline fits in viewport at scale=1
    const minScale = 1.0

    // MAX SCALE (zoom in limit): ~5 visible years for clear quarter-year detail
    // visibleYears ≈ yearSpan / (0.8 * scale), so scale = yearSpan / (0.8 * targetYears)
    const targetVisibleYears = 5
    const maxScale = Math.max(10, yearSpan / (0.8 * targetVisibleYears))

    return { minScale, maxScale }
  }

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()

    // INVERTED: Regular scroll = zoom, Cmd/Ctrl+scroll = pan
    // Pinch-to-zoom on trackpad sends ctrlKey=true (still zooms)
    const isPan = e.ctrlKey || e.metaKey
    const isPinchZoom = Math.abs(e.deltaY) < 10 && e.ctrlKey // Trackpad pinch gesture

    if (!isPan || isPinchZoom) {
      // ZOOM: Regular scroll wheel or pinch gesture
      const mouseX = e.clientX - rect.left
      const oldScale = scale

      // Pinch zoom deltaY is typically smaller, so use larger multiplier
      // Regular scroll wheel uses smaller multiplier
      const zoomSensitivity = Math.abs(e.deltaY) < 10 ? 0.03 : 0.001
      const delta = 1 - e.deltaY * zoomSensitivity

      const { minScale, maxScale } = calculateZoomBounds()
      const newScale = Math.max(minScale, Math.min(maxScale, oldScale * delta))

      // Calculate timeline bounds
      let startYear, endYear
      if (selectedTimeline) {
        startYear = selectedTimeline.start_year ?? DEFAULT_START_YEAR
        endYear = selectedTimeline.end_year ?? DEFAULT_END_YEAR
      } else {
        const range = calculateAllThinkersRange()
        startYear = range.startYear
        endYear = range.endYear
      }

      const timelineStartX = yearToX(startYear, rect.width, newScale)
      const timelineEndX = yearToX(endYear, rect.width, newScale)

      // Zoom toward mouse cursor
      const worldX = (mouseX - offsetX) / oldScale
      let newOffsetX = mouseX - worldX * newScale

      // Apply boundaries
      const maxOffsetX = rect.width * 0.1 - timelineStartX
      const minOffsetX = rect.width * 0.9 - timelineEndX
      const timelineWidth = timelineEndX - timelineStartX

      if (timelineWidth > rect.width) {
        newOffsetX = Math.min(maxOffsetX, Math.max(minOffsetX, newOffsetX))
      } else {
        newOffsetX = Math.min(rect.width * 0.2, Math.max(-rect.width * 0.2, newOffsetX))
      }

      setScale(newScale)
      setOffsetX(newOffsetX)
    } else {
      // PAN: Cmd/Ctrl + scroll
      let startYear, endYear
      if (selectedTimeline) {
        startYear = selectedTimeline.start_year ?? DEFAULT_START_YEAR
        endYear = selectedTimeline.end_year ?? DEFAULT_END_YEAR
      } else {
        const range = calculateAllThinkersRange()
        startYear = range.startYear
        endYear = range.endYear
      }

      const timelineStartX = yearToX(startYear, rect.width, scale)
      const timelineEndX = yearToX(endYear, rect.width, scale)
      const maxOffsetX = rect.width * 0.1 - timelineStartX
      const minOffsetX = rect.width * 0.9 - timelineEndX
      const timelineWidth = timelineEndX - timelineStartX

      // Apply horizontal pan from deltaX (two-finger horizontal swipe)
      // Apply vertical pan from deltaY (two-finger vertical swipe)
      const panMultiplier = 1.5
      const dx = -e.deltaX * panMultiplier
      const dy = -e.deltaY * panMultiplier

      if (timelineWidth > rect.width) {
        setOffsetX((prev) => Math.min(maxOffsetX, Math.max(minOffsetX, prev + dx)))
      } else {
        setOffsetX((prev) => Math.min(rect.width * 0.2, Math.max(-rect.width * 0.2, prev + dx)))
      }
      setOffsetY((prev) => prev + dy)
    }
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    const coords = getCanvasCoordinates(e)
    if (!coords) return

    const thinker = getThinkerAtPosition(coords.x, coords.y)

    // Check for sticky note click first (they're drawn on top)
    const note = getNoteAtPosition(coords.x, coords.y)
    if (note && onNoteDrag) {
      // Start dragging the note
      setDraggedNoteId(note.id)
      setHasNoteDragged(false)
      const noteX = Math.round(note.position_x ?? 0)
      const noteY = Math.round(note.position_y ?? 0)
      setNoteDragOffset({
        x: Math.round(coords.x - noteX),
        y: Math.round(coords.y - noteY)
      })
      setDraggedNotePos({ x: noteX, y: noteY })
      return
    }

    if (thinker) {
      // Start dragging the thinker if onThinkerDrag callback is provided
      if (onThinkerDrag) {
        // Calculate the thinker's current rendered position
        const canvas = canvasRef.current
        if (canvas) {
          const rect = canvas.getBoundingClientRect()
          const evtPos = timelineEvents.length > 0
            ? calculateEventPositions(timelineEvents, rect.width, rect.height)
            : undefined
          const calculatedPositions = calculateThinkerPositions(filteredThinkers, rect.width, rect.height, evtPos)
          const thinkerPosition = calculatedPositions.get(thinker.id)
          if (thinkerPosition) {
            setDraggedThinkerId(thinker.id)
            setHasDragged(false) // Reset - will be set true on actual movement
            // Store the offset from the click point to the thinker's center
            setDragOffset({
              x: coords.x - thinkerPosition.x,
              y: coords.y - thinkerPosition.y
            })
            setDraggedThinkerPos({ x: thinkerPosition.x, y: thinkerPosition.y })
          }
        }
      }
      // Don't trigger onThinkerClick here - let handleClick do it after checking for drag
    } else {
      // Check for event click
      const event = getEventAtPosition(coords.x, coords.y)
      if (event) {
        onEventClick?.(event.id)
        return
      }

      // Check for connection click
      const connection = getConnectionAtPosition(coords.x, coords.y)

      if (connection) {
        onConnectionClick?.(connection.id)
      } else if (!e.metaKey && !e.ctrlKey) {
        // Only start panning if NOT Cmd/Ctrl+Click (which is for adding thinkers)
        setIsPanning(true)
        setLastMousePos({ x: e.clientX, y: e.clientY })
      }
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    // Handle thinker dragging
    if (draggedThinkerId) {
      const coords = getCanvasCoordinates(e)
      if (coords) {
        const newX = coords.x - dragOffset.x
        const newY = coords.y - dragOffset.y
        // Only mark as dragged if there's significant movement (more than 5 pixels)
        if (draggedThinkerPos) {
          const dx = Math.abs(newX - draggedThinkerPos.x)
          const dy = Math.abs(newY - draggedThinkerPos.y)
          if (dx > 5 || dy > 5) {
            setHasDragged(true)
          }
        }
        setDraggedThinkerPos({ x: newX, y: newY })
      }
      return
    }

    // Handle note dragging
    if (draggedNoteId) {
      const coords = getCanvasCoordinates(e)
      if (coords) {
        // Round to integers to avoid sub-pixel jittering
        const newX = Math.round(coords.x - noteDragOffset.x)
        const newY = Math.round(coords.y - noteDragOffset.y)
        // Only mark as dragged if there's significant movement (more than 2 pixels)
        if (draggedNotePos) {
          const dx = Math.abs(newX - draggedNotePos.x)
          const dy = Math.abs(newY - draggedNotePos.y)
          if (dx > 2 || dy > 2) {
            setHasNoteDragged(true)
          }
        }
        setDraggedNotePos({ x: newX, y: newY })
      }
      return
    }

    if (!isPanning) return

    const canvas = canvasRef.current
    if (!canvas) return

    const dx = e.clientX - lastMousePos.x
    const dy = e.clientY - lastMousePos.y

    // Calculate timeline bounds to restrict panning
    let startYear, endYear
    if (selectedTimeline) {
      startYear = selectedTimeline.start_year ?? DEFAULT_START_YEAR
      endYear = selectedTimeline.end_year ?? DEFAULT_END_YEAR
    } else {
      const range = calculateAllThinkersRange()
      startYear = range.startYear
      endYear = range.endYear
    }

    const rect = canvas.getBoundingClientRect()
    const timelineStartX = yearToX(startYear, rect.width, scale)
    const timelineEndX = yearToX(endYear, rect.width, scale)

    // Strict boundary: prevent panning beyond timeline date limits
    const maxOffsetX = rect.width * 0.1 - timelineStartX
    const minOffsetX = rect.width * 0.9 - timelineEndX

    // Only apply boundaries if the timeline is wider than the viewport
    const timelineWidth = timelineEndX - timelineStartX
    if (timelineWidth > rect.width) {
      setOffsetX((prev) => Math.min(maxOffsetX, Math.max(minOffsetX, prev + dx)))
    } else {
      // If timeline fits in viewport, keep it centered or bounded lightly
      setOffsetX((prev) => Math.min(rect.width * 0.2, Math.max(-rect.width * 0.2, prev + dx)))
    }

    setOffsetY((prev) => prev + dy)

    setLastMousePos({ x: e.clientX, y: e.clientY })
  }

  const handleMouseUp = () => {
    // Handle thinker drag end - only save position if there was actual dragging
    if (draggedThinkerId && draggedThinkerPos && onThinkerDrag && hasDragged) {
      const canvas = canvasRef.current
      if (canvas) {
        // Use CSS dimensions (not DPR-scaled canvas dimensions)
        const rect = canvas.getBoundingClientRect()
        // draggedThinkerPos is already in canvas-space (offset subtracted by getCanvasCoordinates)
        // So we don't subtract offset again
        const anchorYear = xToYear(draggedThinkerPos.x, rect.width, scale)
        // Get the timeline axis Y position for calculating vertical offset
        const axisY = rect.height / 2
        // position_y is the offset from the axis line (draggedThinkerPos.y is in canvas-space)
        const positionY = draggedThinkerPos.y - axisY
        onThinkerDrag(draggedThinkerId, anchorYear, positionY)
      }
    }
    // Reset thinker drag state
    setDraggedThinkerId(null)
    setDraggedThinkerPos(null)
    setDragOffset({ x: 0, y: 0 })
    setHasDragged(false)

    // Handle note drag end - only save position if there was actual dragging
    if (draggedNoteId && draggedNotePos && onNoteDrag && hasNoteDragged) {
      // Round positions to integers before saving to avoid sub-pixel values
      const finalX = Math.round(draggedNotePos.x)
      const finalY = Math.round(draggedNotePos.y)
      onNoteDrag(draggedNoteId, finalX, finalY)
      // Mark that we just dragged to prevent click from firing
      justDraggedRef.current = true
      setTimeout(() => { justDraggedRef.current = false }, 100)
    }
    // Reset note drag state
    setDraggedNoteId(null)
    setDraggedNotePos(null)
    setNoteDragOffset({ x: 0, y: 0 })
    setHasNoteDragged(false)

    // Also mark if thinker was dragged
    if (hasDragged) {
      justDraggedRef.current = true
      setTimeout(() => { justDraggedRef.current = false }, 50)
    }

    setIsPanning(false)
  }

  const handleClick = (e: React.MouseEvent) => {
    // Don't trigger click if we just finished dragging
    if (justDraggedRef.current) return

    // Don't block Ctrl+Click even if panning
    const isCtrlClick = e.metaKey || e.ctrlKey
    const isShiftClick = e.shiftKey
    const isAltClick = e.altKey

    if (isPanning && !isCtrlClick) return

    const coords = getCanvasCoordinates(e)
    if (!coords) return

    // Check for sticky note click first (they're drawn on top)
    const note = getNoteAtPosition(coords.x, coords.y)
    if (note && onNoteClick) {
      onNoteClick(note.id)
      return
    }

    const thinker = getThinkerAtPosition(coords.x, coords.y)

    // Single click on a thinker triggers onThinkerClick
    // Pass modifier key states for connection mode (shift+alt) and bulk selection (ctrl/cmd)
    if (thinker && onThinkerClick) {
      onThinkerClick(thinker.id, isShiftClick, isCtrlClick, isAltClick)
      return
    }

    // In sticky note mode, clicking on empty space places a note
    if (!thinker && onCanvasClick && stickyNoteMode) {
      onCanvasClick(coords)
      return
    }

    // Only trigger add thinker modal on Cmd/Ctrl+Click on empty space (without shift)
    if (!thinker && onCanvasClick && isCtrlClick && !isShiftClick) {
      onCanvasClick(coords)
      return
    }

    // Clicking empty space (no thinker, note, event, or connection) deselects
    if (!thinker && !isCtrlClick) {
      onEmptyClick?.()
    }
  }

  const handleDoubleClick = (e: React.MouseEvent) => {
    const coords = getCanvasCoordinates(e)
    if (!coords) return

    const thinker = getThinkerAtPosition(coords.x, coords.y)

    // Double-click on a thinker to select it (opens detail panel)
    if (thinker) {
      onThinkerClick?.(thinker.id)
    }
  }

  if (thinkersLoading || connectionsLoading || eventsLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-secondary">Loading timeline...</p>
      </div>
    )
  }

  return (
    <div className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-move touch-none"
        style={{ touchAction: 'none' }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
      />

      <div className="absolute bottom-4 right-4 flex gap-2">
        <button
          onClick={() => {
            const { maxScale } = calculateZoomBounds()
            setScale((prev) => Math.min(maxScale, prev * 1.1))
          }}
          className="px-3 py-2 bg-white border border-timeline rounded shadow-sm hover:bg-gray-50 font-sans text-sm"
        >
          Zoom In
        </button>
        <button
          onClick={() => {
            const { minScale } = calculateZoomBounds()
            setScale((prev) => Math.max(minScale, prev * 0.9))
          }}
          className="px-3 py-2 bg-white border border-timeline rounded shadow-sm hover:bg-gray-50 font-sans text-sm"
        >
          Zoom Out
        </button>
        <button
          onClick={() => {
            setScale(1)
            setOffsetX(0)
            setOffsetY(0)
          }}
          className="px-3 py-2 bg-white border border-timeline rounded shadow-sm hover:bg-gray-50 font-sans text-sm"
        >
          Reset
        </button>
      </div>
    </div>
  )
}
