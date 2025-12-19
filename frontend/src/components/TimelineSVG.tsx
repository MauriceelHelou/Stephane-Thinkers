'use client'

import { useQuery } from '@tanstack/react-query'
import { thinkersApi, connectionsApi, timelineEventsApi } from '@/lib/api'
import { useRef, useState, useEffect, useMemo, useCallback } from 'react'
import { DEFAULT_START_YEAR, DEFAULT_END_YEAR, TIMELINE_PADDING, TIMELINE_CONTENT_WIDTH_PERCENT } from '@/lib/constants'
import type { Thinker, Connection, Timeline as TimelineType, TimelineEvent } from '@/types'

interface TimelineSVGProps {
  onThinkerClick?: (thinkerId: string) => void
  onCanvasClick?: (position: { x: number; y: number }) => void
  onConnectionClick?: (connectionId: string) => void
  selectedThinkerId?: string | null
  filterByTimelineId?: string | null
  selectedTimeline?: TimelineType | null
}

export function TimelineSVG({
  onThinkerClick,
  onCanvasClick,
  onConnectionClick,
  selectedThinkerId,
  filterByTimelineId,
  selectedTimeline
}: TimelineSVGProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [offsetX, setOffsetX] = useState(0)
  const [offsetY, setOffsetY] = useState(0)
  const [isPanning, setIsPanning] = useState(false)
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 })
  const [containerSize, setContainerSize] = useState({ width: 1200, height: 600 })

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

  // Resize observer for container
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height
        })
      }
    })

    resizeObserver.observe(container)
    return () => resizeObserver.disconnect()
  }, [])

  // Helper to get positioning year for a thinker
  const getThinkerYear = useCallback((thinker: Thinker): number | null => {
    if (thinker.death_year) return thinker.death_year
    if (thinker.birth_year) {
      const currentYear = new Date().getFullYear()
      return Math.floor((thinker.birth_year + currentYear) / 2)
    }
    return null
  }, [])

  // Calculate year range
  const yearRange = useMemo(() => {
    if (selectedTimeline) {
      return {
        startYear: selectedTimeline.start_year || DEFAULT_START_YEAR,
        endYear: selectedTimeline.end_year || DEFAULT_END_YEAR
      }
    }

    let minYear = Infinity
    let maxYear = -Infinity
    let hasData = false

    thinkers.forEach(t => {
      if (t.birth_year) { minYear = Math.min(minYear, t.birth_year); hasData = true }
      if (t.death_year) { maxYear = Math.max(maxYear, t.death_year); hasData = true }
    })

    timelines.forEach((timeline: { start_year?: number; end_year?: number }) => {
      if (timeline.start_year) { minYear = Math.min(minYear, timeline.start_year); hasData = true }
      if (timeline.end_year) { maxYear = Math.max(maxYear, timeline.end_year); hasData = true }
    })

    if (!hasData) return { startYear: DEFAULT_START_YEAR, endYear: DEFAULT_END_YEAR }
    if (minYear === Infinity) minYear = maxYear - 100
    if (maxYear === -Infinity) maxYear = minYear + 100

    const padding = Math.max(50, Math.floor((maxYear - minYear) * 0.1))
    return {
      startYear: Math.floor((minYear - padding) / 10) * 10,
      endYear: Math.ceil((maxYear + padding) / 10) * 10
    }
  }, [selectedTimeline, thinkers, timelines])

  // Convert year to X position
  const yearToX = useCallback((year: number): number => {
    const { startYear, endYear } = yearRange
    const yearSpan = endYear - startYear
    const contentWidth = containerSize.width * TIMELINE_CONTENT_WIDTH_PERCENT
    const pixelsPerYear = contentWidth / yearSpan
    return TIMELINE_PADDING + (year - startYear) * pixelsPerYear
  }, [yearRange, containerSize.width])

  // Filter thinkers
  const filteredThinkers = useMemo(() => {
    return filterByTimelineId
      ? thinkers.filter((t) => t.timeline_id === filterByTimelineId)
      : thinkers
  }, [thinkers, filterByTimelineId])

  // Filter connections
  const visibleThinkerIds = useMemo(() => new Set(filteredThinkers.map(t => t.id)), [filteredThinkers])
  const filteredConnections = useMemo(() => {
    return connections.filter(c =>
      visibleThinkerIds.has(c.from_thinker_id) && visibleThinkerIds.has(c.to_thinker_id)
    )
  }, [connections, visibleThinkerIds])

  // Calculate thinker positions with collision detection
  const thinkerPositions = useMemo(() => {
    const positions = new Map<string, { x: number; y: number; width: number; height: number }>()
    const centerY = containerSize.height / 2
    const placed: { x: number; y: number; width: number; height: number }[] = []

    // Sort by x position
    const thinkersWithX = filteredThinkers
      .map(t => ({ thinker: t, x: getThinkerYear(t) ? yearToX(getThinkerYear(t)!) : containerSize.width / 2 }))
      .sort((a, b) => a.x - b.x)

    const horizontalMargin = Math.max(5, 15 / scale)
    const verticalSpacing = Math.max(4, 8 / Math.sqrt(scale))
    const elevationOffset = -60

    thinkersWithX.forEach(({ thinker, x }) => {
      const width = thinker.name.length * 8 + 16 // Approximate width
      const height = 24
      let y = centerY + elevationOffset
      let foundPosition = false
      let attempts = 0

      while (!foundPosition && attempts < 30) {
        foundPosition = true
        for (const existing of placed) {
          const horizontalOverlap = Math.abs(x - existing.x) < (width + existing.width) / 2 + horizontalMargin
          if (horizontalOverlap) {
            const verticalOverlap = Math.abs(y - existing.y) < (height + existing.height) / 2 + verticalSpacing
            if (verticalOverlap) {
              y = attempts % 2 === 0
                ? existing.y - existing.height / 2 - height / 2 - verticalSpacing
                : existing.y + existing.height / 2 + height / 2 + verticalSpacing
              foundPosition = false
              break
            }
          }
        }
        attempts++
      }

      placed.push({ x, y, width, height })
      positions.set(thinker.id, { x, y, width, height })
    })

    return positions
  }, [filteredThinkers, getThinkerYear, yearToX, containerSize.height, scale])

  // Calculate year tick intervals for granular display
  const yearTicks = useMemo(() => {
    const { startYear, endYear } = yearRange
    const yearSpan = endYear - startYear
    const contentWidth = containerSize.width * TIMELINE_CONTENT_WIDTH_PERCENT * scale
    const pixelsPerYear = contentWidth / yearSpan

    // Determine major and minor tick intervals based on zoom
    const minMajorSpacing = 80
    const minMinorSpacing = 20
    const minMajorInterval = minMajorSpacing / pixelsPerYear

    const majorIntervals = [0.25, 0.5, 1, 2, 5, 10, 20, 25, 50, 100, 200, 500, 1000]
    let majorInterval = majorIntervals.find(i => i >= minMajorInterval) || 1000

    // Minor interval is 1/4 of major (for quarter ticks)
    const minorInterval = majorInterval / 4

    const ticks: { year: number; isMajor: boolean }[] = []

    // Generate ticks
    const tickStart = Math.floor(startYear / minorInterval) * minorInterval
    for (let year = tickStart; year <= endYear; year += minorInterval) {
      if (year >= startYear) {
        const isMajor = Math.abs(year % majorInterval) < 0.001 || Math.abs(year % majorInterval - majorInterval) < 0.001
        ticks.push({ year, isMajor })
      }
    }

    return { ticks, majorInterval, minorInterval }
  }, [yearRange, containerSize.width, scale])

  // Event handlers
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()

    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return

    const mouseX = e.clientX - rect.left
    const oldScale = scale
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    const newScale = Math.max(0.1, Math.min(50, oldScale * delta))

    // Zoom toward mouse position
    const worldX = (mouseX - offsetX) / oldScale
    const newOffsetX = mouseX - worldX * newScale

    setScale(newScale)
    setOffsetX(newOffsetX)
  }, [scale, offsetX])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0 && !e.ctrlKey && !e.metaKey) {
      setIsPanning(true)
      setLastMousePos({ x: e.clientX, y: e.clientY })
    }
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning) return
    const dx = e.clientX - lastMousePos.x
    const dy = e.clientY - lastMousePos.y
    setOffsetX(prev => prev + dx)
    setOffsetY(prev => prev + dy)
    setLastMousePos({ x: e.clientX, y: e.clientY })
  }, [isPanning, lastMousePos])

  const handleMouseUp = useCallback(() => setIsPanning(false), [])

  const handleThinkerClick = useCallback((thinkerId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    onThinkerClick?.(thinkerId)
  }, [onThinkerClick])

  const handleSvgClick = useCallback((e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      const rect = containerRef.current?.getBoundingClientRect()
      if (rect && onCanvasClick) {
        const x = (e.clientX - rect.left - offsetX) / scale
        const y = (e.clientY - rect.top - offsetY) / scale
        onCanvasClick({ x, y })
      }
    }
  }, [offsetX, offsetY, scale, onCanvasClick])

  if (thinkersLoading || connectionsLoading || eventsLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-secondary">Loading timeline...</p>
      </div>
    )
  }

  const { width, height } = containerSize
  const centerY = height / 2

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden">
      <svg
        width={width}
        height={height}
        className="cursor-grab active:cursor-grabbing"
        style={{ touchAction: 'none' }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleSvgClick}
      >
        <defs>
          {/* Arrow marker for connections */}
          <marker
            id="arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#666" />
          </marker>
        </defs>

        {/* Transform group for pan/zoom */}
        <g transform={`translate(${offsetX}, ${offsetY}) scale(${scale}, 1)`}>
          {/* Grid lines */}
          <g className="grid">
            {yearTicks.ticks.map(({ year, isMajor }) => {
              const x = yearToX(year)
              return (
                <line
                  key={`grid-${year}`}
                  x1={x}
                  y1={0}
                  x2={x}
                  y2={height / scale}
                  stroke={isMajor ? '#e5e7eb' : '#f3f4f6'}
                  strokeWidth={1 / scale}
                />
              )
            })}
          </g>

          {/* Timeline axis */}
          <line
            x1={TIMELINE_PADDING}
            y1={centerY / scale}
            x2={yearToX(yearRange.endYear)}
            y2={centerY / scale}
            stroke="#d1d5db"
            strokeWidth={2 / scale}
          />

          {/* Year labels and tick marks */}
          <g className="year-labels">
            {yearTicks.ticks.map(({ year, isMajor }) => {
              const x = yearToX(year)
              return (
                <g key={`tick-${year}`}>
                  <line
                    x1={x}
                    y1={(centerY - (isMajor ? 10 : 5)) / scale}
                    x2={x}
                    y2={(centerY + (isMajor ? 10 : 5)) / scale}
                    stroke={isMajor ? '#9ca3af' : '#d1d5db'}
                    strokeWidth={1 / scale}
                  />
                  {isMajor && (
                    <text
                      x={x}
                      y={(centerY + 30) / scale}
                      textAnchor="middle"
                      fontSize={12 / scale}
                      fontFamily="JetBrains Mono, monospace"
                      fill="#6b7280"
                    >
                      {Number.isInteger(year) ? year : year.toFixed(2)}
                    </text>
                  )}
                </g>
              )
            })}
          </g>

          {/* Timeline events */}
          <g className="events">
            {timelineEvents.map((event) => {
              const x = yearToX(event.year)
              const y = (centerY - 50) / scale

              const symbolPaths: Record<string, string> = {
                council: 'M 0 -8 L 8 8 L -8 8 Z',
                publication: 'M -8 -8 L 8 -8 L 8 8 L -8 8 Z',
                war: 'M 0 -8 L 8 0 L 0 8 L -8 0 Z',
                invention: 'M 0 -10 L 2 -3 L 10 -3 L 4 2 L 6 10 L 0 5 L -6 10 L -4 2 L -10 -3 L -2 -3 Z',
                cultural: 'M 0 0 m -8 0 a 8 8 0 1 0 16 0 a 8 8 0 1 0 -16 0',
                political: 'M -6 -6 L 6 -6 L 6 6 L -6 6 Z',
                other: 'M 0 0 m -6 0 a 6 6 0 1 0 12 0 a 6 6 0 1 0 -12 0'
              }
              const symbol = symbolPaths[event.event_type] || symbolPaths.other

              return (
                <g key={event.id} transform={`translate(${x}, ${y}) scale(${1/scale})`}>
                  <path
                    d={symbol}
                    fill="#8B4513"
                    stroke="#6B3410"
                    strokeWidth="1"
                  />
                  <text
                    y={-15}
                    textAnchor="middle"
                    fontSize="10"
                    fontFamily="Inter, sans-serif"
                    fill="#374151"
                  >
                    {event.name.length > 15 ? event.name.slice(0, 12) + '...' : event.name}
                  </text>
                </g>
              )
            })}
          </g>

          {/* Connections */}
          <g className="connections">
            {filteredConnections.map((conn) => {
              const fromPos = thinkerPositions.get(conn.from_thinker_id)
              const toPos = thinkerPositions.get(conn.to_thinker_id)
              if (!fromPos || !toPos) return null

              const fromX = fromPos.x
              const fromY = (fromPos.y + fromPos.height / 2) / scale
              const toX = toPos.x
              const toY = (toPos.y + toPos.height / 2) / scale

              const midY = Math.max(fromY, toY) + 30 / scale

              return (
                <g key={conn.id}>
                  <path
                    d={`M ${fromX} ${fromY} C ${fromX} ${midY} ${toX} ${midY} ${toX} ${toY}`}
                    fill="none"
                    stroke="rgba(100, 100, 100, 0.5)"
                    strokeWidth={1 / scale}
                    markerEnd="url(#arrow)"
                    className="cursor-pointer hover:stroke-blue-500"
                    onClick={(e) => {
                      e.stopPropagation()
                      onConnectionClick?.(conn.id)
                    }}
                  />
                  {conn.name && (
                    <text
                      x={(fromX + toX) / 2}
                      y={midY - 5 / scale}
                      textAnchor="middle"
                      fontSize={10 / scale}
                      fontFamily="Inter, sans-serif"
                      fill="#666"
                    >
                      {conn.name}
                    </text>
                  )}
                </g>
              )
            })}
          </g>

          {/* Thinkers */}
          <g className="thinkers">
            {filteredThinkers.map((thinker) => {
              const pos = thinkerPositions.get(thinker.id)
              if (!pos) return null

              const { x, y, width: boxWidth, height: boxHeight } = pos
              const isSelected = thinker.id === selectedThinkerId

              return (
                <g
                  key={thinker.id}
                  transform={`translate(${x}, ${y / scale})`}
                  className="cursor-pointer"
                  onClick={(e) => handleThinkerClick(thinker.id, e)}
                >
                  <rect
                    x={-boxWidth / 2}
                    y={-boxHeight / 2 / scale}
                    width={boxWidth}
                    height={boxHeight / scale}
                    fill={isSelected ? '#8B4513' : '#ffffff'}
                    stroke={isSelected ? '#6B3410' : '#d1d5db'}
                    strokeWidth={isSelected ? 2 / scale : 1 / scale}
                    rx={2 / scale}
                  />
                  <text
                    y={4 / scale}
                    textAnchor="middle"
                    fontSize={14 / scale}
                    fontFamily="Crimson Text, serif"
                    fill={isSelected ? '#ffffff' : '#1f2937'}
                  >
                    {thinker.name}
                  </text>
                </g>
              )
            })}
          </g>
        </g>

        {/* Empty state */}
        {filteredThinkers.length === 0 && (
          <g>
            <text x={width / 2} y={height / 2 - 10} textAnchor="middle" fontSize="16" fill="#666">
              Cmd/Ctrl+Click to add your first thinker
            </text>
            <text x={width / 2} y={height / 2 + 15} textAnchor="middle" fontSize="14" fill="#999">
              Double-click thinkers to edit
            </text>
          </g>
        )}
      </svg>

      {/* Zoom controls */}
      <div className="absolute bottom-4 right-4 flex gap-2">
        <button
          onClick={() => setScale(prev => Math.min(50, prev * 1.2))}
          className="px-3 py-2 bg-white border border-timeline rounded shadow-sm hover:bg-gray-50 font-sans text-sm"
        >
          Zoom In
        </button>
        <button
          onClick={() => setScale(prev => Math.max(0.1, prev * 0.8))}
          className="px-3 py-2 bg-white border border-timeline rounded shadow-sm hover:bg-gray-50 font-sans text-sm"
        >
          Zoom Out
        </button>
        <button
          onClick={() => { setScale(1); setOffsetX(0); setOffsetY(0) }}
          className="px-3 py-2 bg-white border border-timeline rounded shadow-sm hover:bg-gray-50 font-sans text-sm"
        >
          Reset
        </button>
      </div>
    </div>
  )
}
