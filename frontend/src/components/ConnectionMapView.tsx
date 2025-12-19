'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { thinkersApi, connectionsApi } from '@/lib/api'
import { CONNECTION_STYLES, ConnectionStyleType } from '@/lib/constants'
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
}

export function ConnectionMapView({ isOpen, onClose, centeredThinkerId, onThinkerSelect }: ConnectionMapViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)
  const [centerThinker, setCenterThinker] = useState<string | null>(centeredThinkerId)
  const [nodes, setNodes] = useState<NodePosition[]>([])
  const animationRef = useRef<number | null>(null)

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

  // Update center when prop changes
  useEffect(() => {
    if (centeredThinkerId) {
      setCenterThinker(centeredThinkerId)
    }
  }, [centeredThinkerId])

  const centeredThinkerData = thinkers.find((t: Thinker) => t.id === centerThinker)

  // Get connections involving the centered thinker
  const relevantConnections = connections.filter(
    (c: Connection) => c.from_thinker_id === centerThinker || c.to_thinker_id === centerThinker
  )

  // Get unique connected thinker IDs with their relationship info
  const connectedThinkersInfo = new Map<string, { isInfluencer: boolean; connectionType: ConnectionStyleType }>()
  relevantConnections.forEach((c: Connection) => {
    if (c.from_thinker_id !== centerThinker) {
      // This thinker influenced the center (from -> center)
      connectedThinkersInfo.set(c.from_thinker_id, {
        isInfluencer: true,
        connectionType: c.connection_type as ConnectionStyleType
      })
    }
    if (c.to_thinker_id !== centerThinker) {
      // Center influenced this thinker (center -> to)
      connectedThinkersInfo.set(c.to_thinker_id, {
        isInfluencer: false,
        connectionType: c.connection_type as ConnectionStyleType
      })
    }
  })

  const connectedThinkers = thinkers.filter((t: Thinker) => connectedThinkersInfo.has(t.id))

  // Initialize nodes with force-directed layout
  const initializeNodes = useCallback((width: number, height: number): NodePosition[] => {
    const positions: NodePosition[] = []
    const centerX = width / 2
    const centerY = height / 2

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

    // Separate influencers (left) from influenced (right)
    const influencers = connectedThinkers.filter((t: Thinker) => connectedThinkersInfo.get(t.id)?.isInfluencer)
    const influenced = connectedThinkers.filter((t: Thinker) => !connectedThinkersInfo.get(t.id)?.isInfluencer)

    // Position influencers on the left
    influencers.forEach((thinker: Thinker, index: number) => {
      const info = connectedThinkersInfo.get(thinker.id)
      const spreadY = height * 0.7
      const startY = (height - spreadY) / 2
      const y = influencers.length === 1 ? centerY : startY + (index / (influencers.length - 1)) * spreadY

      positions.push({
        id: thinker.id,
        x: width * 0.15 + Math.random() * 50,
        y: y + (Math.random() - 0.5) * 30,
        vx: 0,
        vy: 0,
        name: thinker.name,
        isCenter: false,
        connectionType: info?.connectionType,
        isInfluencer: true,
      })
    })

    // Position influenced on the right
    influenced.forEach((thinker: Thinker, index: number) => {
      const info = connectedThinkersInfo.get(thinker.id)
      const spreadY = height * 0.7
      const startY = (height - spreadY) / 2
      const y = influenced.length === 1 ? centerY : startY + (index / (influenced.length - 1)) * spreadY

      positions.push({
        id: thinker.id,
        x: width * 0.85 + (Math.random() - 0.5) * 50,
        y: y + (Math.random() - 0.5) * 30,
        vx: 0,
        vy: 0,
        name: thinker.name,
        isCenter: false,
        connectionType: info?.connectionType,
        isInfluencer: false,
      })
    })

    return positions
  }, [centeredThinkerData, connectedThinkers, connectedThinkersInfo])

  // Force simulation
  const simulateForces = useCallback((nodes: NodePosition[], width: number, height: number): NodePosition[] => {
    const centerX = width / 2
    const centerY = height / 2
    const repulsionStrength = 3000
    const attractionStrength = 0.01
    const damping = 0.85
    const minDistance = 100

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
        if (dist < minDistance * 2) {
          const force = repulsionStrength / (dist * dist)
          fx += (dx / dist) * force
          fy += (dy / dist) * force
        }
      })

      // Attraction to horizontal zones (left for influencers, right for influenced)
      const targetX = node.isInfluencer ? width * 0.2 : width * 0.8
      fx += (targetX - node.x) * attractionStrength * 2

      // Weak attraction to vertical center
      fy += (centerY - node.y) * attractionStrength * 0.5

      // Boundary forces
      const margin = 80
      if (node.x < margin) fx += (margin - node.x) * 0.1
      if (node.x > width - margin) fx -= (node.x - (width - margin)) * 0.1
      if (node.y < margin) fy += (margin - node.y) * 0.1
      if (node.y > height - margin) fy -= (node.y - (height - margin)) * 0.1

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

  // Initialize and run force simulation
  useEffect(() => {
    if (!isOpen || !centerThinker || !canvasRef.current) return

    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const width = rect.width
    const height = rect.height

    // Initialize nodes
    const initialNodes = initializeNodes(width, height)
    setNodes(initialNodes)

    // Run simulation for a few iterations
    let simulationNodes = initialNodes
    let iterations = 0
    const maxIterations = 100

    const runSimulation = () => {
      if (iterations < maxIterations) {
        simulationNodes = simulateForces(simulationNodes, width, height)
        setNodes([...simulationNodes])
        iterations++
        animationRef.current = requestAnimationFrame(runSimulation)
      }
    }

    animationRef.current = requestAnimationFrame(runSimulation)

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [isOpen, centerThinker, initializeNodes, simulateForces, connectedThinkers.length])

  // Calculate positions for hit detection
  const calculatePositions = useCallback((width: number, height: number): NodePosition[] => {
    return nodes
  }, [nodes])

  // Draw the map
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !isOpen || !centerThinker || nodes.length === 0) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)

    const width = rect.width
    const height = rect.height

    // Clear
    ctx.fillStyle = '#FAFAF8'
    ctx.fillRect(0, 0, width, height)

    // Draw zone labels
    ctx.font = '12px Inter, sans-serif'
    ctx.fillStyle = '#999999'
    ctx.textAlign = 'center'

    const hasInfluencers = nodes.some(n => !n.isCenter && n.isInfluencer)
    const hasInfluenced = nodes.some(n => !n.isCenter && !n.isInfluencer)

    if (hasInfluencers) {
      ctx.fillText('Influenced by', width * 0.2, 30)
    }
    if (hasInfluenced) {
      ctx.fillText('Influenced', width * 0.8, 30)
    }

    const positionMap = new Map(nodes.map(p => [p.id, p]))

    // Draw connections
    relevantConnections.forEach((conn: Connection) => {
      const fromPos = positionMap.get(conn.from_thinker_id)
      const toPos = positionMap.get(conn.to_thinker_id)
      if (!fromPos || !toPos) return

      const style = CONNECTION_STYLES[conn.connection_type as ConnectionStyleType] || CONNECTION_STYLES.influenced
      const isHighlighted = hoveredNode === conn.from_thinker_id || hoveredNode === conn.to_thinker_id

      ctx.strokeStyle = isHighlighted ? style.highlightColor : style.color
      ctx.lineWidth = isHighlighted ? 3 : 2
      ctx.setLineDash(style.dashPattern)
      ctx.globalAlpha = isHighlighted ? 1 : 0.6

      // Draw straight line for horizontal layout
      ctx.beginPath()
      ctx.moveTo(fromPos.x, fromPos.y)
      ctx.lineTo(toPos.x, toPos.y)
      ctx.stroke()

      // Arrow
      ctx.setLineDash([])
      const angle = Math.atan2(toPos.y - fromPos.y, toPos.x - fromPos.x)
      const arrowSize = 10
      const arrowX = toPos.x - 25 * Math.cos(angle)
      const arrowY = toPos.y - 25 * Math.sin(angle)
      ctx.beginPath()
      ctx.moveTo(arrowX, arrowY)
      ctx.lineTo(
        arrowX - arrowSize * Math.cos(angle - Math.PI / 6),
        arrowY - arrowSize * Math.sin(angle - Math.PI / 6)
      )
      ctx.lineTo(
        arrowX - arrowSize * Math.cos(angle + Math.PI / 6),
        arrowY - arrowSize * Math.sin(angle + Math.PI / 6)
      )
      ctx.closePath()
      ctx.fillStyle = isHighlighted ? style.highlightColor : style.color
      ctx.fill()

      // Connection label at midpoint
      const midX = (fromPos.x + toPos.x) / 2
      const midY = (fromPos.y + toPos.y) / 2
      ctx.globalAlpha = 1
      ctx.font = '10px Inter, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillStyle = '#FFFFFF'
      const labelWidth = ctx.measureText(style.label).width + 8
      ctx.fillRect(midX - labelWidth / 2, midY - 8, labelWidth, 16)
      ctx.fillStyle = style.color
      ctx.fillText(style.label, midX, midY + 3)
    })

    ctx.globalAlpha = 1
    ctx.setLineDash([])

    // Draw nodes
    nodes.forEach((node) => {
      const isHovered = hoveredNode === node.id
      const nodeRadius = node.isCenter ? 45 : 35

      // Node circle
      ctx.beginPath()
      ctx.arc(node.x, node.y, nodeRadius, 0, Math.PI * 2)

      if (node.isCenter) {
        ctx.fillStyle = '#8B4513'
        ctx.strokeStyle = '#6B3410'
      } else if (isHovered) {
        ctx.fillStyle = '#F0E6D8'
        ctx.strokeStyle = '#8B4513'
      } else {
        ctx.fillStyle = '#FFFFFF'
        ctx.strokeStyle = '#CCCCCC'
      }

      ctx.lineWidth = isHovered || node.isCenter ? 3 : 2
      ctx.fill()
      ctx.stroke()

      // Node label
      ctx.font = node.isCenter ? 'bold 13px Crimson Text, serif' : '12px Crimson Text, serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = node.isCenter ? '#FFFFFF' : '#1A1A1A'

      // Wrap text if needed
      const maxWidth = nodeRadius * 1.8
      const words = node.name.split(' ')
      let line = ''
      const lines: string[] = []

      words.forEach((word) => {
        const testLine = line + (line ? ' ' : '') + word
        const metrics = ctx.measureText(testLine)
        if (metrics.width > maxWidth && line) {
          lines.push(line)
          line = word
        } else {
          line = testLine
        }
      })
      lines.push(line)

      const lineHeight = 14
      const startY = node.y - ((lines.length - 1) * lineHeight) / 2
      lines.forEach((l, i) => {
        ctx.fillText(l, node.x, startY + i * lineHeight)
      })
    })
  }, [isOpen, centerThinker, relevantConnections, nodes, hoveredNode])

  // Handle mouse interactions
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    let foundNode: string | null = null
    for (const node of nodes) {
      const nodeRadius = node.isCenter ? 45 : 35
      const dist = Math.sqrt((x - node.x) ** 2 + (y - node.y) ** 2)
      if (dist <= nodeRadius) {
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
      const nodeRadius = node.isCenter ? 45 : 35
      const dist = Math.sqrt((x - node.x) ** 2 + (y - node.y) ** 2)
      if (dist <= nodeRadius && node.id !== centerThinker) {
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
        <div className="flex items-center justify-between px-4 py-3 border-b border-timeline flex-shrink-0">
          <div>
            <h2 className="text-lg font-serif font-semibold text-primary">Connection Map</h2>
            {centeredThinkerData && (
              <p className="text-sm text-secondary">
                Viewing connections for <span className="font-medium text-accent">{centeredThinkerData.name}</span>
                {connectedThinkers.length > 0 && (
                  <span className="ml-2 text-gray-400">({connectedThinkers.length} connections)</span>
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

        {/* Legend */}
        <div className="px-4 py-2 border-t border-timeline bg-gray-50 flex-shrink-0">
          <div className="flex flex-wrap gap-4 justify-center text-xs">
            {Object.entries(CONNECTION_STYLES).map(([type, style]) => (
              <div key={type} className="flex items-center gap-1.5">
                <div
                  className="w-4 h-0.5"
                  style={{
                    backgroundColor: style.color,
                    borderStyle: style.dashPattern.length > 0 ? 'dashed' : 'solid',
                  }}
                />
                <span className="text-gray-600">{style.label}</span>
              </div>
            ))}
          </div>
          <p className="text-center text-xs text-gray-400 mt-1">
            Click on a connected thinker to re-center the map
          </p>
        </div>
      </div>
    </div>
  )
}
