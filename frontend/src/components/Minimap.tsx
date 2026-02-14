'use client'

import { useRef, useEffect, useCallback, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { thinkersApi, API_URL } from '@/lib/api'
import { DEFAULT_START_YEAR, DEFAULT_END_YEAR, TIMELINE_PADDING, TIMELINE_CONTENT_WIDTH_PERCENT } from '@/lib/constants'
import type { Thinker, Timeline as TimelineType } from '@/types'

interface MinimapProps {
  scale: number
  offsetX: number
  offsetY: number
  canvasWidth: number
  canvasHeight: number
  onNavigate: (offsetX: number, offsetY: number) => void
  selectedTimeline?: TimelineType | null
  filterByTimelineId?: string | null
  thinkers?: Thinker[]
  timelines?: TimelineType[]
}

export function Minimap({
  scale,
  offsetX,
  offsetY,
  canvasWidth,
  canvasHeight,
  onNavigate,
  selectedTimeline,
  filterByTimelineId,
  thinkers: propThinkers,
  timelines: propTimelines,
}: MinimapProps) {
  const minimapRef = useRef<HTMLCanvasElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)

  const MINIMAP_WIDTH = 200
  const MINIMAP_HEIGHT = 80
  const PADDING = 4

  // Fetch data if not provided
  const { data: fetchedThinkers = [] } = useQuery({
    queryKey: ['thinkers', filterByTimelineId],
    queryFn: () => thinkersApi.getAll(),
    enabled: !propThinkers,
  })

  const thinkers = propThinkers || fetchedThinkers

  const { data: fetchedTimelines = [] } = useQuery({
    queryKey: ['timelines'],
    queryFn: async () => {
      const response = await fetch(`${API_URL}/api/timelines/`)
      return response.json()
    },
    enabled: !propTimelines,
  })

  const timelines = propTimelines || fetchedTimelines

  // Filter thinkers by timeline
  const filteredThinkers = filterByTimelineId
    ? thinkers.filter(t => t.timeline_id === filterByTimelineId)
    : thinkers

  // Calculate year range
  const calculateYearRange = useCallback(() => {
    let minYear = Infinity
    let maxYear = -Infinity
    let hasData = false

    filteredThinkers.forEach(t => {
      if (t.birth_year) {
        minYear = Math.min(minYear, t.birth_year)
        hasData = true
      }
      if (t.death_year) {
        maxYear = Math.max(maxYear, t.death_year)
        hasData = true
      }
    })

    timelines.forEach((timeline: TimelineType) => {
      if (timeline.start_year) {
        minYear = Math.min(minYear, timeline.start_year)
        hasData = true
      }
      if (timeline.end_year) {
        maxYear = Math.max(maxYear, timeline.end_year)
        hasData = true
      }
    })

    if (!hasData) {
      return { startYear: DEFAULT_START_YEAR, endYear: DEFAULT_END_YEAR }
    }

    if (minYear === Infinity) minYear = maxYear - 100
    if (maxYear === -Infinity) maxYear = minYear + 100

    const padding = Math.max(50, Math.floor((maxYear - minYear) * 0.1))
    return {
      startYear: Math.floor((minYear - padding) / 10) * 10,
      endYear: Math.ceil((maxYear + padding) / 10) * 10
    }
  }, [filteredThinkers, timelines])

  // Convert year to minimap X position
  const yearToMinimapX = useCallback((year: number): number => {
    let startYear, endYear
    if (selectedTimeline) {
      startYear = selectedTimeline.start_year || DEFAULT_START_YEAR
      endYear = selectedTimeline.end_year || DEFAULT_END_YEAR
    } else {
      const range = calculateYearRange()
      startYear = range.startYear
      endYear = range.endYear
    }

    const yearSpan = endYear - startYear
    return PADDING + ((year - startYear) / yearSpan) * (MINIMAP_WIDTH - PADDING * 2)
  }, [selectedTimeline, calculateYearRange])

  // Draw minimap
  useEffect(() => {
    const canvas = minimapRef.current
    if (!canvas || isCollapsed) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = MINIMAP_WIDTH * dpr
    canvas.height = MINIMAP_HEIGHT * dpr
    ctx.scale(dpr, dpr)

    // Background
    ctx.fillStyle = '#FAFAF8'
    ctx.fillRect(0, 0, MINIMAP_WIDTH, MINIMAP_HEIGHT)

    // Border
    ctx.strokeStyle = '#E0E0E0'
    ctx.lineWidth = 1
    ctx.strokeRect(0, 0, MINIMAP_WIDTH, MINIMAP_HEIGHT)

    // Timeline line
    ctx.strokeStyle = '#CCCCCC'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(PADDING, MINIMAP_HEIGHT / 2)
    ctx.lineTo(MINIMAP_WIDTH - PADDING, MINIMAP_HEIGHT / 2)
    ctx.stroke()

    // Calculate year range for the main timeline
    let startYear, endYear
    if (selectedTimeline) {
      startYear = selectedTimeline.start_year || DEFAULT_START_YEAR
      endYear = selectedTimeline.end_year || DEFAULT_END_YEAR
    } else {
      const range = calculateYearRange()
      startYear = range.startYear
      endYear = range.endYear
    }

    // Draw thinkers as small dots
    filteredThinkers.forEach(thinker => {
      const thinkerYear = thinker.death_year || thinker.birth_year
      if (!thinkerYear) return

      const x = yearToMinimapX(thinkerYear)
      const y = MINIMAP_HEIGHT / 2 - 10

      ctx.fillStyle = '#8B4513'
      ctx.beginPath()
      ctx.arc(x, y, 2, 0, Math.PI * 2)
      ctx.fill()
    })

    // Draw year labels
    ctx.fillStyle = '#999999'
    ctx.font = '8px monospace'
    ctx.textAlign = 'left'
    ctx.fillText(startYear.toString(), PADDING, MINIMAP_HEIGHT - 4)
    ctx.textAlign = 'right'
    ctx.fillText(endYear.toString(), MINIMAP_WIDTH - PADDING, MINIMAP_HEIGHT - 4)

    // Calculate viewport rectangle
    const yearSpan = endYear - startYear
    const pixelsPerYear = ((canvasWidth * TIMELINE_CONTENT_WIDTH_PERCENT) / yearSpan)
    const timelineBaseWidth = yearSpan * pixelsPerYear

    // Viewport width in minimap coordinates
    const viewportWidth = Math.min(
      MINIMAP_WIDTH - PADDING * 2,
      ((MINIMAP_WIDTH - PADDING * 2) * canvasWidth) / (timelineBaseWidth * scale)
    )

    // Viewport position based on offsetX
    // Convert offsetX (in screen pixels) to a position in the minimap
    const viewportX = PADDING + ((-offsetX / scale) / timelineBaseWidth) * (MINIMAP_WIDTH - PADDING * 2)

    // Draw viewport rectangle
    ctx.strokeStyle = '#0284C7'
    ctx.lineWidth = 2
    ctx.fillStyle = 'rgba(2, 132, 199, 0.1)'

    const viewportRect = {
      x: Math.max(PADDING, Math.min(MINIMAP_WIDTH - PADDING - viewportWidth, viewportX)),
      y: 4,
      width: viewportWidth,
      height: MINIMAP_HEIGHT - 8
    }

    ctx.fillRect(viewportRect.x, viewportRect.y, viewportRect.width, viewportRect.height)
    ctx.strokeRect(viewportRect.x, viewportRect.y, viewportRect.width, viewportRect.height)

  }, [scale, offsetX, offsetY, canvasWidth, canvasHeight, filteredThinkers, selectedTimeline, calculateYearRange, yearToMinimapX, isCollapsed])

  // Handle click on minimap to navigate
  const handleMinimapClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = minimapRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const clickX = e.clientX - rect.left

    // Calculate year range
    let startYear, endYear
    if (selectedTimeline) {
      startYear = selectedTimeline.start_year || DEFAULT_START_YEAR
      endYear = selectedTimeline.end_year || DEFAULT_END_YEAR
    } else {
      const range = calculateYearRange()
      startYear = range.startYear
      endYear = range.endYear
    }

    const yearSpan = endYear - startYear
    const pixelsPerYear = ((canvasWidth * TIMELINE_CONTENT_WIDTH_PERCENT) / yearSpan)
    const timelineBaseWidth = yearSpan * pixelsPerYear

    // Convert click position to offset
    const clickPercent = (clickX - PADDING) / (MINIMAP_WIDTH - PADDING * 2)
    const targetOffset = -clickPercent * timelineBaseWidth * scale + canvasWidth / 2

    onNavigate(targetOffset, offsetY)
  }, [selectedTimeline, calculateYearRange, canvasWidth, scale, offsetY, onNavigate])

  // Handle drag on minimap
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true)
    handleMinimapClick(e)
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging) return
    handleMinimapClick(e)
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  if (isCollapsed) {
    return (
      <button
        onClick={() => setIsCollapsed(false)}
        className="absolute bottom-20 left-4 bg-white border border-gray-200 rounded-lg shadow-sm px-2 py-1 text-xs font-sans hover:bg-gray-50"
      >
        Show Minimap
      </button>
    )
  }

  return (
    <div className="absolute bottom-20 left-4 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-2 py-1 bg-gray-50 border-b border-gray-200">
        <span className="text-xs font-sans text-gray-600">Overview</span>
        <button
          onClick={() => setIsCollapsed(true)}
          className="text-gray-400 hover:text-gray-600 text-xs"
          title="Hide minimap"
        >
          ×
        </button>
      </div>
      <canvas
        ref={minimapRef}
        width={MINIMAP_WIDTH}
        height={MINIMAP_HEIGHT}
        style={{ width: MINIMAP_WIDTH, height: MINIMAP_HEIGHT }}
        className="cursor-pointer"
        onClick={handleMinimapClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />
    </div>
  )
}
