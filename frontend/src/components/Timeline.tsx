'use client'

import { useQuery } from '@tanstack/react-query'
import { thinkersApi, connectionsApi, timelineEventsApi } from '@/lib/api'
import { useRef, useEffect, useState, useMemo, useCallback } from 'react'
import { REFERENCE_CANVAS_WIDTH, DEFAULT_START_YEAR, DEFAULT_END_YEAR, TIMELINE_PADDING, TIMELINE_CONTENT_WIDTH_PERCENT, CONNECTION_STYLES, getConnectionLineWidth, ConnectionStyleType } from '@/lib/constants'
import type { Thinker, Connection, Timeline as TimelineType, TimelineEvent, Note, NoteColor } from '@/types'

// Sticky note color palette
const STICKY_NOTE_COLORS: Record<NoteColor, { bg: string; border: string; text: string }> = {
  yellow: { bg: '#FEF3C7', border: '#F59E0B', text: '#78350F' },
  pink: { bg: '#FCE7F3', border: '#EC4899', text: '#831843' },
  blue: { bg: '#DBEAFE', border: '#3B82F6', text: '#1E3A8A' },
  green: { bg: '#D1FAE5', border: '#10B981', text: '#064E3B' },
}

interface TimelineProps {
  onThinkerClick?: (thinkerId: string, isShiftClick?: boolean, isCtrlClick?: boolean, isAltClick?: boolean) => void
  onCanvasClick?: (position: { x: number; y: number }) => void
  onConnectionClick?: (connectionId: string) => void
  onEventClick?: (eventId: string) => void
  onThinkerDrag?: (thinkerId: string, anchorYear: number, positionY: number) => void
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
  highlightSelectedConnections?: boolean
  // Animation support
  animationYear?: number | null
  // Sticky note mode - allows clicking anywhere to place a note
  stickyNoteMode?: boolean
}

