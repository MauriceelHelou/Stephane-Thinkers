'use client'

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
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
  x: number
  y: number
  vx: number
  vy: number
  name: string
  isCenter: boolean
  connectionType?: ConnectionStyleType
  isInfluencer?: boolean // true = influenced the center, false = influenced by center
  distance?: number // BFS distance from center
}

const ALL_CONNECTION_TYPES = Object.values(ConnectionType) as ConnectionStyleType[]

export function ConnectionMapView({ isOpen, onClose, centeredThinkerId, onThinkerSelect }: ConnectionMapViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)
  const [centerThinker, setCenterThinker] = useState<string | null>(centeredThinkerId)
  const [nodes, setNodes] = useState<NodePosition[]>([])
  const animationRef = useRef<number | null>(null)

  // New controls: depth slider and connection type filters
  const [maxDepth, setMaxDepth] = useState<number>(10) // 10 = unlimited for practical purposes
  const [visibleConnectionTypes, setVisibleConnectionTypes] = useState<Set<ConnectionStyleType>>(
    new Set(ALL_CONNECTION_TYPES)
  )

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

  // Update center when prop changes and reset when modal closes
  useEffect(() => {
    if (centeredThinkerId) {
      setCenterThinker(centeredThinkerId)
    }
  }, [centeredThinkerId])

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      lastCenterRef.current = null
      setNodes([])
    }
  }, [isOpen])

  const centeredThinkerData = thinkers.find((t: Thinker) => t.id === centerThinker)

  // Filter connections by visible types
  const filteredConnections = useMemo(() => {
    return connections.filter((c: Connection) =>
      visibleConnectionTypes.has(c.connection_type as ConnectionStyleType)
    )
  }, [connections, visibleConnectionTypes])

  // Build full network using BFS - find all thinkers connected (directly or indirectly)
  // Now respects maxDepth and only uses visible connection types
  const buildFullNetwork = useCallback(() => {
    if (!centerThinker) return { networkThinkerIds: new Set<string>(), networkConnections: [] as Connection[], distanceMap: new Map<string, number>() }

    const visited = new Set<string>()
    const distanceMap = new Map<string, number>()
    const queue: { id: string; depth: number }[] = [{ id: centerThinker, depth: 0 }]
    visited.add(centerThinker)
    distanceMap.set(centerThinker, 0)

    // BFS to find all connected thinkers within maxDepth
    while (queue.length > 0) {
      const { id: current, depth } = queue.shift()!

      // Stop expanding if we've reached maxDepth
      if (depth >= maxDepth) continue

      filteredConnections.forEach((c: Connection) => {
        let neighbor: string | null = null
        if (c.from_thinker_id === current && !visited.has(c.to_thinker_id)) {
          neighbor = c.to_thinker_id
        } else if (c.to_thinker_id === current && !visited.has(c.from_thinker_id)) {
          neighbor = c.from_thinker_id
        }
        if (neighbor) {
          visited.add(neighbor)
          distanceMap.set(neighbor, depth + 1)
          queue.push({ id: neighbor, depth: depth + 1 })
        }
      })
    }

    // Get all connections within the network (only visible types between visited nodes)
    const networkConnections = filteredConnections.filter(
      (c: Connection) => visited.has(c.from_thinker_id) && visited.has(c.to_thinker_id)
    )

    return { networkThinkerIds: visited, networkConnections, distanceMap }
  }, [centerThinker, filteredConnections, maxDepth])

  const { networkThinkerIds, networkConnections, distanceMap } = buildFullNetwork()
  const networkThinkers = thinkers.filter((t: Thinker) => networkThinkerIds.has(t.id) && t.id !== centerThinker)

  // Compute max actual depth in the current network for slider reference
  const actualMaxDepth = useMemo(() => {
    if (distanceMap.size === 0) return 0
    return Math.max(...Array.from(distanceMap.values()))
  }, [distanceMap])

  // Get direct connections for layout purposes (to determine relative positions)
  const directConnections = filteredConnections.filter(
    (c: Connection) => c.from_thinker_id === centerThinker || c.to_thinker_id === centerThinker
  )

  // Track which thinkers have direct relationship with center
  const connectedThinkersInfo = new Map<string, { isInfluencer: boolean; connectionType: ConnectionStyleType; distance: number }>()

  directConnections.forEach((c: Connection) => {
    if (c.from_thinker_id !== centerThinker) {
      connectedThinkersInfo.set(c.from_thinker_id, {
        isInfluencer: true,
        connectionType: c.connection_type as ConnectionStyleType,
        distance: 1
      })
    }
    if (c.to_thinker_id !== centerThinker) {
      connectedThinkersInfo.set(c.to_thinker_id, {
        isInfluencer: false,
        connectionType: c.connection_type as ConnectionStyleType,
        distance: 1
      })
    }
  })

  const connectedThinkers = networkThinkers

  // Toggle a connection type visibility
  const toggleConnectionType = useCallback((type: ConnectionStyleType) => {
    setVisibleConnectionTypes(prev => {
      const next = new Set(prev)
      if (next.has(type)) {
        // Don't allow hiding all types
        if (next.size > 1) {
          next.delete(type)
        }
      } else {
        next.add(type)
      }
      return next
    })
  }, [])

  // Simple hash function for deterministic positioning
  const simpleHash = (str: string): number => {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash
    }
    return Math.abs(hash)
  }

  // Initialize nodes with radial layout based on distance from center
  const initializeNodes = useCallback((width: number, height: number): NodePosition[] => {
    const positions: NodePosition[] = []
    const centerX = width / 2
    const centerY = height / 2
    const margin = 80 // Keep nodes away from edges

    // Center node (fixed position)
    if (centeredThinkerData) {
      positions.push({
        id: centeredThinkerData.id,
        x: centerX,
        y: centerY,
        vx: 0,
        vy: 0,
        name: centeredThinkerData.name,
        isCenter: true,
      })
    }

    // Group thinkers by distance from center
    const distances = Array.from(distanceMap.values()).filter(d => d > 0)
    const maxDistance = Math.max(...distances, 1)
    const thinkersByDistance = new Map<number, Thinker[]>()

    connectedThinkers.forEach((thinker: Thinker) => {
      const distance = distanceMap.get(thinker.id) || 1
      if (!thinkersByDistance.has(distance)) {
        thinkersByDistance.set(distance, [])
      }
      thinkersByDistance.get(distance)!.push(thinker)
    })

    // Calculate available radius range
    const minRadius = 100 // Minimum distance from center
    const maxRadius = Math.min(width, height) / 2 - margin

    thinkersByDistance.forEach((thinkersAtDist, distance) => {
      // Scale radius based on distance level
      const radiusFraction = distance / maxDistance
      const radius = minRadius + radiusFraction * (maxRadius - minRadius)

      // Distribute thinkers evenly around the ring
      const angleStep = (2 * Math.PI) / thinkersAtDist.length
      // Use hash to add deterministic offset to starting angle (avoid stacking at same angle)
      const startAngle = (simpleHash(String(distance)) % 100) / 100 * Math.PI * 2

      thinkersAtDist.forEach((thinker: Thinker, index: number) => {
        const info = connectedThinkersInfo.get(thinker.id)
        const angle = startAngle + index * angleStep
        // Small deterministic offset for variety (max 10% of radius)
        const hashOffset = ((simpleHash(thinker.id) % 20) - 10) * 0.05 * radius

        // Calculate position and clamp to bounds
        const x = Math.max(margin, Math.min(width - margin, centerX + Math.cos(angle) * (radius + hashOffset)))
        const y = Math.max(margin, Math.min(height - margin, centerY + Math.sin(angle) * (radius + hashOffset)))

        positions.push({
          id: thinker.id,
          x,
          y,
          vx: 0,
          vy: 0,
          name: thinker.name,
          isCenter: false,
          connectionType: info?.connectionType,
          isInfluencer: info?.isInfluencer,
        })
      })
    })

    return positions
  }, [centeredThinkerData, connectedThinkers, connectedThinkersInfo, distanceMap])

  // Force simulation (adapted for radial layout)
  const simulateForces = useCallback((nodes: NodePosition[], width: number, height: number): NodePosition[] => {
    const centerX = width / 2
    const centerY = height / 2
    const repulsionStrength = 5000
    const damping = 0.85
    const minDistance = 130 // Increased to prevent label overlaps for rectangular nodes

    return nodes.map((node, i) => {
      if (node.isCenter) return node // Center node is fixed

      let fx = 0
      let fy = 0

      // Repulsion from other nodes
      nodes.forEach((other, j) => {
        if (i === j) return
        const dx = node.x - other.x
        const dy = node.y - other.y
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1)
        if (dist < minDistance * 2.5) {
          const force = repulsionStrength / (dist * dist)
          fx += (dx / dist) * force
          fy += (dy / dist) * force
        }
      })

      // Boundary forces
      const margin = 60
      if (node.x < margin) fx += (margin - node.x) * 0.15
      if (node.x > width - margin) fx -= (node.x - (width - margin)) * 0.15
      if (node.y < margin) fy += (margin - node.y) * 0.15
      if (node.y > height - margin) fy -= (node.y - (height - margin)) * 0.15

      const newVx = (node.vx + fx) * damping
      const newVy = (node.vy + fy) * damping

      return {
        ...node,
        x: node.x + newVx,
        y: node.y + newVy,
        vx: newVx,
        vy: newVy,
      }
    })
  }, [])

  // Track if we need to reinitialize
  const lastCenterRef = useRef<string | null>(null)
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 })

  // Handle resize
  useEffect(() => {
    if (!isOpen || !canvasRef.current) return

    const canvas = canvasRef.current
    const updateSize = () => {
      const rect = canvas.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) {
        setCanvasSize({ width: rect.width, height: rect.height })
      }
    }

    updateSize()
    window.addEventListener('resize', updateSize)
    return () => window.removeEventListener('resize', updateSize)
  }, [isOpen])

  // Create a network key that changes when filters change
  const networkKey = useMemo(() => {
    const typesKey = Array.from(visibleConnectionTypes).sort().join(',')
    return `${centerThinker}-${maxDepth}-${typesKey}`
  }, [centerThinker, maxDepth, visibleConnectionTypes])

  // Initialize and run force simulation when center thinker or network config changes
  useEffect(() => {
    if (!isOpen || !centerThinker) return
    if (canvasSize.width === 0 || canvasSize.height === 0) return

    // Only reinitialize if the network key changed
    if (lastCenterRef.current === networkKey && nodes.length > 0) return
    lastCenterRef.current = networkKey

    // Initialize nodes
    const initialNodes = initializeNodes(canvasSize.width, canvasSize.height)

    // Run simulation synchronously for a fixed number of iterations (no animation)
    let simulationNodes = initialNodes
    for (let i = 0; i < 80; i++) {
      simulationNodes = simulateForces(simulationNodes, canvasSize.width, canvasSize.height)
    }
    setNodes(simulationNodes)

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [isOpen, centerThinker, canvasSize, initializeNodes, simulateForces, networkKey])

  // Calculate positions for hit detection
  const calculatePositions = useCallback((width: number, height: number): NodePosition[] => {
    return nodes
  }, [nodes])

  // Draw the map
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !isOpen || !centerThinker || nodes.length === 0) return
    if (canvasSize.width === 0 || canvasSize.height === 0) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = canvasSize.width * dpr
    canvas.height = canvasSize.height * dpr
    ctx.scale(dpr, dpr)

    const width = canvasSize.width
    const height = canvasSize.height

    // Clear
    ctx.fillStyle = '#FAFAF8'
    ctx.fillRect(0, 0, width, height)

    // Draw network info
    ctx.font = '12px Inter, sans-serif'
    ctx.fillStyle = '#999999'
    ctx.textAlign = 'left'
    const networkSize = nodes.length
    const connectionCount = networkConnections.length
    ctx.fillText(`Network: ${networkSize} thinkers, ${connectionCount} connections`, 20, 25)

    const positionMap = new Map(nodes.map(p => [p.id, p]))

    // Group connections by thinker pair to handle dual connections
    const pairConnectionCount = new Map<string, { total: number; current: number }>()
    networkConnections.forEach((conn: Connection) => {
      const ids = [conn.from_thinker_id, conn.to_thinker_id].sort()
      const pairKey = `${ids[0]}-${ids[1]}`
      const existing = pairConnectionCount.get(pairKey)
      if (existing) {
        existing.total++
      } else {
        pairConnectionCount.set(pairKey, { total: 1, current: 0 })
      }
    })

    // Draw all connections in the network
    networkConnections.forEach((conn: Connection) => {
      const fromPos = positionMap.get(conn.from_thinker_id)
      const toPos = positionMap.get(conn.to_thinker_id)
      if (!fromPos || !toPos) return

      // Calculate offset for dual connections
      const ids = [conn.from_thinker_id, conn.to_thinker_id].sort()
      const pairKey = `${ids[0]}-${ids[1]}`
      const pairInfo = pairConnectionCount.get(pairKey)!
      const connectionIndex = pairInfo.current++
      const totalConnections = pairInfo.total

      // Calculate perpendicular offset for parallel lines
      const offsetStep = 12 // Pixels between parallel connections
      const totalOffset = (totalConnections - 1) * offsetStep
      const lineOffset = connectionIndex * offsetStep - totalOffset / 2

      // Calculate perpendicular vector
      const dx = toPos.x - fromPos.x
      const dy = toPos.y - fromPos.y
      const length = Math.sqrt(dx * dx + dy * dy)
      const perpX = -dy / length * lineOffset
      const perpY = dx / length * lineOffset

      const style = CONNECTION_STYLES[conn.connection_type as ConnectionStyleType] || CONNECTION_STYLES.influenced
      const isHighlighted = hoveredNode === conn.from_thinker_id || hoveredNode === conn.to_thinker_id

      ctx.strokeStyle = isHighlighted ? style.highlightColor : style.color
      ctx.lineWidth = isHighlighted ? 2.5 : 1.5
      ctx.setLineDash(style.dashPattern)
      ctx.globalAlpha = isHighlighted ? 1 : 0.5

      // Calculate start and end points at rectangle edges
      // Use half-width and half-height based on node dimensions
      const fromHalfWidth = 40  // Approximate half-width of label
      const fromHalfHeight = 11
      const toHalfWidth = 40
      const toHalfHeight = 11

      // Find intersection with rectangle edge
      const getEdgePoint = (cx: number, cy: number, tx: number, ty: number, hw: number, hh: number) => {
        const vx = tx - cx
        const vy = ty - cy
        const scale = Math.min(hw / Math.abs(vx || 0.01), hh / Math.abs(vy || 0.01))
        return { x: cx + vx * scale, y: cy + vy * scale }
      }

      const fromEdge = getEdgePoint(fromPos.x, fromPos.y, toPos.x, toPos.y, fromHalfWidth, fromHalfHeight)
      const toEdge = getEdgePoint(toPos.x, toPos.y, fromPos.x, fromPos.y, toHalfWidth, toHalfHeight)

      const adjustedFromX = fromEdge.x + perpX
      const adjustedFromY = fromEdge.y + perpY
      const adjustedToX = toEdge.x + perpX
      const adjustedToY = toEdge.y + perpY

      ctx.beginPath()
      ctx.moveTo(adjustedFromX, adjustedFromY)
      ctx.lineTo(adjustedToX, adjustedToY)
      ctx.stroke()

      // Arrow - draw at the line end (already at circle edge)
      ctx.setLineDash([])
      ctx.globalAlpha = isHighlighted ? 1 : 0.7
      const angle = Math.atan2(adjustedToY - adjustedFromY, adjustedToX - adjustedFromX)
      const arrowSize = 8
      ctx.beginPath()
      ctx.moveTo(adjustedToX, adjustedToY)
      ctx.lineTo(
        adjustedToX - arrowSize * Math.cos(angle - Math.PI / 7),
        adjustedToY - arrowSize * Math.sin(angle - Math.PI / 7)
      )
      ctx.lineTo(
        adjustedToX - arrowSize * Math.cos(angle + Math.PI / 7),
        adjustedToY - arrowSize * Math.sin(angle + Math.PI / 7)
      )
      ctx.closePath()
      ctx.fillStyle = isHighlighted ? style.highlightColor : style.color
      ctx.fill()
    })

    ctx.globalAlpha = 1
    ctx.setLineDash([])

    // Draw nodes as labeled rectangles (names are the nodes)
    nodes.forEach((node) => {
      const isHovered = hoveredNode === node.id

      // Set font and measure text
      ctx.font = node.isCenter ? 'bold 13px "Crimson Text", serif' : '12px "Crimson Text", serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      // Truncate long names
      const maxLabelWidth = 100
      let displayName = node.name
      if (ctx.measureText(displayName).width > maxLabelWidth) {
        while (ctx.measureText(displayName + '...').width > maxLabelWidth && displayName.length > 3) {
          displayName = displayName.slice(0, -1)
        }
        displayName += '...'
      }

      const textWidth = ctx.measureText(displayName).width
      const padding = 8
      const bgWidth = textWidth + padding * 2
      const bgHeight = 22

      // Draw background rectangle
      if (node.isCenter) {
        ctx.fillStyle = '#8B4513'
        ctx.strokeStyle = '#6B3410'
        ctx.lineWidth = 2
      } else if (isHovered) {
        ctx.fillStyle = '#FEF3C7'
        ctx.strokeStyle = '#D97706'
        ctx.lineWidth = 2
      } else {
        ctx.fillStyle = '#FFFFFF'
        ctx.strokeStyle = '#CCCCCC'
        ctx.lineWidth = 1
      }

      ctx.fillRect(node.x - bgWidth / 2, node.y - bgHeight / 2, bgWidth, bgHeight)
      ctx.strokeRect(node.x - bgWidth / 2, node.y - bgHeight / 2, bgWidth, bgHeight)

      // Draw text
      ctx.fillStyle = node.isCenter ? '#FFFFFF' : '#1A1A1A'
      ctx.fillText(displayName, node.x, node.y)
    })
  }, [isOpen, centerThinker, networkConnections, nodes, hoveredNode, canvasSize])

  // Handle mouse interactions
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    let foundNode: string | null = null
    for (const node of nodes) {
      // Check if point is inside rectangle (with padding for easier clicking)
      const halfWidth = 50  // Approximate half-width including padding
      const halfHeight = 15
      if (Math.abs(x - node.x) <= halfWidth && Math.abs(y - node.y) <= halfHeight) {
        foundNode = node.id
        break
      }
    }

    setHoveredNode(foundNode)
    canvas.style.cursor = foundNode && foundNode !== centerThinker ? 'pointer' : 'default'
  }

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    for (const node of nodes) {
      // Check if point is inside rectangle (with padding for easier clicking)
      const halfWidth = 50  // Approximate half-width including padding
      const halfHeight = 15
      if (Math.abs(x - node.x) <= halfWidth && Math.abs(y - node.y) <= halfHeight && node.id !== centerThinker) {
        setCenterThinker(node.id)
        break
      }
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-2">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 border-b border-timeline flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-serif font-semibold text-primary">Connection Network Map</h2>
              {centeredThinkerData && (
                <p className="text-sm text-secondary">
                  Full network centered on <span className="font-medium text-accent">{centeredThinkerData.name}</span>
                  {connectedThinkers.length > 0 && (
                    <span className="ml-2 text-gray-400">
                      ({connectedThinkers.length} thinkers, {networkConnections.length} connections)
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

          {/* Controls: Depth slider */}
          {centerThinker && connectedThinkers.length > 0 && (
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

        {/* Canvas */}
        <div className="flex-1 relative min-h-0">
          {!centerThinker ? (
            <div className="flex items-center justify-center h-full text-secondary">
              <p>Select a thinker to view their connections</p>
            </div>
          ) : connectedThinkers.length === 0 ? (
            <div className="flex items-center justify-center h-full text-secondary">
              <div className="text-center">
                <p className="text-lg mb-2">{centeredThinkerData?.name}</p>
                <p className="text-sm">No connections found for this thinker</p>
              </div>
            </div>
          ) : (
            <canvas
              ref={canvasRef}
              className="w-full h-full"
              onMouseMove={handleMouseMove}
              onClick={handleClick}
            />
          )}
        </div>

        {/* Legend with connection type filters */}
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
            Click connection types to show/hide • Click on a thinker to re-center
          </p>
        </div>
      </div>
    </div>
  )
}
