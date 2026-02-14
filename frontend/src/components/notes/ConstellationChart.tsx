'use client'

import { useCallback, useMemo, useState, type WheelEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { analysisApi } from '@/lib/api'
import type { TermThinkerBubble, TermThinkerMatrix } from '@/types'
import ConstellationTooltip from './ConstellationTooltip'

const SVG_WIDTH = 800
const SVG_HEIGHT = 600
const MIN_RADIUS = 20
const MAX_RADIUS = 80
const BUBBLE_PADDING = 6
const SPIRAL_STEP_ANGLE = 0.3
const SPIRAL_STEP_RADIUS = 2
const MAX_SPIRAL_STEPS = 2000
const MIN_ZOOM = 0.6
const MAX_ZOOM = 2.4
const ZOOM_STEP = 0.2

const CONSTELLATION_PALETTE = [
  '#2563EB',
  '#DC2626',
  '#16A34A',
  '#9333EA',
  '#EA580C',
  '#0D9488',
  '#DB2777',
  '#CA8A04',
  '#4F46E5',
  '#059669',
]

type ColorMode = 'thinker' | 'term'

interface PlacedBubble {
  bubble: TermThinkerBubble
  x: number
  y: number
  radius: number
}

function clampZoom(zoomLevel: number): number {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoomLevel))
}

function computeRadius(frequency: number, maxFrequency: number): number {
  if (maxFrequency <= 1) return MIN_RADIUS
  const ratio = Math.min(1, Math.max(0, frequency / maxFrequency))
  return MIN_RADIUS + ratio * (MAX_RADIUS - MIN_RADIUS)
}

function placeBubbles(bubbles: TermThinkerBubble[], maxFrequency: number): PlacedBubble[] {
  const sorted = [...bubbles].sort((a, b) => b.frequency - a.frequency)
  const placed: PlacedBubble[] = []
  const centerX = SVG_WIDTH / 2
  const centerY = SVG_HEIGHT / 2

  for (const bubble of sorted) {
    const radius = computeRadius(bubble.frequency, maxFrequency)

    if (placed.length === 0) {
      placed.push({ bubble, x: centerX, y: centerY, radius })
      continue
    }

    let angle = 0
    let spiralRadius = 0
    let found = false

    for (let step = 0; step < MAX_SPIRAL_STEPS; step += 1) {
      const candidateX = centerX + spiralRadius * Math.cos(angle)
      const candidateY = centerY + spiralRadius * Math.sin(angle)

      const hasOverlap = placed.some((node) => {
        const dx = candidateX - node.x
        const dy = candidateY - node.y
        const distance = Math.sqrt(dx * dx + dy * dy)
        return distance < radius + node.radius + BUBBLE_PADDING
      })

      const inBounds =
        candidateX - radius >= 10 &&
        candidateX + radius <= SVG_WIDTH - 10 &&
        candidateY - radius >= 10 &&
        candidateY + radius <= SVG_HEIGHT - 10

      if (!hasOverlap && inBounds) {
        placed.push({ bubble, x: candidateX, y: candidateY, radius })
        found = true
        break
      }

      angle += SPIRAL_STEP_ANGLE
      spiralRadius += SPIRAL_STEP_RADIUS
    }

    if (!found) {
      placed.push({ bubble, x: centerX + spiralRadius * Math.cos(angle), y: centerY + spiralRadius * Math.sin(angle), radius })
    }
  }

  return placed
}

interface ConstellationChartProps {
  selectedTermId?: string | null
  folderId?: string | null
  onBubbleClick?: (termId: string, thinkerId: string, thinkerName: string) => void
}