export function Timeline({ onThinkerClick, onCanvasClick, onConnectionClick, onEventClick, onThinkerDrag, canvasNotes = [], onNoteClick, onNoteDrag, stickyNotePreviewLength = 50, selectedThinkerId, bulkSelectedIds = [], filterByTimelineId, filterByTagIds = [], searchQuery = '', filterByField = '', filterByYearStart = null, filterByYearEnd = null, selectedTimeline, visibleConnectionTypes, highlightSelectedConnections = true, animationYear = null, stickyNoteMode = false }: TimelineProps) {
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
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001'}/api/timelines/`)
      return response.json()
    },
  })

  const { data: thinkers = [], isLoading: thinkersLoading } = useQuery({
    queryKey: ['thinkers', filterByTimelineId],
    queryFn: () => thinkersApi.getAll(),
  })

  const { data: connections = [], isLoading: connectionsLoading } = useQuery({
    queryKey: ['connections'],
    queryFn: connectionsApi.getAll,
  })

  const { data: timelineEvents = [], isLoading: eventsLoading } = useQuery({
    queryKey: ['timeline-events', filterByTimelineId],
    queryFn: () => timelineEventsApi.getAll(filterByTimelineId || undefined),
  })

  // Helper function to calculate the year to use for positioning a thinker
  // Priority: anchor_year (if set) > midpoint of birth/death > death_year > birth_year > null
  const getThinkerYear = (thinker: Thinker): number | null => {
    // If anchor_year is explicitly set (e.g., after user drag), use it
    if (thinker.anchor_year) {
      return thinker.anchor_year
    }
    // If both birth and death years are available, use the midpoint
    if (thinker.birth_year && thinker.death_year) {
      return Math.round((thinker.birth_year + thinker.death_year) / 2)
    }
    // If only death_year is available, use that
    if (thinker.death_year) {
      return thinker.death_year
    }
    // If only birth_year is available, use that as the position
    if (thinker.birth_year) {
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
      if (t.birth_year) {
        minYear = Math.min(minYear, t.birth_year)
        hasData = true
      }
      if (t.death_year) {
        maxYear = Math.max(maxYear, t.death_year)
        hasData = true
      }
    })

    // BUG #13 FIX: Also consider all timeline bounds to expand master view
    timelines.forEach((timeline: { start_year?: number; end_year?: number }) => {
      if (timeline.start_year) {
        minYear = Math.min(minYear, timeline.start_year)
        hasData = true
      }
      if (timeline.end_year) {
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
      startYear = selectedTimeline.start_year || DEFAULT_START_YEAR
      endYear = selectedTimeline.end_year || DEFAULT_END_YEAR
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
      startYear = selectedTimeline.start_year || DEFAULT_START_YEAR
      endYear = selectedTimeline.end_year || DEFAULT_END_YEAR
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
        const thinkerStart = t.birth_year || null
        const thinkerEnd = t.death_year || null

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
        const thinkerStart = t.birth_year || null
        const thinkerEnd = t.death_year || new Date().getFullYear()

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

    if (timelineEvents.length > 0) {
      drawTimelineEvents(ctx, timelineEvents, canvasWidth, canvasHeight)
    }

    if (filteredConnections.length > 0) {
      drawConnections(ctx, filteredConnections, filteredThinkers, canvasWidth, canvasHeight)
    }

    if (filteredThinkers.length > 0) {
      drawThinkers(ctx, filteredThinkers, canvasWidth, canvasHeight, selectedThinkerId, bulkSelectedIds, draggedThinkerId, draggedThinkerPos)
    } else {
      drawEmptyState(ctx, canvasWidth, canvasHeight)
    }

    // Draw sticky notes on top of everything
    if (canvasNotes.length > 0) {
      drawStickyNotes(ctx, canvasNotes, draggedNoteId, draggedNotePos)
    }

    ctx.restore()
  }, [thinkers, connections, timelineEvents, timelines, scale, offsetX, offsetY, selectedThinkerId, bulkSelectedIds, filteredThinkers, filteredConnections, filterByTimelineId, filterByTagIds, searchQuery, filterByField, filterByYearStart, filterByYearEnd, selectedTimeline, draggedThinkerId, draggedThinkerPos, canvasNotes, stickyNotePreviewLength, draggedNoteId, draggedNotePos])

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
      startYear = selectedTimeline.start_year || DEFAULT_START_YEAR
      endYear = selectedTimeline.end_year || DEFAULT_END_YEAR
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
  const calculateThinkerPositions = (thinkers: Thinker[], canvasWidth: number, canvasHeight: number): Map<string, { x: number; y: number; width: number; height: number }> => {
    const positions = new Map<string, { x: number; y: number; width: number; height: number }>()
    const centerY = canvasHeight / 2
    const canvas = canvasRef.current
    if (!canvas) return positions
    const ctx = canvas.getContext('2d')
    if (!ctx) return positions

    // First pass: calculate base positions and sizes
    const thinkerData: { id: string; x: number; baseY: number; width: number; height: number }[] = []

    thinkers.forEach((thinker) => {
      const thinkerYear = getThinkerYear(thinker)
      const x = thinkerYear
        ? yearToX(thinkerYear, canvasWidth, scale)
        : scaleX(thinker.position_x || canvasWidth / 2)

      ctx.font = '14px "Crimson Text", serif'
      const metrics = ctx.measureText(thinker.name)
      const padding = 8
      const bgWidth = metrics.width + padding * 2
      const bgHeight = 24

      // position_y is stored as an offset from the timeline axis (0 = on the timeline)
      // Positive values go below, negative values go above
      const yOffset = thinker.position_y || 0
      thinkerData.push({
        id: thinker.id,
        x,
        baseY: centerY + yOffset,
        width: bgWidth,
        height: bgHeight
      })
    })

    // Sort by x position for collision detection
    thinkerData.sort((a, b) => a.x - b.x)

    // Scale-independent collision detection parameters
    // Use constant minimum pixel values that don't depend on zoom level
    // This ensures labels never overlap regardless of zoom
    const MIN_HORIZONTAL_GAP = 10 // Constant minimum horizontal gap between labels
    const MIN_VERTICAL_GAP = 6    // Constant minimum vertical gap between labels
    const horizontalMargin = MIN_HORIZONTAL_GAP // Fixed spacing regardless of zoom
    const verticalSpacing = MIN_VERTICAL_GAP    // Fixed spacing regardless of zoom
    const elevationOffset = -5 // Small offset to position thinkers just above the timeline line

    // Second pass: resolve collisions by moving thinkers vertically
    const placed: { x: number; y: number; width: number; height: number; id: string }[] = []

    thinkerData.forEach((thinker) => {
      let y = thinker.baseY + elevationOffset
      let foundPosition = false
      let attempts = 0
      const maxAttempts = 30

      while (!foundPosition && attempts < maxAttempts) {
        foundPosition = true

        for (const existing of placed) {
          // Check horizontal overlap with zoom-adjusted margin
          const horizontalOverlap = Math.abs(thinker.x - existing.x) < (thinker.width + existing.width) / 2 + horizontalMargin

          if (horizontalOverlap) {
            // Check vertical overlap with zoom-adjusted spacing
            const verticalOverlap = Math.abs(y - existing.y) < (thinker.height + existing.height) / 2 + verticalSpacing

            if (verticalOverlap) {
              // Alternate stacking direction - favor spreading upward from timeline
              if (attempts % 2 === 0) {
                y = existing.y - existing.height / 2 - thinker.height / 2 - verticalSpacing
              } else {
                y = existing.y + existing.height / 2 + thinker.height / 2 + verticalSpacing
              }
              foundPosition = false
              break
            }
          }
        }
        attempts++
      }

      placed.push({ x: thinker.x, y, width: thinker.width, height: thinker.height, id: thinker.id })
      positions.set(thinker.id, { x: thinker.x, y, width: thinker.width, height: thinker.height })
    })

    return positions
  }

  const drawThinkers = (ctx: CanvasRenderingContext2D, thinkers: Thinker[], canvasWidth: number, canvasHeight: number, selectedId?: string | null, bulkSelected: string[] = [], dragId?: string | null, dragPos?: { x: number; y: number } | null) => {
    // Calculate positions with collision detection
    const positions = calculateThinkerPositions(thinkers, canvasWidth, canvasHeight)

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
      ctx.fillText(thinker.name, x, y)

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
    const CORNER_RADIUS = 3
    const PADDING = 6
    const MIN_WIDTH = 80
    const MAX_WIDTH = 150

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

      // Calculate width based on title length (auto-crop)
      ctx.font = 'bold 10px "Inter", sans-serif'
      const displayTitle = note.title || note.content.substring(0, 25)
      const titleWidth = ctx.measureText(displayTitle).width
      const STICKY_WIDTH = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, titleWidth + PADDING * 2 + 4))
      const STICKY_HEIGHT = note.title ? 28 : 36 // Smaller if just title

      // Draw shadow
      ctx.shadowColor = 'rgba(0, 0, 0, 0.12)'
      ctx.shadowBlur = 4
      ctx.shadowOffsetX = 1
      ctx.shadowOffsetY = 1

      // Draw sticky note background with rounded corners
      ctx.fillStyle = colors.bg
      ctx.beginPath()
      ctx.moveTo(x + CORNER_RADIUS, y)
      ctx.lineTo(x + STICKY_WIDTH - CORNER_RADIUS, y)
      ctx.quadraticCurveTo(x + STICKY_WIDTH, y, x + STICKY_WIDTH, y + CORNER_RADIUS)
      ctx.lineTo(x + STICKY_WIDTH, y + STICKY_HEIGHT - CORNER_RADIUS)
      ctx.quadraticCurveTo(x + STICKY_WIDTH, y + STICKY_HEIGHT, x + STICKY_WIDTH - CORNER_RADIUS, y + STICKY_HEIGHT)
      ctx.lineTo(x + CORNER_RADIUS, y + STICKY_HEIGHT)
      ctx.quadraticCurveTo(x, y + STICKY_HEIGHT, x, y + STICKY_HEIGHT - CORNER_RADIUS)
      ctx.lineTo(x, y + CORNER_RADIUS)
      ctx.quadraticCurveTo(x, y, x + CORNER_RADIUS, y)
      ctx.closePath()
      ctx.fill()

      // Reset shadow
      ctx.shadowColor = 'transparent'
      ctx.shadowBlur = 0
      ctx.shadowOffsetX = 0
      ctx.shadowOffsetY = 0

      // Draw border
      ctx.strokeStyle = colors.border
      ctx.lineWidth = 1.5
      ctx.stroke()

      // Draw title or content preview
      ctx.fillStyle = colors.text
      ctx.font = 'bold 10px "Inter", sans-serif'
      const text = note.title || note.content.substring(0, 25) + (note.content.length > 25 ? '...' : '')
      const truncatedText = text.length > 20 ? text.substring(0, 18) + '...' : text
      ctx.fillText(truncatedText, x + PADDING, y + STICKY_HEIGHT / 2 + 3)

      // Draw small indicator if has content (and showing title)
      if (note.title && note.content) {
        ctx.font = '8px "Inter", sans-serif'
        ctx.fillStyle = colors.border
        ctx.fillText('...', x + STICKY_WIDTH - 12, y + STICKY_HEIGHT - 4)
      }
    })
  }

  // Store sticky note dimensions for click detection (needs to match drawing)
  const getStickyNoteDimensions = (note: Note): { width: number; height: number } => {
    const PADDING = 6
    const MIN_WIDTH = 80
    const MAX_WIDTH = 150
    const displayTitle = note.title || note.content.substring(0, 25)
    // Approximate text width (8px per character for bold 10px font)
    const titleWidth = displayTitle.length * 6
    const width = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, titleWidth + PADDING * 2 + 4))
    const height = note.title ? 28 : 36
    return { width, height }
  }

  const drawConnections = (ctx: CanvasRenderingContext2D, connections: Connection[], thinkers: Thinker[], canvasWidth: number, canvasHeight: number) => {
    // Get calculated positions for proper connection endpoints
    const positions = calculateThinkerPositions(thinkers, canvasWidth, canvasHeight)

    // Filter connections by visible types if specified
    const filteredConns = visibleConnectionTypes
      ? connections.filter(conn => visibleConnectionTypes.includes(conn.connection_type as ConnectionStyleType))
      : connections

    // Separate connections into two groups: non-highlighted first, then highlighted
    // This ensures highlighted connections are drawn on top
    const nonHighlighted: Connection[] = []
    const highlighted: Connection[] = []

    filteredConns.forEach((conn) => {
      const isHighlighted = highlightSelectedConnections && selectedThinkerId &&
        (conn.from_thinker_id === selectedThinkerId || conn.to_thinker_id === selectedThinkerId)

      if (isHighlighted) {
        highlighted.push(conn)
      } else {
        nonHighlighted.push(conn)
      }
    })

    // Draw non-highlighted connections first, then highlighted ones on top
    const allConns = [...nonHighlighted, ...highlighted]

    // Group connections by thinker pair to handle dual connections
    const pairConnectionCount = new Map<string, { total: number; current: number }>()
    allConns.forEach((conn) => {
      // Create a consistent key for the pair (sorted IDs)
      const ids = [conn.from_thinker_id, conn.to_thinker_id].sort()
      const pairKey = `${ids[0]}-${ids[1]}`
      const existing = pairConnectionCount.get(pairKey)
      if (existing) {
        existing.total++
      } else {
        pairConnectionCount.set(pairKey, { total: 1, current: 0 })
      }
    })

    allConns.forEach((conn) => {
      const fromThinker = thinkers.find((t) => t.id === conn.from_thinker_id)
      const toThinker = thinkers.find((t) => t.id === conn.to_thinker_id)

      if (!fromThinker || !toThinker) return

      // Use calculated positions for endpoints
      const fromPos = positions.get(fromThinker.id)
      const toPos = positions.get(toThinker.id)
      if (!fromPos || !toPos) return

      // Calculate offset for dual connections
      const ids = [conn.from_thinker_id, conn.to_thinker_id].sort()
      const pairKey = `${ids[0]}-${ids[1]}`
      const pairInfo = pairConnectionCount.get(pairKey)!
      const connectionIndex = pairInfo.current++
      const totalConnections = pairInfo.total

      // Calculate offset: spread connections evenly
      const offsetStep = 25 // Pixels between parallel connections
      const totalOffset = (totalConnections - 1) * offsetStep
      const curveOffset = connectionIndex * offsetStep - totalOffset / 2

      const fromX = fromPos.x
      const fromY = fromPos.y + fromPos.height / 2 // Bottom of the box
      const toX = toPos.x
      const toY = toPos.y + toPos.height / 2 // Bottom of the box

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

      // More elegant curved connection with offset for dual connections
      const midY = Math.max(fromY, toY) + 30 + curveOffset // Curve dips below, offset for parallels
      const controlX1 = fromX
      const controlY1 = midY
      const controlX2 = toX
      const controlY2 = midY

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

      // Draw connection name or type label
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
    })

    // Reset global alpha
    ctx.globalAlpha = 1.0
    ctx.setLineDash([])
  }

  const drawTimelineEvents = (ctx: CanvasRenderingContext2D, events: TimelineEvent[], canvasWidth: number, canvasHeight: number) => {
    const centerY = canvasHeight / 2

    events.forEach((event) => {
      const x = yearToX(event.year, canvasWidth, scale)
      const y = centerY - 15  // Position events just above the timeline line

      // Different shapes for different event types
      ctx.fillStyle = '#8B4513'  // Brown color for events
      ctx.strokeStyle = '#6B3410'
      ctx.lineWidth = 2

      const size = 8

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
    const positions = calculateThinkerPositions(filteredThinkers, rect.width, rect.height)

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

    const clickThreshold = 10  // pixels

    // Use CSS dimensions (not DPR-scaled canvas dimensions) to match click coordinates
    const rect = canvas.getBoundingClientRect()
    const positions = calculateThinkerPositions(filteredThinkers, rect.width, rect.height)

    for (const conn of filteredConnections) {
      const fromThinker = filteredThinkers.find((t) => t.id === conn.from_thinker_id)
      const toThinker = filteredThinkers.find((t) => t.id === conn.to_thinker_id)

      if (!fromThinker || !toThinker) continue

      // Use calculated positions (same as in drawConnections)
      const fromPos = positions.get(fromThinker.id)
      const toPos = positions.get(toThinker.id)
      if (!fromPos || !toPos) continue

      const fromX = fromPos.x
      const fromY = fromPos.y + fromPos.height / 2
      const toX = toPos.x
      const toY = toPos.y + toPos.height / 2

      // Calculate control points (same as in drawConnections)
      const midY = Math.max(fromY, toY) + 30
      const controlX1 = fromX
      const controlY1 = midY
      const controlX2 = toX
      const controlY2 = midY

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
    const centerY = rect.height / 2
    const eventY = centerY - 15  // Same as in drawTimelineEvents

    for (const event of timelineEvents) {
      const eventX = yearToX(event.year, rect.width, scale)
      const size = 8  // Same as in drawTimelineEvents

      // Check if click is within event bounds (generous hit area)
      if (x >= eventX - size * 2 && x <= eventX + size * 2 &&
          y >= eventY - size * 2 && y <= eventY + size * 2) {
        return event
      }
    }
    return null
  }

  // BUG #3 FIX: Calculate minimum scale that ensures timeline always fills the screen
  const calculateMinScale = (canvasWidth: number): number => {
    let startYear, endYear
    if (selectedTimeline) {
      startYear = selectedTimeline.start_year || DEFAULT_START_YEAR
      endYear = selectedTimeline.end_year || DEFAULT_END_YEAR
    } else {
      const range = calculateAllThinkersRange()
      startYear = range.startYear
      endYear = range.endYear
    }

    // Calculate the base timeline width (at scale=1) using the same formula as yearToX
    const yearSpan = endYear - startYear
    const pixelsPerYear = (canvasWidth * TIMELINE_CONTENT_WIDTH_PERCENT) / yearSpan
    const baseTimelineWidth = TIMELINE_PADDING * 2 + yearSpan * pixelsPerYear

    // Minimum scale ensures timeline fills the viewport
    // We want: baseTimelineWidth * minScale >= canvasWidth
    return canvasWidth / baseTimelineWidth
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

      const minScale = calculateMinScale(rect.width)
      const newScale = Math.max(minScale, Math.min(100, oldScale * delta))

      // Calculate timeline bounds
      let startYear, endYear
      if (selectedTimeline) {
        startYear = selectedTimeline.start_year || DEFAULT_START_YEAR
        endYear = selectedTimeline.end_year || DEFAULT_END_YEAR
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
        startYear = selectedTimeline.start_year || DEFAULT_START_YEAR
        endYear = selectedTimeline.end_year || DEFAULT_END_YEAR
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
      const noteX = note.position_x || 0
      const noteY = note.position_y || 0
      setNoteDragOffset({
        x: coords.x - noteX,
        y: coords.y - noteY
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
          const calculatedPositions = calculateThinkerPositions(filteredThinkers, rect.width, rect.height)
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
        const newX = coords.x - noteDragOffset.x
        const newY = coords.y - noteDragOffset.y
        // Only mark as dragged if there's significant movement (more than 5 pixels)
        if (draggedNotePos) {
          const dx = Math.abs(newX - draggedNotePos.x)
          const dy = Math.abs(newY - draggedNotePos.y)
          if (dx > 5 || dy > 5) {
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
      startYear = selectedTimeline.start_year || DEFAULT_START_YEAR
      endYear = selectedTimeline.end_year || DEFAULT_END_YEAR
    } else {
      const range = calculateAllThinkersRange()
      startYear = range.startYear
      endYear = range.endYear
    }

    const timelineStartX = yearToX(startYear, canvas.width, scale)
    const timelineEndX = yearToX(endYear, canvas.width, scale)

    // Strict boundary: prevent panning beyond timeline date limits
    const maxOffsetX = canvas.width * 0.1 - timelineStartX
    const minOffsetX = canvas.width * 0.9 - timelineEndX

    // Only apply boundaries if the timeline is wider than the viewport
    const timelineWidth = timelineEndX - timelineStartX
    if (timelineWidth > canvas.width) {
      setOffsetX((prev) => Math.min(maxOffsetX, Math.max(minOffsetX, prev + dx)))
    } else {
      // If timeline fits in viewport, keep it centered or bounded lightly
      setOffsetX((prev) => Math.min(canvas.width * 0.2, Math.max(-canvas.width * 0.2, prev + dx)))
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
      // draggedNotePos is already in canvas-space
      onNoteDrag(draggedNoteId, draggedNotePos.x, draggedNotePos.y)
      // Mark that we just dragged to prevent click from firing
      justDraggedRef.current = true
      setTimeout(() => { justDraggedRef.current = false }, 50)
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
          onClick={() => setScale((prev) => Math.min(100, prev * 1.1))}
          className="px-3 py-2 bg-white border border-timeline rounded shadow-sm hover:bg-gray-50 font-sans text-sm"
        >
          Zoom In
        </button>
        <button
          onClick={() => {
            const canvas = canvasRef.current
            if (!canvas) return
            const minScale = calculateMinScale(canvas.width)
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
