'use client'

import { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { thinkersApi, connectionsApi, timelineEventsApi, timelinesApi } from '@/lib/api'
import { Modal, ModalFooter, ModalButton } from '@/components/Modal'
import { TIMELINE_PADDING, TIMELINE_CONTENT_WIDTH_PERCENT, DEFAULT_START_YEAR, DEFAULT_END_YEAR } from '@/lib/constants'
import type { Timeline, Thinker, Connection, TimelineEvent } from '@/types'

interface ExportModalProps {
  isOpen: boolean
  onClose: () => void
  selectedTimelineId?: string | null
  selectedTimeline?: Timeline | null
}

type ExportFormat = 'png' | 'svg'

export function ExportModal({ isOpen, onClose, selectedTimelineId, selectedTimeline }: ExportModalProps) {
  const [format, setFormat] = useState<ExportFormat>('png')
  const [width, setWidth] = useState(1920)
  const [height, setHeight] = useState(1080)
  const [includeConnections, setIncludeConnections] = useState(true)
  const [includeEvents, setIncludeEvents] = useState(true)
  const [isExporting, setIsExporting] = useState(false)
  const previewCanvasRef = useRef<HTMLCanvasElement>(null)

  const { data: thinkers = [] } = useQuery({
    queryKey: ['thinkers'],
    queryFn: () => thinkersApi.getAll(),
    enabled: isOpen,
  })

  const { data: connections = [] } = useQuery({
    queryKey: ['connections'],
    queryFn: connectionsApi.getAll,
    enabled: isOpen && includeConnections,
  })

  const { data: timelineEvents = [] } = useQuery({
    queryKey: ['timeline-events', selectedTimelineId],
    queryFn: () => timelineEventsApi.getAll(selectedTimelineId || undefined),
    enabled: isOpen && includeEvents,
  })

  const { data: timelines = [] } = useQuery({
    queryKey: ['timelines'],
    queryFn: timelinesApi.getAll,
    enabled: isOpen,
  })

  // Filter thinkers by timeline
  const filteredThinkers: Thinker[] = selectedTimelineId
    ? thinkers.filter((t: Thinker) => t.timeline_id === selectedTimelineId)
    : thinkers

  // Filter connections to visible thinkers
  const visibleThinkerIds = new Set(filteredThinkers.map((t: Thinker) => t.id))
  const filteredConnections = connections.filter(
    (c) => visibleThinkerIds.has(c.from_thinker_id) && visibleThinkerIds.has(c.to_thinker_id)
  )

  // Calculate year range
  const calculateYearRange = () => {
    if (selectedTimeline) {
      return {
        startYear: selectedTimeline.start_year || DEFAULT_START_YEAR,
        endYear: selectedTimeline.end_year || DEFAULT_END_YEAR,
      }
    }

    let minYear = Infinity
    let maxYear = -Infinity
    let hasData = false

    thinkers.forEach((t: Thinker) => {
      if (t.birth_year) {
        minYear = Math.min(minYear, t.birth_year)
        hasData = true
      }
      if (t.death_year) {
        maxYear = Math.max(maxYear, t.death_year)
        hasData = true
      }
    })

    timelines.forEach((timeline: Timeline) => {
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
      endYear: Math.ceil((maxYear + padding) / 10) * 10,
    }
  }

  const { startYear, endYear } = calculateYearRange()

  const yearToX = (year: number, canvasWidth: number): number => {
    const yearSpan = endYear - startYear
    const pixelsPerYear = (canvasWidth * TIMELINE_CONTENT_WIDTH_PERCENT) / yearSpan
    return TIMELINE_PADDING + (year - startYear) * pixelsPerYear
  }

  const getThinkerYear = (thinker: Thinker): number | null => {
    // If both birth and death years are available, use the midpoint
    if (thinker.birth_year && thinker.death_year) {
      return Math.round((thinker.birth_year + thinker.death_year) / 2)
    }
    if (thinker.death_year) return thinker.death_year
    if (thinker.birth_year) return thinker.birth_year
    return null
  }

  // Calculate thinker positions with collision detection
  const calculateThinkerPositions = (
    thinkers: Thinker[],
    canvasWidth: number,
    canvasHeight: number
  ): Map<string, { x: number; y: number; width: number; height: number }> => {
    const positions = new Map<string, { x: number; y: number; width: number; height: number }>()
    const centerY = canvasHeight / 2

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) return positions

    const thinkerData: { id: string; x: number; baseY: number; width: number; height: number }[] = []

    thinkers.forEach((thinker) => {
      const thinkerYear = getThinkerYear(thinker)
      const x = thinkerYear
        ? yearToX(thinkerYear, canvasWidth)
        : thinker.position_x || canvasWidth / 2

      ctx.font = '14px "Crimson Text", serif'
      const metrics = ctx.measureText(thinker.name)
      const padding = 8
      const bgWidth = metrics.width + padding * 2
      const bgHeight = 24

      // position_y is stored as an offset from the timeline axis (0 = on the timeline)
      const yOffset = thinker.position_y || 0
      thinkerData.push({
        id: thinker.id,
        x,
        baseY: centerY + yOffset,
        width: bgWidth,
        height: bgHeight,
      })
    })

    thinkerData.sort((a, b) => a.x - b.x)

    const horizontalMargin = 15
    const verticalSpacing = 8
    const elevationOffset = -20

    const placed: { x: number; y: number; width: number; height: number; id: string }[] = []

    thinkerData.forEach((thinker) => {
      let y = thinker.baseY + elevationOffset
      let foundPosition = false
      let attempts = 0
      const maxAttempts = 30

      while (!foundPosition && attempts < maxAttempts) {
        foundPosition = true

        for (const existing of placed) {
          const horizontalOverlap =
            Math.abs(thinker.x - existing.x) < (thinker.width + existing.width) / 2 + horizontalMargin

          if (horizontalOverlap) {
            const verticalOverlap =
              Math.abs(y - existing.y) < (thinker.height + existing.height) / 2 + verticalSpacing

            if (verticalOverlap) {
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

  const drawTimeline = (ctx: CanvasRenderingContext2D, canvasWidth: number, canvasHeight: number) => {
    const centerY = canvasHeight / 2

    // Background
    ctx.fillStyle = '#FAFAF8'
    ctx.fillRect(0, 0, canvasWidth, canvasHeight)

    // Grid
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

    // Timeline line
    ctx.strokeStyle = '#E0E0E0'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(0, centerY)
    ctx.lineTo(canvasWidth, centerY)
    ctx.stroke()

    // Year labels
    ctx.fillStyle = '#666666'
    ctx.font = '12px "JetBrains Mono", monospace'
    ctx.textAlign = 'center'

    const yearSpan = endYear - startYear
    const interval = yearSpan > 500 ? 100 : yearSpan > 200 ? 50 : yearSpan > 100 ? 25 : 10

    for (let year = Math.ceil(startYear / interval) * interval; year <= endYear; year += interval) {
      const x = yearToX(year, canvasWidth)
      ctx.fillText(year.toString(), x, centerY + 30)

      ctx.strokeStyle = '#CCCCCC'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x, centerY - 10)
      ctx.lineTo(x, centerY + 10)
      ctx.stroke()
    }
  }

  const drawConnections = (
    ctx: CanvasRenderingContext2D,
    connections: Connection[],
    positions: Map<string, { x: number; y: number; width: number; height: number }>
  ) => {
    connections.forEach((conn) => {
      const fromPos = positions.get(conn.from_thinker_id)
      const toPos = positions.get(conn.to_thinker_id)
      if (!fromPos || !toPos) return

      const fromX = fromPos.x
      const fromY = fromPos.y + fromPos.height / 2
      const toX = toPos.x
      const toY = toPos.y + toPos.height / 2

      const strength = conn.strength || 3
      const opacity = 0.5 + (strength / 5) * 0.3

      ctx.strokeStyle = `rgba(100, 100, 100, ${opacity})`
      ctx.lineWidth = 1

      ctx.beginPath()
      ctx.moveTo(fromX, fromY)

      const midY = Math.max(fromY, toY) + 30
      ctx.bezierCurveTo(fromX, midY, toX, midY, toX, toY)
      ctx.stroke()

      // Arrow
      const arrowSize = 6
      const angle = Math.atan2(toY - midY, toX - toX)
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
      ctx.fillStyle = `rgba(100, 100, 100, ${opacity})`
      ctx.fill()

      // Connection name
      if (conn.name) {
        const t = 0.5
        const curveX =
          Math.pow(1 - t, 3) * fromX +
          3 * Math.pow(1 - t, 2) * t * fromX +
          3 * (1 - t) * Math.pow(t, 2) * toX +
          Math.pow(t, 3) * toX

        const curveY =
          Math.pow(1 - t, 3) * fromY +
          3 * Math.pow(1 - t, 2) * t * midY +
          3 * (1 - t) * Math.pow(t, 2) * midY +
          Math.pow(t, 3) * toY

        ctx.font = '10px "Inter", sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'

        const text = conn.name
        const metrics = ctx.measureText(text)
        const bgWidth = metrics.width + 8
        const bgHeight = 14
        const labelY = curveY - 8

        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
        ctx.fillRect(curveX - bgWidth / 2, labelY - bgHeight / 2, bgWidth, bgHeight)

        ctx.fillStyle = '#666666'
        ctx.fillText(text, curveX, labelY)
      }
    })
  }

  const drawThinkers = (
    ctx: CanvasRenderingContext2D,
    thinkers: Thinker[],
    positions: Map<string, { x: number; y: number; width: number; height: number }>
  ) => {
    thinkers.forEach((thinker) => {
      const pos = positions.get(thinker.id)
      if (!pos) return

      const { x, y, width: bgWidth, height: bgHeight } = pos

      ctx.font = '14px "Crimson Text", serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      ctx.fillStyle = '#FFFFFF'
      ctx.strokeStyle = '#CCCCCC'
      ctx.lineWidth = 1

      ctx.fillRect(x - bgWidth / 2, y - bgHeight / 2, bgWidth, bgHeight)
      ctx.strokeRect(x - bgWidth / 2, y - bgHeight / 2, bgWidth, bgHeight)

      ctx.fillStyle = '#1A1A1A'
      ctx.fillText(thinker.name, x, y)
    })
  }

  const drawTimelineEvents = (
    ctx: CanvasRenderingContext2D,
    events: TimelineEvent[],
    canvasWidth: number,
    canvasHeight: number
  ) => {
    const centerY = canvasHeight / 2

    events.forEach((event) => {
      const x = yearToX(event.year, canvasWidth)
      const y = centerY - 40

      ctx.fillStyle = '#8B4513'
      ctx.strokeStyle = '#6B3410'
      ctx.lineWidth = 2

      const size = 8

      // Circle for all events
      ctx.beginPath()
      ctx.arc(x, y, size, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()

      // Event label
      ctx.fillStyle = '#333333'
      ctx.font = '10px "JetBrains Mono", monospace'
      ctx.textAlign = 'center'
      ctx.fillText(event.name, x, y - size - 5)
    })
  }

  const exportToPNG = async () => {
    setIsExporting(true)

    try {
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')

      if (!ctx) {
        throw new Error('Could not create canvas context')
      }

      const positions = calculateThinkerPositions(filteredThinkers, width, height)

      drawTimeline(ctx, width, height)

      if (includeEvents && timelineEvents.length > 0) {
        drawTimelineEvents(ctx, timelineEvents, width, height)
      }

      if (includeConnections && filteredConnections.length > 0) {
        drawConnections(ctx, filteredConnections, positions)
      }

      drawThinkers(ctx, filteredThinkers, positions)

      // Download
      const dataUrl = canvas.toDataURL('image/png')
      const link = document.createElement('a')
      link.download = `intellectual-genealogy-${selectedTimeline?.name || 'all'}-${Date.now()}.png`
      link.href = dataUrl
      link.click()

      onClose()
    } catch (error) {
      console.error('Export failed:', error)
      alert('Export failed. Please try again.')
    } finally {
      setIsExporting(false)
    }
  }

  const exportToSVG = async () => {
    setIsExporting(true)

    try {
      const positions = calculateThinkerPositions(filteredThinkers, width, height)
      const centerY = height / 2
      const yearSpan = endYear - startYear
      const interval = yearSpan > 500 ? 100 : yearSpan > 200 ? 50 : yearSpan > 100 ? 25 : 10

      let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Crimson+Text&family=Inter&family=JetBrains+Mono');
      .thinker-name { font-family: "Crimson Text", serif; font-size: 14px; }
      .year-label { font-family: "JetBrains Mono", monospace; font-size: 12px; fill: #666666; }
      .event-label { font-family: "JetBrains Mono", monospace; font-size: 10px; fill: #333333; }
      .connection-label { font-family: "Inter", sans-serif; font-size: 10px; fill: #666666; }
    </style>
  </defs>

  <!-- Background -->
  <rect width="${width}" height="${height}" fill="#FAFAF8"/>

  <!-- Grid -->
  <g stroke="#F0F0F0" stroke-width="1">
${Array.from({ length: Math.ceil(width / 50) + 1 }, (_, i) => `    <line x1="${i * 50}" y1="0" x2="${i * 50}" y2="${height}"/>`).join('\n')}
${Array.from({ length: Math.ceil(height / 50) + 1 }, (_, i) => `    <line x1="0" y1="${i * 50}" x2="${width}" y2="${i * 50}"/>`).join('\n')}
  </g>

  <!-- Timeline Line -->
  <line x1="0" y1="${centerY}" x2="${width}" y2="${centerY}" stroke="#E0E0E0" stroke-width="2"/>

  <!-- Year Labels -->
  <g text-anchor="middle">
${Array.from({ length: Math.floor((endYear - startYear) / interval) + 1 }, (_, i) => {
  const year = Math.ceil(startYear / interval) * interval + i * interval
  if (year > endYear) return ''
  const x = yearToX(year, width)
  return `    <text x="${x}" y="${centerY + 30}" class="year-label">${year}</text>
    <line x1="${x}" y1="${centerY - 10}" x2="${x}" y2="${centerY + 10}" stroke="#CCCCCC" stroke-width="1"/>`
}).filter(Boolean).join('\n')}
  </g>
`

      // Events
      if (includeEvents && timelineEvents.length > 0) {
        svg += `
  <!-- Timeline Events -->
  <g>
${timelineEvents.map((event) => {
  const x = yearToX(event.year, width)
  const y = centerY - 40
  return `    <circle cx="${x}" cy="${y}" r="8" fill="#8B4513" stroke="#6B3410" stroke-width="2"/>
    <text x="${x}" y="${y - 13}" text-anchor="middle" class="event-label">${event.name}</text>`
}).join('\n')}
  </g>
`
      }

      // Connections
      if (includeConnections && filteredConnections.length > 0) {
        svg += `
  <!-- Connections -->
  <g>
${filteredConnections.map((conn) => {
  const fromPos = positions.get(conn.from_thinker_id)
  const toPos = positions.get(conn.to_thinker_id)
  if (!fromPos || !toPos) return ''

  const fromX = fromPos.x
  const fromY = fromPos.y + fromPos.height / 2
  const toX = toPos.x
  const toY = toPos.y + toPos.height / 2
  const midY = Math.max(fromY, toY) + 30

  const strength = conn.strength || 3
  const opacity = 0.5 + (strength / 5) * 0.3

  let result = `    <path d="M ${fromX} ${fromY} C ${fromX} ${midY}, ${toX} ${midY}, ${toX} ${toY}" fill="none" stroke="rgba(100,100,100,${opacity})" stroke-width="1"/>`

  if (conn.name) {
    const t = 0.5
    const curveX = Math.pow(1-t,3)*fromX + 3*Math.pow(1-t,2)*t*fromX + 3*(1-t)*Math.pow(t,2)*toX + Math.pow(t,3)*toX
    const curveY = Math.pow(1-t,3)*fromY + 3*Math.pow(1-t,2)*t*midY + 3*(1-t)*Math.pow(t,2)*midY + Math.pow(t,3)*toY - 8
    result += `
    <text x="${curveX}" y="${curveY}" text-anchor="middle" class="connection-label">${conn.name}</text>`
  }

  return result
}).filter(Boolean).join('\n')}
  </g>
`
      }

      // Thinkers
      svg += `
  <!-- Thinkers -->
  <g>
${filteredThinkers.map((thinker: Thinker) => {
  const pos = positions.get(thinker.id)
  if (!pos) return ''

  const { x, y, width: bgWidth, height: bgHeight } = pos

  return `    <rect x="${x - bgWidth / 2}" y="${y - bgHeight / 2}" width="${bgWidth}" height="${bgHeight}" fill="#FFFFFF" stroke="#CCCCCC" stroke-width="1"/>
    <text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle" class="thinker-name" fill="#1A1A1A">${thinker.name}</text>`
}).filter(Boolean).join('\n')}
  </g>
</svg>`

      // Download
      const blob = new Blob([svg], { type: 'image/svg+xml' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.download = `intellectual-genealogy-${selectedTimeline?.name || 'all'}-${Date.now()}.svg`
      link.href = url
      link.click()
      URL.revokeObjectURL(url)

      onClose()
    } catch (error) {
      console.error('Export failed:', error)
      alert('Export failed. Please try again.')
    } finally {
      setIsExporting(false)
    }
  }

  const handleExport = () => {
    if (format === 'png') {
      exportToPNG()
    } else {
      exportToSVG()
    }
  }

  // Update preview
  useEffect(() => {
    if (!isOpen || !previewCanvasRef.current) return

    const canvas = previewCanvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Scale preview to fit
    const maxPreviewWidth = 400
    const maxPreviewHeight = 200
    const scaleX = maxPreviewWidth / width
    const scaleY = maxPreviewHeight / height
    const scale = Math.min(scaleX, scaleY)

    canvas.width = width * scale
    canvas.height = height * scale

    ctx.scale(scale, scale)

    const positions = calculateThinkerPositions(filteredThinkers, width, height)

    drawTimeline(ctx, width, height)

    if (includeEvents && timelineEvents.length > 0) {
      drawTimelineEvents(ctx, timelineEvents, width, height)
    }

    if (includeConnections && filteredConnections.length > 0) {
      drawConnections(ctx, filteredConnections, positions)
    }

    drawThinkers(ctx, filteredThinkers, positions)
  }, [isOpen, width, height, includeConnections, includeEvents, filteredThinkers, filteredConnections, timelineEvents])

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Export Timeline" maxWidth="lg">
      <div className="p-6 space-y-6">
        {/* Preview */}
        <div className="border border-timeline rounded p-2 bg-gray-50">
          <p className="text-xs font-sans text-gray-500 mb-2">Preview</p>
          <div className="flex justify-center">
            <canvas
              ref={previewCanvasRef}
              className="border border-gray-200 rounded"
              style={{ maxWidth: '100%' }}
            />
          </div>
        </div>

        {/* Format Selection */}
        <div>
          <label className="block text-sm font-sans font-medium text-primary mb-2">Format</label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="format"
                value="png"
                checked={format === 'png'}
                onChange={() => setFormat('png')}
                className="text-accent focus:ring-accent"
              />
              <span className="font-sans text-sm">PNG (Raster Image)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="format"
                value="svg"
                checked={format === 'svg'}
                onChange={() => setFormat('svg')}
                className="text-accent focus:ring-accent"
              />
              <span className="font-sans text-sm">SVG (Vector Image)</span>
            </label>
          </div>
        </div>

        {/* Dimensions */}
        <div>
          <label className="block text-sm font-sans font-medium text-primary mb-2">Dimensions</label>
          <div className="flex gap-4 items-center">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Width</label>
              <input
                type="number"
                value={width}
                onChange={(e) => setWidth(Math.max(800, parseInt(e.target.value) || 800))}
                className="w-24 px-2 py-1.5 border border-timeline rounded font-sans text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <span className="text-gray-400 mt-5">x</span>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Height</label>
              <input
                type="number"
                value={height}
                onChange={(e) => setHeight(Math.max(400, parseInt(e.target.value) || 400))}
                className="w-24 px-2 py-1.5 border border-timeline rounded font-sans text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => { setWidth(1920); setHeight(1080); }}
                className="px-2 py-1 text-xs border border-timeline rounded hover:bg-gray-50"
              >
                1080p
              </button>
              <button
                onClick={() => { setWidth(3840); setHeight(2160); }}
                className="px-2 py-1 text-xs border border-timeline rounded hover:bg-gray-50"
              >
                4K
              </button>
              <button
                onClick={() => { setWidth(2480); setHeight(3508); }}
                className="px-2 py-1 text-xs border border-timeline rounded hover:bg-gray-50"
              >
                A4
              </button>
            </div>
          </div>
        </div>

        {/* Options */}
        <div>
          <label className="block text-sm font-sans font-medium text-primary mb-2">Options</label>
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeConnections}
                onChange={(e) => setIncludeConnections(e.target.checked)}
                className="text-accent focus:ring-accent rounded"
              />
              <span className="font-sans text-sm">Include connections</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeEvents}
                onChange={(e) => setIncludeEvents(e.target.checked)}
                className="text-accent focus:ring-accent rounded"
              />
              <span className="font-sans text-sm">Include timeline events</span>
            </label>
          </div>
        </div>

        {/* Stats */}
        <div className="text-xs text-gray-500 font-sans">
          Exporting {filteredThinkers.length} thinker{filteredThinkers.length !== 1 ? 's' : ''}
          {includeConnections && `, ${filteredConnections.length} connection${filteredConnections.length !== 1 ? 's' : ''}`}
          {includeEvents && `, ${timelineEvents.length} event${timelineEvents.length !== 1 ? 's' : ''}`}
        </div>

        <ModalFooter>
          <ModalButton variant="secondary" onClick={onClose}>
            Cancel
          </ModalButton>
          <ModalButton onClick={handleExport} disabled={isExporting}>
            {isExporting ? 'Exporting...' : `Export as ${format.toUpperCase()}`}
          </ModalButton>
        </ModalFooter>
      </div>
    </Modal>
  )
}
