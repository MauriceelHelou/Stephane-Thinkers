'use client'

import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { thinkersApi, connectionsApi } from '@/lib/api'
import { CONNECTION_STYLES, ConnectionStyleType } from '@/lib/constants'
import { ConnectionType } from '@/types'
import type { Thinker, Connection } from '@/types'

interface ConnectionMapViewProps {
  isOpen: boolean
  onClose: () => void
  centeredThinkerId: string | null
  onThinkerSelect?: (thinkerId: string) => void
}

interface NodePosition {
  id: string
  name: string
  x: number
  y: number
  isCenter: boolean
}

interface NodeVisual {
  label: string
  width: number
  height: number
  font: string
}

interface NodeHitArea {
  id: string
  x: number
  y: number
  halfWidth: number
  halfHeight: number
}

const ALL_CONNECTION_TYPES = Object.values(ConnectionType) as ConnectionStyleType[]
const NODE_MAX_LABEL_WIDTH = 96
const PANEL_PADDING = 72
const NODE_PADDING_X = 10
const CENTER_NODE_PADDING_X = 12
const NODE_HEIGHT = 24
const CENTER_NODE_HEIGHT = 28

function simpleHash(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function truncateLabel(ctx: CanvasRenderingContext2D, label: string, maxWidth: number): string {
  let displayName = label
  if (ctx.measureText(displayName).width <= maxWidth) return displayName

  while (ctx.measureText(`${displayName}...`).width > maxWidth && displayName.length > 3) {
    displayName = displayName.slice(0, -1)
  }
  return `${displayName}...`
}

function drawArrowhead(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  size: number,
  color: string
) {
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(x - size * Math.cos(angle - Math.PI / 7), y - size * Math.sin(angle - Math.PI / 7))
  ctx.lineTo(x - size * Math.cos(angle + Math.PI / 7), y - size * Math.sin(angle + Math.PI / 7))
  ctx.closePath()
  ctx.fillStyle = color
  ctx.fill()
}

function getRectEdgePoint(
  cx: number,
  cy: number,
  tx: number,
  ty: number,
  halfWidth: number,
  halfHeight: number
) {
  const vx = tx - cx
  const vy = ty - cy
  const scale = Math.min(
    halfWidth / Math.max(Math.abs(vx), 0.001),
    halfHeight / Math.max(Math.abs(vy), 0.001)
  )

  return {
    x: cx + vx * scale,
    y: cy + vy * scale,
  }
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  const r = Math.min(radius, width / 2, height / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + width - r, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + r)
  ctx.lineTo(x + width, y + height - r)
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height)
  ctx.lineTo(x + r, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

export function ConnectionMapView({ isOpen, onClose, centeredThinkerId, onThinkerSelect }: ConnectionMapViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const nodeHitAreasRef = useRef<NodeHitArea[]>([])
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)
  const [centerThinker, setCenterThinker] = useState<string | null>(centeredThinkerId)
  const [maxDepth, setMaxDepth] = useState<number>(10)
  const [visibleConnectionTypes, setVisibleConnectionTypes] = useState<Set<ConnectionStyleType>>(
    new Set(ALL_CONNECTION_TYPES)
  )
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 })

  const { data: thinkers = [] } = useQuery({
    queryKey: ['thinkers'],
    queryFn: () => thinkersApi.getAll(),
    enabled: isOpen,
  })

  const { data: connections = [] } = useQuery({
    queryKey: ['connections'],
    queryFn: connectionsApi.getAll,
    enabled: isOpen,
  })

  useEffect(() => {
    if (centeredThinkerId) setCenterThinker(centeredThinkerId)
  }, [centeredThinkerId])

  useEffect(() => {
    if (!isOpen) {
      setHoveredNode(null)
      nodeHitAreasRef.current = []
    }
  }, [isOpen])

  const centeredThinkerData = thinkers.find((t: Thinker) => t.id === centerThinker)

  const filteredConnections = useMemo(() => {
    return connections.filter((c: Connection) =>
      visibleConnectionTypes.has(c.connection_type as ConnectionStyleType)
    )
  }, [connections, visibleConnectionTypes])

  const buildFullNetwork = useCallback(() => {
    if (!centerThinker) {
      return {
        networkThinkerIds: new Set<string>(),
        networkConnections: [] as Connection[],
        distanceMap: new Map<string, number>()
      }
    }

    const visited = new Set<string>([centerThinker])
    const distanceMap = new Map<string, number>([[centerThinker, 0]])
    const queue: { id: string; depth: number }[] = [{ id: centerThinker, depth: 0 }]

    while (queue.length > 0) {
      const current = queue.shift()
      if (!current) break
      if (current.depth >= maxDepth) continue

      filteredConnections.forEach((c: Connection) => {
        let neighbor: string | null = null
        if (c.from_thinker_id === current.id && !visited.has(c.to_thinker_id)) {
          neighbor = c.to_thinker_id
        } else if (c.to_thinker_id === current.id && !visited.has(c.from_thinker_id)) {
          neighbor = c.from_thinker_id
        }

        if (neighbor) {
          visited.add(neighbor)
          distanceMap.set(neighbor, current.depth + 1)
          queue.push({ id: neighbor, depth: current.depth + 1 })
        }
      })
    }

    const networkConnections = filteredConnections.filter(
      (c: Connection) => visited.has(c.from_thinker_id) && visited.has(c.to_thinker_id)
    )

    return { networkThinkerIds: visited, networkConnections, distanceMap }
  }, [centerThinker, filteredConnections, maxDepth])

  const { networkThinkerIds, networkConnections, distanceMap } = buildFullNetwork()
  const networkThinkers = thinkers.filter((t: Thinker) => networkThinkerIds.has(t.id) && t.id !== centerThinker)

  const actualMaxDepth = useMemo(() => {
    if (distanceMap.size === 0) return 0
    return Math.max(...Array.from(distanceMap.values()))
  }, [distanceMap])

  const mapGeometry = useMemo(() => {
    const width = canvasSize.width
    const height = canvasSize.height
    const centerX = width / 2
    const centerY = height / 2
    const rawRadius = (Math.min(width, height) / 2) - PANEL_PADDING
    const mapRadius = Math.max(70, rawRadius)

    return {
      centerX,
      centerY,
      mapRadius,
      minX: centerX - mapRadius,
      maxX: centerX + mapRadius,
      minY: centerY - mapRadius,
      maxY: centerY + mapRadius,
    }
  }, [canvasSize])

  const nodes = useMemo<NodePosition[]>(() => {
    if (!centeredThinkerData) return []

    const { centerX, centerY, mapRadius, minX, maxX, minY, maxY } = mapGeometry
    const items: NodePosition[] = [
      {
        id: centeredThinkerData.id,
        name: centeredThinkerData.name,
        x: centerX,
        y: centerY,
        isCenter: true,
      }
    ]

    const grouped = new Map<number, Thinker[]>()
    networkThinkers.forEach((thinker: Thinker) => {
      const distance = distanceMap.get(thinker.id) || 1
      if (!grouped.has(distance)) grouped.set(distance, [])
      grouped.get(distance)!.push(thinker)
    })

    const distances = Array.from(grouped.keys()).sort((a, b) => a - b)
    const maxDistance = Math.max(...distances, 1)

    distances.forEach((distance) => {
      const thinkersAtDistance = (grouped.get(distance) || []).sort((a, b) => a.name.localeCompare(b.name))
      if (thinkersAtDistance.length === 0) return

      const minRing = mapRadius * 0.34
      const maxRing = mapRadius * 0.84
      const ringRadius = maxDistance <= 1
        ? mapRadius * 0.52
        : minRing + ((distance - 1) / (maxDistance - 1)) * (maxRing - minRing)

      const angleStep = (2 * Math.PI) / thinkersAtDistance.length
      const startAngle = (simpleHash(`distance-${distance}`) % 360) * (Math.PI / 180)

      thinkersAtDistance.forEach((thinker, index) => {
        const angle = startAngle + index * angleStep
        const jitter = ((simpleHash(thinker.id) % 11) - 5) * 0.012 * ringRadius
        const radiusFromCenter = ringRadius + jitter

        const x = clamp(centerX + Math.cos(angle) * radiusFromCenter, minX, maxX)
        const y = clamp(centerY + Math.sin(angle) * radiusFromCenter, minY, maxY)

        items.push({
          id: thinker.id,
          name: thinker.name,
          x,
          y,
          isCenter: false,
        })
      })
    })

    return items
  }, [centeredThinkerData, mapGeometry, networkThinkers, distanceMap])

  useEffect(() => {
    if (!isOpen || !viewportRef.current) return

    const viewport = viewportRef.current
    const updateSize = () => {
      const rect = viewport.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) {
        const side = Math.floor(Math.min(rect.width, rect.height))
        if (side > 0) {
          setCanvasSize({ width: side, height: side })
        }
      }
    }

    updateSize()
    window.addEventListener('resize', updateSize)
    return () => window.removeEventListener('resize', updateSize)
  }, [isOpen, networkThinkers.length])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !isOpen || !centerThinker || nodes.length === 0) return
    if (canvasSize.width === 0 || canvasSize.height === 0) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const width = canvasSize.width
    const height = canvasSize.height
    const dpr = window.devicePixelRatio || 1

    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    canvas.width = Math.floor(width * dpr)
    canvas.height = Math.floor(height * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.imageSmoothingEnabled = true

    ctx.clearRect(0, 0, width, height)
    ctx.fillStyle = '#FAFAF8'
    ctx.fillRect(0, 0, width, height)

    ctx.font = '12px Inter, sans-serif'
    ctx.textAlign = 'left'
    ctx.fillStyle = '#7F7F7F'
    ctx.fillText(`Network: ${nodes.length} thinkers, ${networkConnections.length} connections`, 20, 24)

    const nodeMap = new Map(nodes.map((node) => [node.id, node]))
    const nodeVisualMap = new Map<string, NodeVisual>()
    nodes.forEach((node) => {
      const font = node.isCenter ? '600 13px "Crimson Text", serif' : '12px "Crimson Text", serif'
      ctx.font = font
      const label = truncateLabel(ctx, node.name, NODE_MAX_LABEL_WIDTH + (node.isCenter ? 18 : 0))
      const paddingX = node.isCenter ? CENTER_NODE_PADDING_X : NODE_PADDING_X
      const textWidth = ctx.measureText(label).width
      const width = Math.ceil(textWidth + paddingX * 2)
      const height = node.isCenter ? CENTER_NODE_HEIGHT : NODE_HEIGHT

      nodeVisualMap.set(node.id, {
        label,
        width,
        height,
        font,
      })
    })

    const pairConnectionCount = new Map<string, { total: number; current: number }>()
    networkConnections.forEach((conn: Connection) => {
      const ids = [conn.from_thinker_id, conn.to_thinker_id].sort()
      const pairKey = `${ids[0]}-${ids[1]}`
      const existing = pairConnectionCount.get(pairKey)
      if (existing) {
        existing.total += 1
      } else {
        pairConnectionCount.set(pairKey, { total: 1, current: 0 })
      }
    })

    networkConnections.forEach((conn: Connection) => {
      const from = nodeMap.get(conn.from_thinker_id)
      const to = nodeMap.get(conn.to_thinker_id)
      if (!from || !to) return

      const ids = [conn.from_thinker_id, conn.to_thinker_id].sort()
      const pairKey = `${ids[0]}-${ids[1]}`
      const pair = pairConnectionCount.get(pairKey)
      if (!pair) return

      const connectionIndex = pair.current++
      const lineOffset = (connectionIndex - (pair.total - 1) / 2) * 9
      const fromVisual = nodeVisualMap.get(from.id)
      const toVisual = nodeVisualMap.get(to.id)
      if (!fromVisual || !toVisual) return

      const fromHalfWidth = fromVisual.width / 2
      const fromHalfHeight = fromVisual.height / 2
      const toHalfWidth = toVisual.width / 2
      const toHalfHeight = toVisual.height / 2

      const startBase = getRectEdgePoint(from.x, from.y, to.x, to.y, fromHalfWidth, fromHalfHeight)
      const endBase = getRectEdgePoint(to.x, to.y, from.x, from.y, toHalfWidth, toHalfHeight)

      const rawDx = endBase.x - startBase.x
      const rawDy = endBase.y - startBase.y
      const distance = Math.hypot(rawDx, rawDy)
      if (distance < 1) return

      const unitX = rawDx / distance
      const unitY = rawDy / distance
      const perpX = -unitY * lineOffset
      const perpY = unitX * lineOffset

      const startTipX = startBase.x + perpX
      const startTipY = startBase.y + perpY
      const endTipX = endBase.x + perpX
      const endTipY = endBase.y + perpY

      const style = CONNECTION_STYLES[conn.connection_type as ConnectionStyleType] || CONNECTION_STYLES.influenced
      const isHighlighted = hoveredNode === conn.from_thinker_id || hoveredNode === conn.to_thinker_id
      const strokeColor = isHighlighted ? style.highlightColor : style.color
      const arrowSize = isHighlighted ? 8 : 7
      const arrowGap = arrowSize + 1.25
      const startGap = conn.bidirectional ? arrowGap : 0

      const lineStartX = startTipX + unitX * startGap
      const lineStartY = startTipY + unitY * startGap
      const lineEndX = endTipX - unitX * arrowGap
      const lineEndY = endTipY - unitY * arrowGap
      const angle = Math.atan2(endTipY - startTipY, endTipX - startTipX)

      ctx.strokeStyle = strokeColor
      ctx.lineWidth = isHighlighted ? 2.3 : 1.5
      ctx.setLineDash(style.dashPattern)
      ctx.globalAlpha = isHighlighted ? 1 : 0.62

      if (Math.hypot(lineEndX - lineStartX, lineEndY - lineStartY) > 2) {
        ctx.beginPath()
        ctx.moveTo(lineStartX, lineStartY)
        ctx.lineTo(lineEndX, lineEndY)
        ctx.stroke()
      }

      ctx.setLineDash([])
      ctx.globalAlpha = isHighlighted ? 1 : 0.88
      drawArrowhead(ctx, endTipX, endTipY, angle, arrowSize, strokeColor)
      if (conn.bidirectional) {
        drawArrowhead(ctx, startTipX, startTipY, angle + Math.PI, arrowSize, strokeColor)
      }
    })

    ctx.globalAlpha = 1
    ctx.setLineDash([])

    const sortedNodes = [...nodes].sort((a, b) => {
      if (a.isCenter && !b.isCenter) return 1
      if (!a.isCenter && b.isCenter) return -1
      return a.name.localeCompare(b.name)
    })

    const hitAreas: NodeHitArea[] = []
    sortedNodes.forEach((node) => {
      const isHovered = hoveredNode === node.id
      const visual = nodeVisualMap.get(node.id)
      if (!visual) return

      const boxX = node.x - visual.width / 2
      const boxY = node.y - visual.height / 2

      drawRoundedRect(ctx, boxX, boxY, visual.width, visual.height, 8)
      if (node.isCenter) {
        ctx.fillStyle = '#8B4513'
        ctx.strokeStyle = '#65320F'
        ctx.lineWidth = 1.8
      } else if (isHovered) {
        ctx.fillStyle = '#FEF3C7'
        ctx.strokeStyle = '#D97706'
        ctx.lineWidth = 1.7
      } else {
        ctx.fillStyle = '#FFFFFF'
        ctx.strokeStyle = '#CBCBCB'
        ctx.lineWidth = 1.1
      }
      ctx.fill()
      ctx.stroke()

      ctx.font = visual.font
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = node.isCenter ? '#5B2C0F' : '#222222'
      ctx.fillText(visual.label, node.x, node.y)

      hitAreas.push({
        id: node.id,
        x: node.x,
        y: node.y,
        halfWidth: visual.width / 2,
        halfHeight: visual.height / 2,
      })
    })
    nodeHitAreasRef.current = hitAreas
  }, [isOpen, centerThinker, nodes, networkConnections, hoveredNode, canvasSize, mapGeometry])

  const findNodeAtPoint = useCallback((x: number, y: number): string | null => {
    const areas = nodeHitAreasRef.current
    for (let i = areas.length - 1; i >= 0; i--) {
      const area = areas[i]
      if (
        x >= area.x - area.halfWidth - 4 &&
        x <= area.x + area.halfWidth + 4 &&
        y >= area.y - area.halfHeight - 4 &&
        y <= area.y + area.halfHeight + 4
      ) {
        return area.id
      }
    }
    return null
  }, [])

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const hitId = findNodeAtPoint(x, y)

    setHoveredNode(hitId)
    canvas.style.cursor = hitId && hitId !== centerThinker ? 'pointer' : 'default'
  }

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const hitId = findNodeAtPoint(x, y)

    if (hitId && hitId !== centerThinker) {
      setCenterThinker(hitId)
    }
  }

  const toggleConnectionType = useCallback((type: ConnectionStyleType) => {
    setVisibleConnectionTypes((prev) => {
      const next = new Set(prev)
      if (next.has(type)) {
        if (next.size > 1) next.delete(type)
      } else {
        next.add(type)
      }
      return next
    })
  }, [])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-2">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl h-[90vh] flex flex-col">
        <div className="px-4 py-3 border-b border-timeline flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-serif font-semibold text-primary">Connection Network Map</h2>
              {centeredThinkerData && (
                <p className="text-sm text-secondary">
                  Full network centered on <span className="font-medium text-accent">{centeredThinkerData.name}</span>
                  {networkThinkers.length > 0 && (
                    <span className="ml-2 text-gray-400">
                      ({networkThinkers.length} thinkers, {networkConnections.length} connections)
                    </span>
                  )}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {centeredThinkerData && onThinkerSelect && (
                <button
                  onClick={() => {
                    onThinkerSelect(centeredThinkerData.id)
                    onClose()
                  }}
                  className="px-3 py-1.5 text-xs font-sans border border-accent text-accent rounded hover:bg-accent/10"
                >
                  View Details
                </button>
              )}
              <button
                onClick={onClose}
                className="text-secondary hover:text-primary text-2xl leading-none px-2"
              >
                &times;
              </button>
            </div>
          </div>

          {centerThinker && networkThinkers.length > 0 && (
            <div className="mt-3 flex items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-600 whitespace-nowrap">Depth:</label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={maxDepth}
                  onChange={(e) => setMaxDepth(parseInt(e.target.value))}
                  className="w-24 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-accent"
                />
                <span className="text-xs font-mono text-gray-600 w-12">
                  {maxDepth >= 10 ? 'All' : `${maxDepth} hop${maxDepth > 1 ? 's' : ''}`}
                </span>
              </div>
              {actualMaxDepth > 0 && actualMaxDepth < 10 && (
                <span className="text-xs text-gray-400">
                  (max in network: {actualMaxDepth})
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex-1 relative min-h-0">
          {!centerThinker ? (
            <div className="flex items-center justify-center h-full text-secondary">
              <p>Select a thinker to view their connections</p>
            </div>
          ) : networkThinkers.length === 0 ? (
            <div className="flex items-center justify-center h-full text-secondary">
              <div className="text-center">
                <p className="text-lg mb-2">{centeredThinkerData?.name}</p>
                <p className="text-sm">No connections found for this thinker</p>
              </div>
            </div>
          ) : (
            <div ref={viewportRef} className="absolute inset-0 flex items-center justify-center p-4 sm:p-6">
              <canvas
                ref={canvasRef}
                className="block rounded"
                onMouseMove={handleMouseMove}
                onClick={handleClick}
              />
            </div>
          )}
        </div>

        <div className="px-4 py-2 border-t border-timeline bg-gray-50 flex-shrink-0">
          <div className="flex flex-wrap gap-4 justify-center text-xs">
            {Object.entries(CONNECTION_STYLES).map(([type, style]) => {
              const isVisible = visibleConnectionTypes.has(type as ConnectionStyleType)
              return (
                <button
                  key={type}
                  onClick={() => toggleConnectionType(type as ConnectionStyleType)}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded transition-all ${
                    isVisible
                      ? 'bg-white border border-gray-300 shadow-sm'
                      : 'bg-gray-100 border border-transparent opacity-50'
                  }`}
                  title={isVisible ? `Hide ${style.label} connections` : `Show ${style.label} connections`}
                >
                  <input
                    type="checkbox"
                    checked={isVisible}
                    readOnly
                    className="w-3 h-3 rounded accent-accent pointer-events-none"
                  />
                  <div
                    className="w-4 h-0.5"
                    style={{
                      backgroundColor: style.color,
                      borderStyle: style.dashPattern.length > 0 ? 'dashed' : 'solid',
                    }}
                  />
                  <span className={isVisible ? 'text-gray-700' : 'text-gray-400'}>{style.label}</span>
                </button>
              )
            })}
          </div>
          <p className="text-center text-xs text-gray-400 mt-1">
            Click connection types to show/hide • Click a name box to re-center
          </p>
        </div>
      </div>
    </div>
  )
}
