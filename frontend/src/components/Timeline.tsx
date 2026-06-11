'use client'

import { useQuery } from '@tanstack/react-query'
import { thinkersApi, connectionsApi, timelineEventsApi, timelinesApi } from '@/lib/api'
import { useRef, useEffect, useState, useMemo, useCallback } from 'react'
import { REFERENCE_CANVAS_WIDTH, DEFAULT_START_YEAR, DEFAULT_END_YEAR, TIMELINE_PADDING, TIMELINE_CONTENT_WIDTH_PERCENT, CONNECTION_STYLES, getConnectionLineWidth, ConnectionStyleType } from '@/lib/constants'
import { classifyItem, resolveThinkerRange, resolveEventRange, barExtent } from '@/lib/timelineItems'
import {
  MIN_BAR_WIDTH, THINKER_BAR_HEIGHT, EVENT_BAR_HEIGHT, BAR_LABEL_PADDING, BAR_LABEL_GAP, MAX_BESIDE_LABEL_PX,
  CURRENT_YEAR, eventFill, eventGlyph, resolveBarLabelLayout, shouldShowTethers, chooseStableLane,
  readableTextColor,
  type BarMeta, type BarStyle, type DotRegistry, type BarLOD, type ScoredLane,
  drawTetherLine, drawBulkCheckbox, drawBar,
} from '@/lib/timelineDraw'
import { packLanes, computeBands, buildThinkerLabel, hexToRgba, wrapText, type LayoutItem } from '@/lib/timelineLayout'
import type { Thinker, Connection, Timeline as TimelineType, TimelineEvent, Note, NoteColor } from '@/types'

// Event layout constants
const EVENT_SHAPE_SIZE = 6
const EVENT_LABEL_HEIGHT = 12
const EVENT_VERTICAL_GAP = 4
const EVENT_ZONE_OFFSET = -28 // Base Y offset from centerY for events (clears the axis tick band so bars/markers don't sit on the year ticks)
const EVENT_BBOX_HEIGHT = EVENT_SHAPE_SIZE * 2 + EVENT_LABEL_HEIGHT // shape + label
const EVENT_BBOX_WIDTH = EVENT_SHAPE_SIZE * 4 // generous horizontal hitbox
const CANVAS_VERTICAL_PADDING = 12
// Reserved clear zone around the axis: nothing is placed here, so items never
// cover the year ticks (centerY±10) or the year labels (centerY+30).
// (Legacy spiral constants — retired once events also move to lane packing.)
const AXIS_BAND_ABOVE = 16
const AXIS_BAND_BELOW = 42

// --- Layout (top-anchored axis + downward greedy lane packing) ---
const AXIS_LINE_Y = 22            // axis line Y from canvas top (screen space)
const AXIS_BAND_HEIGHT = 44       // sticky gutter: line + year labels, never drawn into
const SECTION_GAP = 10            // gap between axis→events and events→thinkers
const LANE_BOX_HEIGHT = 15        // unified thinker row height (point box AND lifespan bar)
const LANE_ROW_GAP = 2            // tight inter-row gap  → laneStep = 17
const LANE_FONT_PX = 11           // thinker label font (small, for density)
const LANE_LABEL_PAD = 5          // inside-box horizontal padding per side (tight)
const EVENT_LANE_STEP = 16        // event row pitch
const EVENT_LABEL_FONT_PX = 9     // event label font (small)
const HORIZONTAL_GAP = 6          // fixed horizontal gap between same-lane items (NOT zoom-scaled)
const BOX_FILL_ALPHA = 0.78       // thinker box fill alpha so connector lines read through
const SELECTED_FILL_ALPHA = 0.92
const STRIPE_WIDTH = 2
// Inline notes: fixed width + fixed small font; full text wraps (no title, no
// ellipsis, minimal padding). Read tiny text via Ctrl/magnify zoom.
const NOTE_WIDTH = 116
const NOTE_FONT_PX = 7
const NOTE_LINE_H = 9
const NOTE_PAD = 3

// Position entries. `bar` is present only for range items (drawn as bars).
// `label` is precomputed (name + life-years when they fit) so the draw pass
// doesn't recompute it.
type ThinkerPos = { x: number; y: number; width: number; height: number; bar?: BarMeta; label?: string }
type EventPos = { x: number; y: number; width: number; height: number; bar?: BarMeta }

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
  connectionFromId?: string | null  // first endpoint while creating a connection
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