export default function ConstellationChart({ selectedTermId, folderId, onBubbleClick }: ConstellationChartProps) {
  const [colorMode, setColorMode] = useState<ColorMode>('thinker')
  const [zoomLevel, setZoomLevel] = useState(1)
  const [hoveredBubble, setHoveredBubble] = useState<PlacedBubble | null>(null)
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 })

  const { data: matrix, isLoading, error } = useQuery<TermThinkerMatrix>({
    queryKey: ['term-thinker-matrix', folderId, selectedTermId],
    queryFn: () =>
      analysisApi.getTermThinkerMatrix({
        folder_id: folderId || undefined,
        term_id: selectedTermId || undefined,
      }),
    refetchOnMount: 'always',
  })

  const zoomIn = useCallback(() => {
    setZoomLevel((previousZoom) => clampZoom(previousZoom + ZOOM_STEP))
  }, [])

  const zoomOut = useCallback(() => {
    setZoomLevel((previousZoom) => clampZoom(previousZoom - ZOOM_STEP))
  }, [])

  const resetZoom = useCallback(() => {
    setZoomLevel(1)
  }, [])

  const handleWheelZoom = useCallback((event: WheelEvent<SVGSVGElement>) => {
    event.preventDefault()
    if (event.deltaY < 0) {
      setZoomLevel((previousZoom) => clampZoom(previousZoom + ZOOM_STEP))
      return
    }
    setZoomLevel((previousZoom) => clampZoom(previousZoom - ZOOM_STEP))
  }, [])

  const sceneTransform = useMemo(() => {
    const centerX = SVG_WIDTH / 2
    const centerY = SVG_HEIGHT / 2
    return `translate(${centerX} ${centerY}) scale(${zoomLevel}) translate(${-centerX} ${-centerY})`
  }, [zoomLevel])

  const placedBubbles = useMemo(() => {
    if (!matrix || matrix.bubbles.length === 0) return []
    return placeBubbles(matrix.bubbles, matrix.max_frequency)
  }, [matrix])

  const colorMap = useMemo(() => {
    const map = new Map<string, string>()
    if (!matrix) return map
    const keys = colorMode === 'thinker' ? matrix.thinkers : matrix.terms
    keys.forEach((key, index) => map.set(key, CONSTELLATION_PALETTE[index % CONSTELLATION_PALETTE.length]))
    return map
  }, [colorMode, matrix])

  const getBubbleColor = useCallback(
    (bubble: TermThinkerBubble): string => {
      const key = colorMode === 'thinker' ? bubble.thinker_name : bubble.term_name
      return colorMap.get(key) || CONSTELLATION_PALETTE[0]
    },
    [colorMap, colorMode]
  )

  const truncateText = (text: string, radius: number): string => {
    const maxChars = Math.floor(radius / 4)
    if (text.length <= maxChars) return text
    if (maxChars <= 2) return text.slice(0, 1)
    return `${text.slice(0, maxChars - 1)}…`
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-secondary">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent mx-auto mb-3" />
          <p className="font-sans text-sm">Loading constellation data...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-red-600">
        <p className="font-sans text-sm">Failed to load constellation data.</p>
      </div>
    )
  }

  if (!matrix || matrix.bubbles.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-secondary">
        <div className="text-center max-w-xs">
          <p className="font-serif text-lg mb-2">No constellation data yet</p>
          <p className="font-sans text-sm">
            The constellation appears when notes contain both critical terms and thinker mentions.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b border-timeline bg-background">
        <div className="flex items-center gap-2">
          <span className="font-sans text-xs text-secondary">Color by:</span>
          <button
            type="button"
            onClick={() => setColorMode('thinker')}
            className={`px-2 py-1 text-xs font-sans rounded transition-colors ${
              colorMode === 'thinker' ? 'bg-accent text-white' : 'bg-gray-100 text-secondary hover:bg-gray-200'
            }`}
          >
            Thinker
          </button>
          <button
            type="button"
            onClick={() => setColorMode('term')}
            className={`px-2 py-1 text-xs font-sans rounded transition-colors ${
              colorMode === 'term' ? 'bg-accent text-white' : 'bg-gray-100 text-secondary hover:bg-gray-200'
            }`}
          >
            Term
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={zoomIn}
            className="px-2 py-1 text-xs font-sans rounded bg-gray-100 text-secondary hover:bg-gray-200 transition-colors"
          >
            Zoom In
          </button>
          <button
            type="button"
            onClick={zoomOut}
            className="px-2 py-1 text-xs font-sans rounded bg-gray-100 text-secondary hover:bg-gray-200 transition-colors"
          >
            Zoom Out
          </button>
          <button
            type="button"
            onClick={resetZoom}
            className="px-2 py-1 text-xs font-sans rounded bg-gray-100 text-secondary hover:bg-gray-200 transition-colors"
          >
            Reset Zoom
          </button>
          <span className="font-sans text-xs text-secondary">{matrix.total_bubbles} pairs</span>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <svg
          viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
          className="w-full h-full"
          onMouseMove={(event) => setTooltipPosition({ x: event.clientX, y: event.clientY })}
          onWheel={handleWheelZoom}
        >
          <rect x={0} y={0} width={SVG_WIDTH} height={SVG_HEIGHT} fill="#FAFAF8" />

          <g transform={sceneTransform}>
            {placedBubbles.map((placed) => {
              const color = getBubbleColor(placed.bubble)
              const isHovered =
                hoveredBubble?.bubble.term_id === placed.bubble.term_id &&
                hoveredBubble?.bubble.thinker_id === placed.bubble.thinker_id

              return (
                <g
                  key={`${placed.bubble.term_id}-${placed.bubble.thinker_id}`}
                  transform={`translate(${placed.x}, ${placed.y})`}
                  onMouseEnter={(event) => {
                    setHoveredBubble(placed)
                    setTooltipPosition({ x: event.clientX, y: event.clientY })
                  }}
                  onMouseLeave={() => setHoveredBubble(null)}
                  onClick={() => onBubbleClick?.(placed.bubble.term_id, placed.bubble.thinker_id, placed.bubble.thinker_name)}
                  style={{ cursor: 'pointer' }}
                >
                  <circle
                    r={placed.radius}
                    fill={color}
                    opacity={isHovered ? 0.9 : 0.65}
                    stroke={isHovered ? '#1A1A1A' : color}
                    strokeWidth={isHovered ? 2 : 1}
                    strokeOpacity={isHovered ? 0.8 : 0.3}
                  />

                  <text
                    textAnchor="middle"
                    dy="-0.1em"
                    fontSize={Math.max(9, Math.min(14, placed.radius / 3))}
                    fontFamily="'Crimson Text', serif"
                    fontWeight="600"
                    fill="white"
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    {truncateText(placed.bubble.thinker_name, placed.radius)}
                  </text>

                  {placed.radius >= 30 && (
                    <text
                      textAnchor="middle"
                      dy="1.2em"
                      fontSize={Math.max(7, Math.min(10, placed.radius / 5))}
                      fontFamily="'Inter', sans-serif"
                      fill="white"
                      opacity={0.85}
                      style={{ pointerEvents: 'none', userSelect: 'none' }}
                    >
                      {truncateText(placed.bubble.term_name, placed.radius)} ({placed.bubble.frequency})
                    </text>
                  )}
                </g>
              )
            })}
          </g>
        </svg>
      </div>

      {hoveredBubble && <ConstellationTooltip bubble={hoveredBubble.bubble} position={tooltipPosition} />}
    </div>
  )
}
