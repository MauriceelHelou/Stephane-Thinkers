'use client'

import { useQuery } from '@tanstack/react-query'
import { thinkersApi, connectionsApi, combinedViewsApi } from '@/lib/api'
import { useRef, useEffect, useState, useMemo, useCallback } from 'react'
import { DEFAULT_START_YEAR, DEFAULT_END_YEAR, TIMELINE_PADDING, TIMELINE_CONTENT_WIDTH_PERCENT, CONNECTION_STYLES, getConnectionLineWidth, ConnectionStyleType } from '@/lib/constants'
import type { Thinker, Connection, TimelineEvent, CombinedViewMember, Timeline } from '@/types'

interface CombinedTimelineCanvasProps {
  viewId: string
  onThinkerClick?: (thinkerId: string, isShiftClick?: boolean, isCtrlClick?: boolean, isAltClick?: boolean) => void
  onCanvasClick?: (position: { x: number; y: number }, timelineId: string) => void
  onConnectionClick?: (connectionId: string) => void
  selectedThinkerId?: string | null
  visibleConnectionTypes?: ConnectionStyleType[]
  highlightSelectedConnections?: boolean
  filterByTagIds?: string[]
  searchQuery?: string
  filterByField?: string
  filterByYearStart?: number | null
  filterByYearEnd?: number | null
  animationYear?: number | null
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
  selectedThinkerId,
  visibleConnectionTypes,
  highlightSelectedConnections = true,
  filterByTagIds = [],
  searchQuery = '',
  filterByField = '',
  filterByYearStart = null,
  filterByYearEnd = null,
  animationYear = null,
}: CombinedTimelineCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [offsetX, setOffsetX] = useState(0)
  const [offsetY, setOffsetY] = useState(0)
  const [isPanning, setIsPanning] = useState(false)
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 })
  const [canvasSize, setCanvasSize] = useState({ width: 1200, height: 600 })
  const justPannedRef = useRef(false)
  const panMovedRef = useRef(false)

  const MIN_TIMELINE_SCALE = 1.0
  const CONNECTION_CURVE_OFFSET_STEP = 25
  const CONNECTION_CURVE_BASE_DEPTH = 30

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

  // Compact lane height - keeps timelines close together
  const LANE_HEIGHT = 120

  // Calculate swim-lane center Y for each timeline member
  const getLaneCenterY = useCallback((timelineId: string, canvasHeight: number): number => {
    if (!combinedView || combinedView.members.length === 0) return canvasHeight / 2 + offsetY
    const memberCount = combinedView.members.length
    const memberIndex = combinedView.members.findIndex((m: CombinedViewMember) => m.timeline_id === timelineId)
    if (memberIndex === -1) return canvasHeight / 2 + offsetY

    // Pack lanes tightly around the vertical center of the canvas
    const totalHeight = memberCount * LANE_HEIGHT
    const topOfLanes = (canvasHeight - totalHeight) / 2
    return topOfLanes + memberIndex * LANE_HEIGHT + LANE_HEIGHT / 2 + offsetY
  }, [combinedView, offsetY])

  // Filter thinkers to those in member timelines first.
  const combinedViewThinkers = useMemo(() => {
    if (!combinedView) return []
    const timelineIds = new Set(combinedView.members.map((m: CombinedViewMember) => m.timeline_id))
    return allThinkers.filter(t => timelineIds.has(t.timeline_id || ''))
  }, [allThinkers, combinedView])

  // Apply the same high-level filtering semantics as the main timeline.
  const filteredThinkers = useMemo(() => {
    return combinedViewThinkers.filter((thinker) => {
      if (filterByTagIds.length > 0) {
        const thinkerWithTags = thinker as Thinker & { tags?: { id: string }[] }
        const thinkerTagIds = thinkerWithTags.tags?.map((tag) => tag.id) || []
        const hasAllTags = filterByTagIds.every((tagId) => thinkerTagIds.includes(tagId))
        if (!hasAllTags) return false
      }

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase()
        const nameMatch = thinker.name?.toLowerCase().includes(query)
        const fieldMatch = thinker.field?.toLowerCase().includes(query)
        const biographyMatch = thinker.biography_notes?.toLowerCase().includes(query)
        if (!nameMatch && !fieldMatch && !biographyMatch) return false
      }

      if (filterByField && thinker.field !== filterByField) {
        return false
      }

      if (filterByYearStart !== null || filterByYearEnd !== null) {
        const thinkerStart = thinker.birth_year ?? null
        const thinkerEnd = thinker.death_year ?? null

        if (thinkerStart === null && thinkerEnd === null) {
          return false
        }

        if (filterByYearStart !== null && thinkerEnd !== null && thinkerEnd < filterByYearStart) {
          return false
        }
        if (filterByYearEnd !== null && thinkerStart !== null && thinkerStart > filterByYearEnd) {
          return false
        }
      }

      if (animationYear !== null) {
        const thinkerStart = thinker.birth_year ?? null
        const thinkerEnd = thinker.death_year ?? new Date().getFullYear()
        if (thinkerStart === null) return false
        if (animationYear < thinkerStart || animationYear > thinkerEnd) return false
      }

      return true
    })
  }, [combinedViewThinkers, filterByTagIds, searchQuery, filterByField, filterByYearStart, filterByYearEnd, animationYear])

  // Filter connections to only those between visible thinkers
  const filteredConnections = useMemo(() => {
    const visibleThinkerIds = new Set(filteredThinkers.map(t => t.id))
    return connections.filter(
      c => visibleThinkerIds.has(c.from_thinker_id) && visibleThinkerIds.has(c.to_thinker_id)
    )
  }, [connections, filteredThinkers])

  const visibleFilteredConnections = useMemo(() => {
    if (!visibleConnectionTypes || !Array.isArray(visibleConnectionTypes)) {
      return filteredConnections
    }

    const visibleTypes = new Set<ConnectionStyleType>(visibleConnectionTypes)
    return filteredConnections.filter((connection) =>
      visibleTypes.has(connection.connection_type as ConnectionStyleType)
    )
  }, [filteredConnections, visibleConnectionTypes])

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
    if (thinker.anchor_year != null) return thinker.anchor_year
    // If both birth and death years are available, use the midpoint
    if (thinker.birth_year != null && thinker.death_year != null) {
      return Math.round((thinker.birth_year + thinker.death_year) / 2)
    }
    if (thinker.death_year != null) return thinker.death_year
    if (thinker.birth_year != null) return thinker.birth_year
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
      if (thinker.birth_year != null) minYear = Math.min(minYear, thinker.birth_year)
      if (thinker.death_year != null) maxYear = Math.max(maxYear, thinker.death_year)
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

  const scaleX = useCallback((x: number): number => x * scale + offsetX, [scale, offsetX])

  const calculateMinScale = useCallback((_canvasWidth: number): number => {
    // Full timeline fits in viewport at scale=1 (same as base map)
    return MIN_TIMELINE_SCALE
  }, [MIN_TIMELINE_SCALE])

  const calculateMaxScale = useCallback((): number => {
    const { startYear, endYear } = calculateYearRange()
    const yearSpan = endYear - startYear
    // ~5 visible years at max zoom (same as base map)
    const targetVisibleYears = 5
    return Math.max(10, yearSpan / (0.8 * targetVisibleYears))
  }, [calculateYearRange])

  const getHorizontalPanBounds = useCallback((canvasWidth: number, targetScale: number) => {
    const baseStartX = TIMELINE_PADDING * targetScale
    const baseEndX = (TIMELINE_PADDING + canvasWidth * TIMELINE_CONTENT_WIDTH_PERCENT) * targetScale
    const timelineWidth = baseEndX - baseStartX
    const maxOffsetX = canvasWidth * 0.1 - baseStartX
    const minOffsetX = canvasWidth * 0.9 - baseEndX
    return { maxOffsetX, minOffsetX, timelineWidth }
  }, [])

  const clampOffsetX = useCallback((candidateOffsetX: number, canvasWidth: number, targetScale: number): number => {
    const { maxOffsetX, minOffsetX, timelineWidth } = getHorizontalPanBounds(canvasWidth, targetScale)

    if (timelineWidth > canvasWidth) {
      return Math.min(maxOffsetX, Math.max(minOffsetX, candidateOffsetX))
    }
    return Math.min(canvasWidth * 0.2, Math.max(-canvasWidth * 0.2, candidateOffsetX))
  }, [getHorizontalPanBounds])

  // Calculate thinker positions with collision detection
  // Calculate event positions with collision detection
  const calculateEventPositions = useCallback((
    events: TimelineEvent[],
    canvasWidth: number,
    canvasHeight: number
  ): Map<string, { x: number; y: number }> => {
    const positions = new Map<string, { x: number; y: number }>()
    const laneHeight = LANE_HEIGHT

    // Zoom-dependent spacing (quantized to avoid jitter during zoom)
    const zoomFactor = Math.round(Math.min(3, Math.max(1, Math.sqrt(scale))) * 2) / 2
    const eventGap = 4 * zoomFactor
    const eventBBoxHeight = 8 * 2 + 12 // shape + label
    const defaultEventBBoxWidth = 8 * 4

    // Measure actual text widths for text-aware collision detection
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    const eventWidths = new Map<string, number>()
    if (ctx) {
      ctx.save()
      ctx.font = '10px "JetBrains Mono", monospace'
      events.forEach((event) => {
        const textWidth = ctx.measureText(event.name).width
        eventWidths.set(event.id, Math.max(defaultEventBBoxWidth, textWidth + 4))
      })
      ctx.restore()
    }

    const sortedEvents = [...events].sort((a, b) => a.year - b.year)
    const placed: { x: number; y: number; width: number; height: number }[] = []

    sortedEvents.forEach((event) => {
      const x = yearToX(event.year, canvasWidth)
      const laneCenterY = getLaneCenterY(event.timeline_id, canvasHeight)
      const baseY = laneCenterY - 15
      const evtWidth = eventWidths.get(event.id) ?? defaultEventBBoxWidth

      let bestY = baseY
      let foundFree = false

      for (let ring = 0; ring < 20; ring++) {
        const candidates = ring === 0
          ? [baseY]
          : [baseY - ring * (eventBBoxHeight + eventGap), baseY + ring * (eventBBoxHeight + eventGap)]

        for (const candidateY of candidates) {
          // Clamp to lane boundaries
          const laneTop = laneCenterY - laneHeight / 2 + 12
          const laneBottom = laneCenterY + laneHeight / 2 - 12
          if (candidateY < laneTop || candidateY > laneBottom) continue

          let hasCollision = false
          for (const existing of placed) {
            const hOverlap = Math.abs(x - existing.x) < (evtWidth + existing.width) / 2
            const vOverlap = Math.abs(candidateY - existing.y) < (eventBBoxHeight + existing.height) / 2 + eventGap
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

      placed.push({ x, y: bestY, width: evtWidth, height: eventBBoxHeight })
      positions.set(event.id, { x, y: bestY })
    })

    return positions
  }, [yearToX, offsetY, scale, combinedView, getLaneCenterY])

  const calculateThinkerPositions = useCallback((
    thinkers: Thinker[],
    canvasWidth: number,
    canvasHeight: number,
    eventPositions?: Map<string, { x: number; y: number }>
  ): Map<string, { x: number; y: number; width: number; height: number }> => {
    const positions = new Map<string, { x: number; y: number; width: number; height: number }>()
    const canvas = canvasRef.current
    if (!canvas) return positions
    const ctx = canvas.getContext('2d')
    if (!ctx) return positions

    const laneHeight = LANE_HEIGHT

    // First pass: calculate base positions and sizes
    const thinkerData: { id: string; x: number; baseY: number; width: number; height: number; isManuallyPositioned: boolean }[] = []

    thinkers.forEach((thinker) => {
      const thinkerYear = getThinkerYear(thinker)
      const x = thinkerYear != null
        ? yearToX(thinkerYear, canvasWidth)
        : scaleX(thinker.position_x ?? canvasWidth / 2)

      // Each thinker gets positioned within its timeline's swim lane
      const laneCenterY = getLaneCenterY(thinker.timeline_id || '', canvasHeight)

      ctx.font = '13px "Crimson Text", serif'
      const metrics = ctx.measureText(thinker.name)
      const padding = 8
      // Add extra width for timeline indicator dot
      const bgWidth = metrics.width + padding * 2 + 16
      const bgHeight = 24

      thinkerData.push({
        id: thinker.id,
        x,
        baseY: thinker.position_y != null ? thinker.position_y + laneCenterY : laneCenterY,
        width: bgWidth,
        height: bgHeight,
        isManuallyPositioned: thinker.is_manually_positioned === true,
      })
    })

    // Sort by x position for collision detection
    thinkerData.sort((a, b) => a.x - b.x)

    // Zoom-dependent collision detection parameters (quantized to avoid jitter)
    const MIN_HORIZONTAL_GAP_BASE = 8
    const MIN_VERTICAL_GAP_BASE = 6
    const MIN_LABEL_WIDTH = 56
    const HORIZONTAL_COMPRESSION_FACTORS = [1, 0.92, 0.85, 0.78, 0.72, 0.66, 0.6]
    const SPACING_ZOOM_FACTOR = Math.round(Math.min(3, Math.max(1, Math.sqrt(scale))) * 2) / 2
    const horizontalMargin = MIN_HORIZONTAL_GAP_BASE * SPACING_ZOOM_FACTOR
    const verticalSpacing = MIN_VERTICAL_GAP_BASE * SPACING_ZOOM_FACTOR
    const elevationOffset = -5

    // Second pass: resolve collisions
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
      const eventBBoxHeight = 8 * 2 + 12
      const eventBBoxWidth = 8 * 4
      for (const [, ePos] of eventPositions) {
        placed.push({ x: ePos.x, y: ePos.y, width: eventBBoxWidth, height: eventBBoxHeight, id: '__event__' })
      }
    }

    autoPositionedThinkers.forEach((thinker) => {
      const defaultY = thinker.baseY + elevationOffset
      // Clamp to the thinker's swim lane boundaries
      const minY = Math.max(12 + thinker.height / 2, thinker.baseY - laneHeight / 2 + thinker.height / 2 + 20)
      const maxY = Math.min(canvasHeight - 12 - thinker.height / 2, thinker.baseY + laneHeight / 2 - thinker.height / 2 - 8)
      const laneStep = thinker.height + verticalSpacing

      // Generate candidate lanes from center outward (up, down) to use full vertical space
      const candidateYs: number[] = []
      let ring = 0
      while (true) {
        const upY = defaultY - ring * laneStep
        const downY = defaultY + ring * laneStep
        let addedCandidate = false

        if (ring === 0) {
          if (upY >= minY && upY <= maxY) { candidateYs.push(upY); addedCandidate = true }
        } else {
          if (upY >= minY && upY <= maxY) { candidateYs.push(upY); addedCandidate = true }
          if (downY >= minY && downY <= maxY) { candidateYs.push(downY); addedCandidate = true }
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

          if (foundCollisionFreePlacement) continue

          if (
            collisionCount < bestCollisionCount ||
            (collisionCount === bestCollisionCount && collisionPenalty < bestCollisionPenalty) ||
            (collisionCount === bestCollisionCount && collisionPenalty === bestCollisionPenalty && verticalDistanceFromDefault < bestVerticalDistance)
          ) {
            y = candidateY
            width = candidateWidth
            bestCollisionCount = collisionCount
            bestCollisionPenalty = collisionPenalty
            bestVerticalDistance = verticalDistanceFromDefault
          }
        }

        if (foundCollisionFreePlacement) break
      }

      placed.push({ x: thinker.x, y, width, height: thinker.height, id: thinker.id })
      positions.set(thinker.id, { x: thinker.x, y, width, height: thinker.height })
    })

    return positions
  }, [yearToX, scaleX, offsetY, scale, combinedView, getLaneCenterY])

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

    // Draw grid
    ctx.strokeStyle = '#F0F0F0'
    ctx.lineWidth = 1
    const gridSize = 50
    const gridOffsetX = ((offsetX % gridSize) + gridSize) % gridSize
    const gridOffsetY = ((offsetY % gridSize) + gridSize) % gridSize
    for (let x = gridOffsetX - gridSize; x < canvasWidth + gridSize; x += gridSize) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, canvasHeight)
      ctx.stroke()
    }
    for (let y = gridOffsetY - gridSize; y < canvasHeight + gridSize; y += gridSize) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(canvasWidth, y)
      ctx.stroke()
    }

    // Draw swim-lane separators and axis lines
    const memberCount = combinedView.members.length
    const laneHeight = LANE_HEIGHT
    const totalLanesHeight = memberCount * laneHeight
    const topOfLanes = (canvasHeight - totalLanesHeight) / 2

    combinedView.members.forEach((member: CombinedViewMember, index: number) => {
      const laneCenterY = getLaneCenterY(member.timeline_id, canvasHeight)
      const color = timelineColorMap.get(member.timeline_id)

      // Draw lane separator (between lanes, not above first)
      if (index > 0) {
        const separatorY = topOfLanes + index * laneHeight + offsetY
        ctx.strokeStyle = '#D1D5DB'
        ctx.lineWidth = 1
        ctx.setLineDash([6, 4])
        ctx.beginPath()
        ctx.moveTo(0, separatorY)
        ctx.lineTo(canvasWidth, separatorY)
        ctx.stroke()
        ctx.setLineDash([])
      }

      // Draw lane axis line (colored per timeline)
      ctx.strokeStyle = color?.border || '#E0E0E0'
      ctx.lineWidth = 1.5
      ctx.globalAlpha = 0.4
      ctx.beginPath()
      ctx.moveTo(0, laneCenterY)
      ctx.lineTo(canvasWidth, laneCenterY)
      ctx.stroke()
      ctx.globalAlpha = 1.0
    })

    // Draw year labels along the bottom lane
    const interval = getYearInterval(canvasWidth, yearSpan)
    ctx.fillStyle = '#666666'
    ctx.font = '12px "JetBrains Mono", monospace'
    ctx.textAlign = 'center'

    const bottomLaneCenterY = getLaneCenterY(
      combinedView.members[memberCount - 1].timeline_id,
      canvasHeight
    )

    for (let year = Math.ceil(startYear / interval) * interval; year <= endYear; year += interval) {
      const x = yearToX(year, canvasWidth)
      if (x >= 0 && x <= canvasWidth) {
        ctx.fillText(year.toString(), x, bottomLaneCenterY + laneHeight / 2 - 16)

        // Draw tick marks on each lane's axis
        combinedView.members.forEach((member: CombinedViewMember) => {
          const lcy = getLaneCenterY(member.timeline_id, canvasHeight)
          ctx.strokeStyle = '#CCCCCC'
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.moveTo(x, lcy - 6)
          ctx.lineTo(x, lcy + 6)
          ctx.stroke()
        })
      }
    }

    // Calculate all positions once per frame
    const eventPositions = timelineEvents.length > 0
      ? calculateEventPositions(timelineEvents, canvasWidth, canvasHeight)
      : undefined
    const positions = filteredThinkers.length > 0
      ? calculateThinkerPositions(filteredThinkers, canvasWidth, canvasHeight, eventPositions)
      : new Map<string, { x: number; y: number; width: number; height: number }>()

    // Draw timeline events at calculated positions
    timelineEvents.forEach((event: TimelineEvent) => {
      const pos = eventPositions?.get(event.id)
      if (!pos) return

      const { x, y } = pos
      if (x < -50 || x > canvasWidth + 50) return

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

    // Draw connections
    const thinkersById = new Map(filteredThinkers.map((thinker) => [thinker.id, thinker]))
    const orderedConnections = orderConnectionsForRendering(visibleFilteredConnections)
    const curveOffsetsById = getConnectionOffsets(visibleFilteredConnections)

    orderedConnections.forEach((connection) => {
      const curve = getConnectionCurvePoints(connection, positions, thinkersById, curveOffsetsById)
      if (!curve) return

      const { fromX, fromY, toX, toY, controlX1, controlY1, controlX2, controlY2 } = curve
      const connectionType = connection.connection_type as ConnectionStyleType
      const style = CONNECTION_STYLES[connectionType] || CONNECTION_STYLES.influenced
      const isHighlighted = Boolean(
        highlightSelectedConnections &&
        selectedThinkerId &&
        (connection.from_thinker_id === selectedThinkerId || connection.to_thinker_id === selectedThinkerId)
      )

      const baseLineWidth = getConnectionLineWidth(connection.strength)
      const lineWidth = isHighlighted ? baseLineWidth + 1 : baseLineWidth
      const color = isHighlighted ? style.highlightColor : style.color

      ctx.strokeStyle = color
      ctx.lineWidth = lineWidth
      ctx.globalAlpha = isHighlighted ? 1.0 : 0.5
      ctx.setLineDash(style.dashPattern)

      ctx.beginPath()
      ctx.moveTo(fromX, fromY)
      ctx.bezierCurveTo(controlX1, controlY1, controlX2, controlY2, toX, toY)
      ctx.stroke()

      ctx.setLineDash([])
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

  }, [combinedView, filteredThinkers, visibleFilteredConnections, timelineEvents, scale, offsetX, offsetY, selectedThinkerId, highlightSelectedConnections, canvasSize, calculateYearRange, yearToX, getYearInterval, calculateThinkerPositions, calculateEventPositions, timelineColorMap, getLaneCenterY])

  const getCanvasCoordinates = (e: React.MouseEvent): { x: number; y: number } | null => {
    const canvas = canvasRef.current
    if (!canvas) return null

    const rect = canvas.getBoundingClientRect()
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    }
  }

  const getThinkerAtPosition = (clickX: number, clickY: number): Thinker | null => {
    const canvas = canvasRef.current
    if (!canvas) return null

    const rect = canvas.getBoundingClientRect()
    const evtPos = timelineEvents.length > 0
      ? calculateEventPositions(timelineEvents, rect.width, rect.height)
      : undefined
    const positions = calculateThinkerPositions(filteredThinkers, rect.width, rect.height, evtPos)

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

  const getConnectionAtPosition = (clickX: number, clickY: number): Connection | null => {
    const canvas = canvasRef.current
    if (!canvas) return null

    const rect = canvas.getBoundingClientRect()
    const evtPos = timelineEvents.length > 0
      ? calculateEventPositions(timelineEvents, rect.width, rect.height)
      : undefined
    const positions = calculateThinkerPositions(filteredThinkers, rect.width, rect.height, evtPos)
    const thinkersById = new Map(filteredThinkers.map((thinker) => [thinker.id, thinker]))
    const orderedConnections = orderConnectionsForRendering(visibleFilteredConnections)
    const curveOffsetsById = getConnectionOffsets(visibleFilteredConnections)

    for (let index = orderedConnections.length - 1; index >= 0; index--) {
      const connection = orderedConnections[index]
      const curve = getConnectionCurvePoints(connection, positions, thinkersById, curveOffsetsById)
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

      const clickThreshold = 10 + getConnectionLineWidth(connection.strength) / 2

      for (let t = 0; t <= 1; t += 0.02) {
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

        const distance = Math.sqrt((clickX - curveX) ** 2 + (clickY - curveY) ** 2)
        if (distance <= clickThreshold) {
          return connection
        }
      }
    }

    return null
  }

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()

    // Keep behavior consistent with main timeline:
    // scroll/pinch = zoom, Ctrl/Cmd+scroll = pan.
    const isPan = e.ctrlKey || e.metaKey
    const isPinchZoom = Math.abs(e.deltaY) < 10 && e.ctrlKey

    if (!isPan || isPinchZoom) {
      const oldScale = scale
      const mouseX = e.clientX - rect.left
      const zoomSensitivity = Math.abs(e.deltaY) < 10 ? 0.03 : 0.001
      const delta = 1 - e.deltaY * zoomSensitivity
      const minScale = calculateMinScale(rect.width)
      const maxScale = calculateMaxScale()
      const newScale = Math.max(minScale, Math.min(maxScale, oldScale * delta))

      const worldX = (mouseX - offsetX) / oldScale
      const candidateOffsetX = mouseX - worldX * newScale
      const clampedOffsetX = clampOffsetX(candidateOffsetX, rect.width, newScale)

      setScale(newScale)
      setOffsetX(clampedOffsetX)
      return
    }

    const panMultiplier = 1.5
    const dx = -e.deltaX * panMultiplier
    const dy = -e.deltaY * panMultiplier
    setOffsetX((prev) => clampOffsetX(prev + dx, rect.width, scale))
    setOffsetY((prev) => prev + dy)
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return
    setIsPanning(true)
    panMovedRef.current = false
    setLastMousePos({ x: e.clientX, y: e.clientY })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return

    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const dx = e.clientX - lastMousePos.x
    const dy = e.clientY - lastMousePos.y

    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
      panMovedRef.current = true
    }

    setOffsetX((prev) => clampOffsetX(prev + dx, rect.width, scale))
    setOffsetY((prev) => prev + dy)
    setLastMousePos({ x: e.clientX, y: e.clientY })
  }

  const handleMouseUp = () => {
    if (panMovedRef.current) {
      justPannedRef.current = true
      setTimeout(() => {
        justPannedRef.current = false
      }, 60)
    }
    setIsPanning(false)
  }

  const handleClick = (e: React.MouseEvent) => {
    if (justPannedRef.current) return

    const coords = getCanvasCoordinates(e)
    if (!coords) return
    const { x, y } = coords
    const isShiftClick = e.shiftKey
    const isCtrlClick = e.metaKey || e.ctrlKey
    const isAltClick = e.altKey

    const thinker = getThinkerAtPosition(x, y)
    if (thinker) {
      onThinkerClick?.(thinker.id, isShiftClick, isCtrlClick, isAltClick)
      return
    }

    const connection = getConnectionAtPosition(x, y)
    if (connection) {
      onConnectionClick?.(connection.id)
      return
    }

    // Combined view spans multiple timelines; only support quick-add when unambiguous.
    if (isCtrlClick && onCanvasClick && combinedView?.members.length === 1) {
      onCanvasClick(coords, combinedView.members[0].timeline_id)
    }
  }

  const zoomFromCenter = (factor: number) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const minScale = calculateMinScale(rect.width)
    const maxScale = calculateMaxScale()
    const newScale = Math.max(minScale, Math.min(maxScale, scale * factor))
    const centerX = rect.width / 2
    const worldX = (centerX - offsetX) / scale
    const candidateOffsetX = centerX - worldX * newScale
    const clampedOffsetX = clampOffsetX(candidateOffsetX, rect.width, newScale)

    setScale(newScale)
    setOffsetX(clampedOffsetX)
  }

  return (
    <div ref={containerRef} className="w-full h-full overflow-hidden relative" data-testid="combined-timeline-container">
      <canvas
        ref={canvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleClick}
        className="w-full h-full cursor-grab active:cursor-grabbing"
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
      {/* Timeline legend */}
      {combinedView && combinedView.members.length > 0 && (
        <div className="absolute top-3 right-3 bg-white/95 border border-gray-200 rounded-lg shadow-sm px-3 py-2 pointer-events-none">
          {combinedView.members.map((member: CombinedViewMember) => {
            const color = timelineColorMap.get(member.timeline_id)
            return (
              <div key={member.timeline_id} className="flex items-center gap-2 py-0.5">
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: color?.dot || '#666' }}
                />
                <span className="text-xs font-sans text-gray-700 whitespace-nowrap">
                  {member.timeline.name}
                </span>
              </div>
            )
          })}
        </div>
      )}
      {/* Zoom controls */}
      <div className="absolute bottom-4 right-4 flex gap-2">
        <button
          onClick={() => zoomFromCenter(1.2)}
          className="px-3 py-2 bg-white border border-gray-200 rounded shadow-sm hover:bg-gray-50 text-sm"
          data-testid="zoom-in-button"
        >
          +
        </button>
        <button
          onClick={() => zoomFromCenter(0.8)}
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