export function Timeline({ onThinkerClick, onCanvasClick, onConnectionClick, onEventClick, onThinkerDrag, onEmptyClick, canvasNotes = [], onNoteClick, onNoteDrag, stickyNotePreviewLength = 50, selectedThinkerId, bulkSelectedIds = [], connectionFromId = null, filterByTimelineId, filterByTagIds = [], searchQuery = '', filterByField = '', filterByYearStart = null, filterByYearEnd = null, selectedTimeline, visibleConnectionTypes, showConnectionLabels = true, highlightSelectedConnections = true, animationYear = null, stickyNoteMode = false }: TimelineProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [scale, setScale] = useState(1)
  const [offsetX, setOffsetX] = useState(0)
  const [offsetY, setOffsetY] = useState(0)
  // Magnify = a uniform "camera" zoom (Ctrl/Cmd+wheel) that scales the whole
  // rendered scene — text included — so small labels/notes become readable,
  // WITHOUT changing the year→pixel mapping (that is `scale`). magOffset keeps
  // the cursor point fixed while magnifying.
  const [magnify, setMagnify] = useState(1)
  const [magOffsetX, setMagOffsetX] = useState(0)
  const [magOffsetY, setMagOffsetY] = useState(0)
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

  // Cache for computed positions — avoids expensive collision detection during drag
  const positionCacheRef = useRef<{
    key: string
    thinkerPositions: Map<string, ThinkerPos>
    eventPositions: Map<string, EventPos> | undefined
  }>({ key: '', thinkerPositions: new Map(), eventPositions: undefined })

  // Previous auto-placed row per item id. The collision engine biases toward
  // these so items stay put as the user zooms instead of re-stacking each frame.
  const prevThinkerYRef = useRef<Map<string, number>>(new Map())
  const prevEventYRef = useRef<Map<string, number>>(new Map())
  // Number of packed event lanes (set by calculateEventPositions, read by
  // calculateThinkerPositions to know where the thinker band starts).
  const eventLaneCountRef = useRef(0)
  // Target lane of the thinker currently being dragged (set in handleMouseMove);
  // packLanes pins it there and reflows the rest around it.
  const dragLaneRef = useRef<number | null>(null)

  const { data: timelines = [] } = useQuery({
    queryKey: ['timelines'],
    queryFn: timelinesApi.getAll,
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
    timelines.forEach((timeline: TimelineType) => {
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

  // Clamp vertical pan to the content extent: content top stays just under the
  // sticky axis band (offsetY ≤ 0), and you can't scroll past the lowest lane.
  // When all lanes already fit the viewport, vertical pan is pinned at 0.
  const clampOffsetY = (value: number): number => {
    const canvas = canvasRef.current
    const viewportH = canvas ? canvas.getBoundingClientRect().height : 800
    let maxLaneY = 0
    for (const p of positionCacheRef.current.thinkerPositions.values()) {
      if (p.y > maxLaneY) maxLaneY = p.y
    }
    const contentBottom = maxLaneY + LANE_BOX_HEIGHT + SECTION_GAP
    const minOffsetY = Math.min(0, viewportH - contentBottom)
    return Math.max(minOffsetY, Math.min(0, value))
  }

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

    // Non-passive listener so we can actually preventDefault. Without this the
    // React onWheel handler runs in a passive context (preventDefault throws),
    // so the page scrolls instead of zooming. We swallow the browser default
    // for ALL wheel events over the canvas; the React handler does the zoom/pan.
    const preventZoom = (e: WheelEvent) => {
      e.preventDefault()
    }
    canvas.addEventListener('wheel', preventZoom, { passive: false, capture: true })
    return () => canvas.removeEventListener('wheel', preventZoom, { capture: true })
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // High-DPI canvas scaling to prevent pixelation.
    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()

    // Only resize the backing bitmap when the dimensions actually change.
    // Assigning canvas.width/height forces a full GPU realloc + clear, which on
    // every pointer-move (drag) drops frames ("janky / skipping"); guard it.
    const bw = Math.round(rect.width * dpr)
    const bh = Math.round(rect.height * dpr)
    if (canvas.width !== bw || canvas.height !== bh) {
      canvas.width = bw
      canvas.height = bh
    }
    // Reset to the DPR base transform every frame (absolute, not cumulative).
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    // Use CSS dimensions for layout calculations
    const canvasWidth = rect.width
    const canvasHeight = rect.height

    ctx.clearRect(0, 0, canvasWidth, canvasHeight)

    // Camera magnify: a uniform scale over the WHOLE scene (content + axis) so
    // small text becomes readable. At magnify=1 this is a no-op (the axis stays
    // pinned to the top). It does NOT touch the year→pixel mapping.
    ctx.translate(magOffsetX, magOffsetY)
    ctx.scale(magnify, magnify)

    ctx.save()
    ctx.translate(offsetX, offsetY)
    // Removed ctx.scale(scale, scale) - we now scale X coordinates manually for horizontal-only zoom

    drawGrid(ctx, canvasWidth, canvasHeight)
    // The axis ruler is no longer drawn here — it is a sticky screen-space band
    // painted LAST (drawAxisBand, after ctx.restore) so content scrolls under it.

    // Cache-aware position calculation — skip expensive collision detection during drag.
    // Build a key from everything that affects positions (NOT drag state).
    const posKey = `${scale}|${canvasWidth}|${canvasHeight}|${filteredThinkers.map(t => `${t.id}:${t.anchor_year}:${t.position_y}:${t.is_manually_positioned}:${t.birth_year}:${t.death_year}:${t.position_x}`).join(',')}|${timelineEvents.map(e => `${e.id}:${e.year}:${e.end_year}`).join(',')}|drag:${draggedThinkerId ?? ''}:${dragLaneRef.current ?? ''}`

    let eventPositions: Map<string, EventPos> | undefined
    let thinkerPositions: Map<string, ThinkerPos>

    if (positionCacheRef.current.key === posKey) {
      // Reuse cached positions (e.g. during drag — only draggedThinkerPos changed)
      eventPositions = positionCacheRef.current.eventPositions
      thinkerPositions = positionCacheRef.current.thinkerPositions
    } else {
      eventPositions = timelineEvents.length > 0
        ? calculateEventPositions(timelineEvents, canvasWidth, canvasHeight)
        : undefined
      thinkerPositions = filteredThinkers.length > 0
        ? calculateThinkerPositions(filteredThinkers, canvasWidth)
        : new Map<string, ThinkerPos>()
      positionCacheRef.current = { key: posKey, thinkerPositions, eventPositions }
    }

    // Shared registry so coincident axis dots (same rounded x) are drawn once
    // across both events and thinkers, keeping the axis calm at high density.
    const dotRegistry: DotRegistry = new Set<number>()

    // Detail (labels) is always shown; overlap is prevented by vertical stacking
    // + the reserved axis band (see calculate*Positions), not by hiding labels.
    // Tethers, however, are dropped once the axis is so compressed that the
    // visible span exceeds TETHER_HIDE_YEAR_SPAN, since at that zoom the
    // droplines become clutter rather than guidance.
    const { startYear: lodStartYear, endYear: lodEndYear } = selectedTimeline
      ? { startYear: selectedTimeline.start_year ?? DEFAULT_START_YEAR, endYear: selectedTimeline.end_year ?? DEFAULT_END_YEAR }
      : calculateAllThinkersRange()
    const visibleYearSpan = (lodEndYear - lodStartYear) / (TIMELINE_CONTENT_WIDTH_PERCENT * scale)
    const lod = { tether: shouldShowTethers(visibleYearSpan), besideLabel: true }

    // Z-order (back → front): grid → tethers → connectors → thinker boxes →
    // event markers → axis. Tethers are backmost (faint droplines to the ruler);
    // connectors next so the semi-transparent boxes read over them.
    drawTethers(ctx, thinkerPositions, lod)

    if (visibleFilteredConnections.length > 0) {
      drawConnections(ctx, visibleFilteredConnections, filteredThinkers, thinkerPositions)
    }

    if (filteredThinkers.length > 0) {
      // The in-progress connection's "from" thinker is highlighted (bulk style)
      // so it's clear which thinker you're connecting from.
      const highlightBulk = connectionFromId ? [...bulkSelectedIds, connectionFromId] : bulkSelectedIds
      drawThinkers(ctx, filteredThinkers, thinkerPositions, selectedThinkerId, highlightBulk, draggedThinkerId, draggedThinkerPos, canvasHeight, dotRegistry, lod)
    } else {
      drawEmptyState(ctx, canvasWidth, canvasHeight)
    }

    // Event labels are gated by the same zoom threshold as tethers: when the axis
    // is compressed (zoomed out), events render as compact markers so the shallow
    // band doesn't fill with clipped titles; labels appear once zoomed in.
    if (eventPositions && timelineEvents.length > 0) {
      const eventLod = { tether: lod.tether, besideLabel: lod.tether }
      drawTimelineEvents(ctx, timelineEvents, canvasWidth, canvasHeight, eventPositions, dotRegistry, eventLod)
    }

    // Draw sticky notes on top of everything
    if (canvasNotes.length > 0) {
      drawStickyNotes(ctx, canvasNotes, draggedNoteId, draggedNotePos)
    }

    ctx.restore()

    // Sticky top axis band — painted LAST in screen space (ignores vertical pan),
    // so the year ruler is always pinned to the top and content scrolls under it.
    drawAxisBand(ctx, canvasWidth)
  }, [thinkers, connections, timelineEvents, timelines, scale, offsetX, offsetY, magnify, magOffsetX, magOffsetY, selectedThinkerId, bulkSelectedIds, connectionFromId, filteredThinkers, visibleFilteredConnections, filterByTimelineId, filterByTagIds, searchQuery, filterByField, filterByYearStart, filterByYearEnd, selectedTimeline, draggedThinkerId, draggedThinkerPos, canvasNotes, stickyNotePreviewLength, draggedNoteId, draggedNotePos, showConnectionLabels])

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

  // Sticky top axis ruler. Drawn in SCREEN space (after the pan transform is
  // restored) so it stays pinned to the top while content scrolls beneath it.
  // X positions still use yearToX (+ offsetX via a local translate) so ticks
  // track horizontal zoom/pan; Y ignores the vertical pan.
  const drawAxisBand = (ctx: CanvasRenderingContext2D, width: number) => {
    // Opaque gutter strip so panned content scrolls UNDER the ruler.
    ctx.fillStyle = '#FAFAF8'
    ctx.fillRect(0, 0, width, AXIS_BAND_HEIGHT)
    ctx.strokeStyle = '#E0E0E0'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, AXIS_BAND_HEIGHT)
    ctx.lineTo(width, AXIS_BAND_HEIGHT)
    ctx.stroke()

    // Axis line spans the full width.
    ctx.strokeStyle = '#C9C2B6'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(0, AXIS_LINE_Y)
    ctx.lineTo(width, AXIS_LINE_Y)
    ctx.stroke()

    // Year range + interval (same source as yearToX so ticks line up with bars).
    let startYear: number, endYear: number
    if (selectedTimeline) {
      startYear = selectedTimeline.start_year ?? DEFAULT_START_YEAR
      endYear = selectedTimeline.end_year ?? DEFAULT_END_YEAR
    } else {
      const range = calculateAllThinkersRange()
      startYear = range.startYear
      endYear = range.endYear
    }
    const yearSpan = endYear - startYear
    const interval = getYearInterval(width, yearSpan, scale)

    // Ticks + labels: shift X by offsetX so they track horizontal pan. BCE years
    // are shown as "N BCE" rather than a bare negative number.
    ctx.save()
    ctx.translate(offsetX, 0)
    ctx.font = '12px "JetBrains Mono", monospace'
    ctx.textAlign = 'center'
    for (let year = Math.ceil(startYear / interval) * interval; year <= endYear; year += interval) {
      const x = yearToX(year, width, scale)
      const yearLabel = interval < 1
        ? year.toFixed(2).replace(/\.?0+$/, '')
        : year < 0 ? `${-year} BCE` : `${year}`
      ctx.strokeStyle = '#CCCCCC'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x, AXIS_LINE_Y - 6)
      ctx.lineTo(x, AXIS_LINE_Y + 6)
      ctx.stroke()
      ctx.fillStyle = '#666666'
      ctx.fillText(yearLabel, x, AXIS_LINE_Y + 18)
    }
    ctx.restore()
  }

  // Calculate thinker positions with zoom-aware collision detection
  const calculateThinkerPositions = (thinkers: Thinker[], canvasWidth: number): Map<string, ThinkerPos> => {
    const positions = new Map<string, ThinkerPos>()
    const canvas = canvasRef.current
    if (!canvas) return positions
    const ctx = canvas.getContext('2d')
    if (!ctx) return positions

    ctx.font = `${LANE_FONT_PX}px "Crimson Text", serif`
    const measure = (t: string) => ctx.measureText(t).width
    const laneStep = LANE_BOX_HEIGHT + LANE_ROW_GAP
    const MAX_BOX = 220

    // Build a LayoutItem per thinker. Lifespan thinkers (birth + death/today) are
    // bars whose footprint is driven by the plain NAME, so showing life-years
    // never inflates packing density; the years are re-added INSIDE the bar only
    // when they still fit. Point thinkers (no birth year) keep a name box.
    type Built = { id: string; item: LayoutItem; width: number; bar?: BarMeta; label: string }
    const built: Built[] = thinkers.map((thinker) => {
      const range = resolveThinkerRange(thinker, CURRENT_YEAR)
      const classified = classifyItem(range)
      const manualLane = thinker.is_manually_positioned === true && thinker.position_y != null
        ? Math.max(0, Math.round(thinker.position_y / laneStep))
        : undefined
      const pinnedLane = draggedThinkerId === thinker.id && dragLaneRef.current != null
        ? dragLaneRef.current
        : manualLane
      const priority = thinker.is_manually_positioned ? 2 : 0

      if (classified.kind === 'range' && classified.startYear != null && classified.endYear != null) {
        const { x0, x1, barWidth } = barExtent(
          yearToX(classified.startYear, canvasWidth, scale),
          yearToX(classified.endYear, canvasWidth, scale),
          MIN_BAR_WIDTH,
        )
        const nameLayout = resolveBarLabelLayout({
          measure, labelText: thinker.name, barWidthPx: barWidth,
          padding: BAR_LABEL_PADDING, gap: BAR_LABEL_GAP, maxBesidePx: MAX_BESIDE_LABEL_PX,
        })
        let label = thinker.name
        if (nameLayout.placement === 'inside') {
          label = buildThinkerLabel({
            name: thinker.name, birthYear: thinker.birth_year ?? null, deathYear: thinker.death_year ?? null,
            measure, maxWidth: barWidth - BAR_LABEL_PADDING * 2,
          }).text
        }
        const bar: BarMeta = { x0, x1, ongoing: range.ongoing, labelText: label, placement: nameLayout.placement, besideMaxPx: nameLayout.besideMaxPx }
        return {
          id: thinker.id,
          item: { id: thinker.id, left: x0, right: x0 + nameLayout.footprintWidth, height: LANE_BOX_HEIGHT, priority, pinnedLane },
          width: nameLayout.footprintWidth, bar, label,
        }
      }

      const thinkerYear = getThinkerYear(thinker)
      const cx = thinkerYear != null
        ? yearToX(thinkerYear, canvasWidth, scale)
        : scaleX(thinker.position_x ?? canvasWidth / 2)
      const { text } = buildThinkerLabel({
        name: thinker.name, birthYear: thinker.birth_year ?? null, deathYear: thinker.death_year ?? null,
        measure, maxWidth: MAX_BOX - LANE_LABEL_PAD * 2,
      })
      const width = Math.max(40, Math.min(MAX_BOX, measure(text) + LANE_LABEL_PAD * 2))
      return {
        id: thinker.id,
        item: { id: thinker.id, left: cx - width / 2, right: cx + width / 2, height: LANE_BOX_HEIGHT, priority, pinnedLane },
        width, label: text,
      }
    })

    // Events pack first (their lane count sets the band offset), then thinkers
    // flow downward from just below the event band — never into the axis gutter.
    const { thinkerTopY } = computeBands({
      axisBandHeight: AXIS_BAND_HEIGHT, sectionGap: SECTION_GAP,
      eventLaneStep: EVENT_LANE_STEP, eventLaneCount: eventLaneCountRef.current,
    })
    const placed = packLanes(built.map((b) => b.item), {
      topY: thinkerTopY + LANE_BOX_HEIGHT / 2,
      laneStep,
      laneGap: HORIZONTAL_GAP,
    })

    built.forEach((b) => {
      const p = placed.get(b.id)
      if (!p) return
      const cx = (b.item.left + b.item.right) / 2
      positions.set(b.id, { x: cx, y: p.y, width: b.width, height: LANE_BOX_HEIGHT, bar: b.bar, label: b.label })
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

  // Vertical tethers from each thinker to the sticky top axis. Drawn as a
  // SEPARATE pass BEFORE connectors and boxes so the droplines sit behind
  // everything else (per design: they're a faint reference, not foreground).
  const drawTethers = (ctx: CanvasRenderingContext2D, positions: Map<string, ThinkerPos>, lod: BarLOD) => {
    if (!lod.tether) return
    const axisY = AXIS_LINE_Y - offsetY
    for (const pos of positions.values()) {
      const topEdge = pos.y - pos.height / 2
      if (topEdge <= axisY) continue
      if (pos.bar) {
        drawTetherLine(ctx, pos.bar.x0, topEdge, axisY)
        if (!pos.bar.ongoing) drawTetherLine(ctx, pos.bar.x1, topEdge, axisY)
      } else {
        drawTetherLine(ctx, pos.x, topEdge, axisY)
      }
    }
  }

  // Additional tags (index ≥ 1) as thin stacked stripes on the box's left edge.
  const drawTagStripes = (ctx: CanvasRenderingContext2D, thinker: Thinker, leftX: number, y: number, h: number) => {
    const extra = (thinker.tags ?? []).slice(1, 4)
    extra.forEach((t, i) => {
      if (!t.color) return
      ctx.fillStyle = t.color
      ctx.fillRect(leftX + i * STRIPE_WIDTH, y - h / 2, STRIPE_WIDTH, h)
    })
  }

  const drawThinkers = (ctx: CanvasRenderingContext2D, thinkers: Thinker[], positions: Map<string, ThinkerPos>, selectedId?: string | null, bulkSelected: string[] = [], dragId?: string | null, dragPos?: { x: number; y: number } | null, canvasHeight = 0, dotRegistry?: DotRegistry, lod: BarLOD = { tether: true, besideLabel: true }) => {

    thinkers.forEach((thinker) => {
      const pos = positions.get(thinker.id)
      if (!pos) return

      // Use dragged position if this thinker is being dragged. Range bars are
      // horizontally locked (data-driven), so a drag only moves the row (y).
      let { x, y, width: bgWidth, height: bgHeight } = pos
      const bar = pos.bar
      if (dragId === thinker.id && dragPos) {
        y = dragPos.y
        if (!bar) x = dragPos.x
      }
      const isSelected = thinker.id === selectedId
      const isBulkSelected = bulkSelected.includes(thinker.id)
      const forced = isSelected || isBulkSelected
      const itemLod: BarLOD = { tether: false, besideLabel: forced || lod.besideLabel }

      // Fill = first tag's colour (semi-transparent so connectors read through);
      // selection/bulk override. Border full-opacity; text picked for contrast.
      const firstTag = thinker.tags?.[0]?.color ?? null
      const baseFill = isSelected ? '#8B4513' : isBulkSelected ? '#E0F2FE' : (firstTag ?? '#FFFFFF')
      const fillAlpha = isSelected ? SELECTED_FILL_ALPHA : isBulkSelected ? 0.92 : BOX_FILL_ALPHA
      const stroke = isSelected ? '#6B3410' : isBulkSelected ? '#0284C7' : '#B5A89A'
      const textColor = isSelected ? '#FFFFFF' : readableTextColor(baseFill)
      const font = `${LANE_FONT_PX}px "Crimson Text", serif`

      // Range thinker → bar. x (and the bar's x0/x1) is data-locked; drag moves y.
      if (bar) {
        const style: BarStyle = {
          fill: baseFill, stroke, lineWidth: isSelected || isBulkSelected ? 2 : 1,
          font, fillAlpha, textColor,
        }
        drawBar(ctx, bar, y, bgHeight, style, AXIS_LINE_Y - offsetY, dotRegistry, itemLod)
        drawTagStripes(ctx, thinker, bar.x0, y, bgHeight)
        if (isBulkSelected) drawBulkCheckbox(ctx, bar.x0, y)
        return
      }

      // When labels are suppressed (compressed axis), a point thinker collapses
      // to a small tag-coloured marker instead of a full name-box.
      if (!itemLod.besideLabel) {
        ctx.beginPath()
        ctx.arc(x, y, 4, 0, Math.PI * 2)
        ctx.fillStyle = baseFill
        ctx.strokeStyle = stroke
        ctx.lineWidth = 1
        ctx.fill()
        ctx.stroke()
        if (isBulkSelected) drawBulkCheckbox(ctx, x - 4, y)
        return
      }

      // Point thinker → name box (tag-coloured, semi-transparent fill).
      ctx.font = font
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.save()
      ctx.globalAlpha = fillAlpha
      ctx.fillStyle = baseFill
      ctx.fillRect(x - bgWidth / 2, y - bgHeight / 2, bgWidth, bgHeight)
      ctx.restore()
      ctx.strokeStyle = stroke
      ctx.lineWidth = isSelected || isBulkSelected ? 2 : 1
      ctx.strokeRect(x - bgWidth / 2, y - bgHeight / 2, bgWidth, bgHeight)
      drawTagStripes(ctx, thinker, x - bgWidth / 2, y, bgHeight)

      ctx.fillStyle = textColor
      const maxTextWidth = Math.max(10, bgWidth - LANE_LABEL_PAD * 2)
      const labelText = pos.label ?? thinker.name
      ctx.fillText(fitTextToWidth(ctx, labelText, maxTextWidth), x, y)

      if (isBulkSelected) drawBulkCheckbox(ctx, x - bgWidth / 2, y)
    })
  }

  // Draw sticky notes on the canvas
  // Wrap a note's content into the fixed note width using the note font.
  const wrapNoteLines = (ctx: CanvasRenderingContext2D, content: string): string[] => {
    ctx.font = `${NOTE_FONT_PX}px "Inter", sans-serif`
    return wrapText((s) => ctx.measureText(s).width, content ?? '', NOTE_WIDTH - NOTE_PAD * 2)
  }

  const drawStickyNotes = (
    ctx: CanvasRenderingContext2D,
    notes: Note[],
    dragNoteId?: string | null,
    dragNotePos?: { x: number; y: number } | null
  ) => {
    notes.forEach((note) => {
      if (!note.is_canvas_note || note.position_x == null || note.position_y == null) return

      // position_x is stored in unscaled "world" space (like thinker positions),
      // so multiply by scale to keep notes pinned to the timeline through horizontal zoom.
      let x = scaleX(note.position_x)
      let y = note.position_y
      if (dragNoteId === note.id && dragNotePos) {
        x = dragNotePos.x
        y = dragNotePos.y
      }
      const colors = STICKY_NOTE_COLORS[(note.color as NoteColor)] || STICKY_NOTE_COLORS.yellow

      // Just the note text: small fixed font, full content wrapped (no title, no
      // ellipsis), minimal padding. The box height grows to fit every line so
      // nothing is hidden; read the small text via Ctrl/magnify zoom.
      const lines = wrapNoteLines(ctx, note.content ?? '')
      const h = NOTE_PAD * 2 + Math.max(1, lines.length) * NOTE_LINE_H

      ctx.fillStyle = colors.bg
      ctx.strokeStyle = colors.border
      ctx.lineWidth = 0.8
      ctx.beginPath()
      ctx.roundRect(x, y, NOTE_WIDTH, h, 3)
      ctx.fill()
      ctx.stroke()

      ctx.fillStyle = colors.text
      ctx.font = `${NOTE_FONT_PX}px "Inter", sans-serif`
      ctx.textBaseline = 'top'
      ctx.textAlign = 'left'
      lines.forEach((ln, i) => ctx.fillText(ln, x + NOTE_PAD, y + NOTE_PAD + i * NOTE_LINE_H))
      ctx.textBaseline = 'alphabetic'
      ctx.textAlign = 'center'
    })
  }

  // Note dimensions for click detection (matches drawStickyNotes exactly).
  const getStickyNoteDimensions = (note: Note): { width: number; height: number } => {
    const ctx = canvasRef.current?.getContext('2d')
    const lineCount = ctx ? Math.max(1, wrapNoteLines(ctx, note.content ?? '').length) : 1
    return { width: NOTE_WIDTH, height: NOTE_PAD * 2 + lineCount * NOTE_LINE_H }
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
    positions: Map<string, ThinkerPos>,
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

  const drawConnections = (ctx: CanvasRenderingContext2D, connections: Connection[], thinkers: Thinker[], positions: Map<string, ThinkerPos>) => {
    const thinkersById = new Map(thinkers.map((thinker) => [thinker.id, thinker]))
    const allConns = orderConnectionsForRendering(connections)
    const curveOffsetsById = getConnectionOffsets(connections)
    // Rects of connection labels already placed this frame, so a new label can
    // nudge clear of earlier ones (not just clear of thinkers).
    const placedLabelRects: { x: number; y: number; w: number; h: number }[] = []

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

        // Nudge the label clear of both thinker boxes AND already-placed
        // connection labels so relationship labels never overlap.
        let hasCollision = true
        let nudgeAttempts = 0
        const maxNudgeAttempts = 24
        const nudgeStep = 15 // How much to move the label each attempt

        while (hasCollision && nudgeAttempts < maxNudgeAttempts) {
          hasCollision = false

          for (const [, pos] of positions) {
            const horizontalOverlap = Math.abs(curveX - pos.x) < (bgWidth + pos.width) / 2 + MIN_LABEL_GAP
            const verticalOverlap = Math.abs(labelY - pos.y) < (bgHeight + pos.height) / 2 + MIN_LABEL_GAP
            if (horizontalOverlap && verticalOverlap) {
              hasCollision = true
              labelY += nudgeStep
              break
            }
          }
          if (hasCollision) { nudgeAttempts++; continue }

          for (const rect of placedLabelRects) {
            const horizontalOverlap = Math.abs(curveX - rect.x) < (bgWidth + rect.w) / 2 + MIN_LABEL_GAP
            const verticalOverlap = Math.abs(labelY - rect.y) < (bgHeight + rect.h) / 2 + MIN_LABEL_GAP
            if (horizontalOverlap && verticalOverlap) {
              hasCollision = true
              labelY += nudgeStep
              break
            }
          }
          nudgeAttempts++
        }
        placedLabelRects.push({ x: curveX, y: labelY, w: bgWidth, h: bgHeight })

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
  const calculateEventPositions = (events: TimelineEvent[], canvasWidth: number, _canvasHeight: number): Map<string, EventPos> => {
    const positions = new Map<string, EventPos>()
    const canvas = canvasRef.current
    if (!canvas) return positions
    const ctx = canvas.getContext('2d')
    if (!ctx) return positions

    // Sort events by year for left-to-right processing
    const sortedEvents = [...events].sort((a, b) => a.year - b.year)

    // Labels show only when the axis isn't heavily compressed (same gate as the
    // draw pass). When shown, a point event's label sits to the RIGHT of its
    // marker on ONE line, so each lane is a single tight row (no vertical
    // label/marker collisions) and the footprint reserves the label width so
    // labels never overlap horizontally either.
    ctx.font = `${EVENT_LABEL_FONT_PX}px "JetBrains Mono", monospace`
    const measureEvt = (t: string) => ctx.measureText(t).width
    const size = EVENT_SHAPE_SIZE
    let sY: number, eY: number
    if (selectedTimeline) {
      sY = selectedTimeline.start_year ?? DEFAULT_START_YEAR
      eY = selectedTimeline.end_year ?? DEFAULT_END_YEAR
    } else {
      const r = calculateAllThinkersRange(); sY = r.startYear; eY = r.endYear
    }
    const showLabels = shouldShowTethers((eY - sY) / (TIMELINE_CONTENT_WIDTH_PERCENT * scale))

    interface EvtGeom { x: number; left: number; right: number; bar?: BarMeta }
    const geom = new Map<string, EvtGeom>()
    sortedEvents.forEach((event) => {
      const range = resolveEventRange(event)
      const classified = classifyItem(range)
      const labelText = `${eventGlyph(event.event_type)} ${event.name}`
      if (classified.kind === 'range' && classified.startYear != null && classified.endYear != null) {
        const { x0, x1, barWidth } = barExtent(
          yearToX(classified.startYear, canvasWidth, scale),
          yearToX(classified.endYear, canvasWidth, scale),
          MIN_BAR_WIDTH,
        )
        const layout = resolveBarLabelLayout({ measure: measureEvt, labelText, barWidthPx: barWidth, padding: BAR_LABEL_PADDING, gap: BAR_LABEL_GAP, maxBesidePx: MAX_BESIDE_LABEL_PX })
        const labelExtra = showLabels && layout.placement === 'beside' ? BAR_LABEL_GAP + layout.besideMaxPx : 0
        geom.set(event.id, {
          x: x0 + barWidth / 2, left: x0, right: x1 + labelExtra,
          bar: { x0, x1, ongoing: false, labelText, placement: layout.placement, besideMaxPx: layout.besideMaxPx },
        })
      } else {
        const cx = yearToX(event.year, canvasWidth, scale)
        const right = cx + size + (showLabels ? 4 + measureEvt(labelText) : 0)
        geom.set(event.id, { x: cx, left: cx - size, right })
      }
    })

    // Greedy lane-pack the events into the shallow band under the axis.
    const eventItems: LayoutItem[] = sortedEvents.map((event) => {
      const g = geom.get(event.id)!
      return { id: event.id, left: g.left, right: g.right, height: EVENT_LANE_STEP }
    })
    const placedEvents = packLanes(eventItems, {
      topY: AXIS_BAND_HEIGHT + SECTION_GAP + EVENT_LANE_STEP / 2,
      laneStep: EVENT_LANE_STEP,
      laneGap: HORIZONTAL_GAP,
    })
    eventLaneCountRef.current = placedEvents.size > 0
      ? Math.max(...[...placedEvents.values()].map((p) => p.lane + 1))
      : 0

    sortedEvents.forEach((event) => {
      const g = geom.get(event.id)!
      const p = placedEvents.get(event.id)
      if (!p) return
      positions.set(event.id, { x: g.x, y: p.y, width: g.right - g.left, height: EVENT_LANE_STEP, bar: g.bar })
    })

    return positions
  }

  const drawTimelineEvents = (ctx: CanvasRenderingContext2D, events: TimelineEvent[], canvasWidth: number, canvasHeight: number, eventPositions: Map<string, EventPos>, dotRegistry?: DotRegistry, lod: BarLOD = { tether: true, besideLabel: true }) => {
    // Tethers point UP to the sticky top axis (content-space y, see drawThinkers).
    const axisY = AXIS_LINE_Y - offsetY
    events.forEach((event) => {
      const pos = eventPositions.get(event.id)
      if (!pos) return
      const { x, y } = pos

      // Ranged event → type-coloured bar with glyph label (no foreground tether).
      if (pos.bar) {
        const fill = eventFill(event.event_type)
        drawBar(
          ctx,
          pos.bar,
          y,
          EVENT_BAR_HEIGHT,
          { fill, stroke: '#6B3410', lineWidth: 1, font: `${EVENT_LABEL_FONT_PX}px "JetBrains Mono", monospace`, textColor: '#FFFFFF' },
          axisY,
          dotRegistry,
          { tether: false, besideLabel: lod.besideLabel },
        )
        return
      }

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

      // Event label: ONE line to the RIGHT of the marker (glyph + name), so each
      // event lane is a single tight row. Suppressed when the axis is compressed.
      if (lod.besideLabel) {
        ctx.fillStyle = '#5C4A36'
        ctx.font = `${EVENT_LABEL_FONT_PX}px "JetBrains Mono", monospace`
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        ctx.fillText(`${eventGlyph(event.event_type)} ${event.name}`, x + size + 4, y)
      }
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
    // Invert the full transform chain (camera magnify, then content pan) so the
    // returned coords match what was drawn: screen = magOffset + magnify*(offset + content).
    const sx = e.clientX - rect.left
    const sy = e.clientY - rect.top
    const x = (sx - magOffsetX) / magnify - offsetX
    const y = (sy - magOffsetY) / magnify - offsetY

    return { x, y }
  }

  const getThinkerAtPosition = (x: number, y: number): Thinker | null => {
    const canvas = canvasRef.current
    if (!canvas) return null

    // Use CSS dimensions (not DPR-scaled canvas dimensions) to match click coordinates
    const rect = canvas.getBoundingClientRect()
    // Recompute event lanes first (side effect: sets eventLaneCountRef) so the
    // thinker band offset matches the draw pass, then pack thinkers.
    if (timelineEvents.length > 0) calculateEventPositions(timelineEvents, rect.width, rect.height)
    const positions = calculateThinkerPositions(filteredThinkers, rect.width)

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

      // Input x,y are in scaled canvas-space (offset already subtracted). Notes are
      // stored in unscaled world space, so scale the X before comparing. The hit box
      // width/height are screen pixels (text doesn't grow with zoom), so leave them.
      const nx = scaleX(note.position_x)
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
    // Recompute event lanes first (side effect: sets eventLaneCountRef) so the
    // thinker band offset matches the draw pass, then pack thinkers.
    if (timelineEvents.length > 0) calculateEventPositions(timelineEvents, rect.width, rect.height)
    const positions = calculateThinkerPositions(filteredThinkers, rect.width)
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

      if (pos.bar) {
        // Ranged event → hit-test the bar rect (with the label footprint).
        const halfH = (pos.height ?? EVENT_BBOX_HEIGHT) / 2
        if (x >= pos.bar.x0 && x <= pos.x + pos.width / 2 &&
            y >= pos.y - halfH && y <= pos.y + halfH) {
          return event
        }
        continue
      }

      const size = EVENT_SHAPE_SIZE
      // Point event → generous square hit area around the shape.
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
    // Default is prevented by the non-passive native listener (see effect above).
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()

    // IMPORTANT: macOS trackpad pinch-to-zoom reports ctrlKey=true with tiny
    // (<10px) deltas — identical to a real Ctrl key except for magnitude. So a
    // pinch must NOT magnify; it zooms the timeline like a normal gesture. Only a
    // DELIBERATE Ctrl/Cmd + larger scroll (mouse wheel or firm two-finger swipe)
    // triggers the camera MAGNIFY (uniform zoom for reading small text/notes).
    const isPinch = e.ctrlKey && Math.abs(e.deltaY) < 10
    if ((e.ctrlKey || e.metaKey) && !isPinch) {
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      const factor = 1 - e.deltaY * 0.0015
      const newMag = Math.max(1, Math.min(6, magnify * factor))
      if (newMag === 1) {
        setMagnify(1); setMagOffsetX(0); setMagOffsetY(0)
      } else {
        const wx = (mx - magOffsetX) / magnify
        const wy = (my - magOffsetY) / magnify
        setMagnify(newMag)
        setMagOffsetX(mx - wx * newMag)
        setMagOffsetY(my - wy * newMag)
      }
      return
    }

    // Everything else (plain scroll OR pinch) = horizontal time-stretch zoom
    // (changes the year→pixel extent), toward the cursor.
    const mouseX = e.clientX - rect.left
    const oldScale = scale
    // Pinch sends small deltas, the wheel sends larger ones — scale the
    // sensitivity so both produce a comfortable zoom rate.
    const delta = 1 - e.deltaY * (Math.abs(e.deltaY) < 10 ? 0.02 : 0.001)
    const { minScale, maxScale } = calculateZoomBounds()
    const newScale = Math.max(minScale, Math.min(maxScale, oldScale * delta))

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
    const worldX = (mouseX - offsetX) / oldScale
    let newOffsetX = mouseX - worldX * newScale
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
      // draggedNotePos works in scaled screen space (matching getCanvasCoordinates),
      // so convert the stored world X to screen X here.
      const noteScreenX = Math.round(scaleX(note.position_x ?? 0))
      const noteY = Math.round(note.position_y ?? 0)
      setNoteDragOffset({
        x: Math.round(coords.x - noteScreenX),
        y: Math.round(coords.y - noteY)
      })
      setDraggedNotePos({ x: noteScreenX, y: noteY })
      return
    }

    if (thinker) {
      // Start dragging the thinker if onThinkerDrag callback is provided
      if (onThinkerDrag) {
        // Calculate the thinker's current rendered position
        const canvas = canvasRef.current
        if (canvas) {
          const rect = canvas.getBoundingClientRect()
          if (timelineEvents.length > 0) calculateEventPositions(timelineEvents, rect.width, rect.height)
          const calculatedPositions = calculateThinkerPositions(filteredThinkers, rect.width)
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
      // Horizontal position is locked to the thinker's year on the timeline;
      // dragging only moves the node vertically (up/down). We keep the original
      // x (captured at drag start) so the year never changes during a drag.
      if (coords && draggedThinkerPos) {
        const lockedX = draggedThinkerPos.x
        const newY = coords.y - dragOffset.y
        // Target lane from the cursor Y. packLanes pins the dragged thinker into
        // this lane (as a hard obstacle) and reflows every other thinker around
        // it deterministically — live, each frame, via the cache key below.
        const { thinkerTopY } = computeBands({
          axisBandHeight: AXIS_BAND_HEIGHT, sectionGap: SECTION_GAP,
          eventLaneStep: EVENT_LANE_STEP, eventLaneCount: eventLaneCountRef.current,
        })
        const laneStep = LANE_BOX_HEIGHT + LANE_ROW_GAP
        dragLaneRef.current = Math.max(0, Math.round((newY - (thinkerTopY + LANE_BOX_HEIGHT / 2)) / laneStep))
        // Only mark as dragged if there's significant vertical movement (>5px)
        if (Math.abs(newY - draggedThinkerPos.y) > 5) {
          setHasDragged(true)
        }
        setDraggedThinkerPos({ x: lockedX, y: newY })
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
        // For a range thinker (drawn as a bar), x is data-driven from its years
        // and anchor_year is vestigial — preserve it rather than re-deriving a
        // bogus year from the bar's centre. Point thinkers keep year-from-x.
        const dragged = thinkers.find((t) => t.id === draggedThinkerId)
        const isBar = !!dragged && dragged.birth_year != null && (dragged.death_year ?? CURRENT_YEAR) > dragged.birth_year
        const anchorYear = isBar
          ? (dragged!.anchor_year ?? xToYear(draggedThinkerPos.x, rect.width, scale))
          : xToYear(draggedThinkerPos.x, rect.width, scale)
        // position_y is the dropped LANE expressed as a downward pixel offset
        // from the thinker band top (matches the manualLane decode in
        // calculateThinkerPositions: round(position_y / laneStep)).
        const laneStep = LANE_BOX_HEIGHT + LANE_ROW_GAP
        const positionY = (dragLaneRef.current ?? 0) * laneStep
        onThinkerDrag(draggedThinkerId, anchorYear, positionY)
      }
    }
    // Reset thinker drag state
    setDraggedThinkerId(null)
    setDraggedThinkerPos(null)
    setDragOffset({ x: 0, y: 0 })
    setHasDragged(false)
    dragLaneRef.current = null

    // Handle note drag end - only save position if there was actual dragging
    if (draggedNoteId && draggedNotePos && onNoteDrag && hasNoteDragged) {
      // draggedNotePos.x is in scaled screen space; store the unscaled world X so the
      // note stays pinned to the same spot regardless of the zoom level at drag time.
      const finalX = Math.round(draggedNotePos.x / scale)
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

    // In sticky note mode, clicking on empty space places a note. Store the position
    // in unscaled world space (divide X by scale) so it stays pinned through zoom.
    if (!thinker && onCanvasClick && stickyNoteMode) {
      onCanvasClick({ x: coords.x / scale, y: coords.y })
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
            setMagnify(1)
            setMagOffsetX(0)
            setMagOffsetY(0)
          }}
          className="px-3 py-2 bg-white border border-timeline rounded shadow-sm hover:bg-gray-50 font-sans text-sm"
        >
          Reset
        </button>
      </div>
    </div>
  )
}
