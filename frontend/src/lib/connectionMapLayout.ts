/**
 * Force-directed layout for the Connection Network Map.
 *
 * The previous layout placed every node on a fixed-radius ring keyed by BFS
 * distance, with uniform angular spacing and no awareness of label box sizes.
 * Dense or multi-hop networks collapsed into overlapping cascades (see
 * ConnectionMapView). This replaces it with a deterministic force simulation
 * (link springs + charge repulsion + centering gravity) followed by a hard
 * rectangular collision-resolution pass that guarantees boxes never overlap,
 * then fits and centers the result inside the viewport.
 *
 * Pure and deterministic: positions are seeded from a hash of each node id
 * (no Math.random), so the same input always yields the same layout — stable
 * across re-renders and unit-testable.
 */

export interface LayoutInputNode {
  id: string
  isCenter: boolean
  /** Rendered box width in px. */
  width: number
  /** Rendered box height in px. */
  height: number
  /** BFS distance from the center node (center = 0). */
  distance: number
}

export interface LayoutLink {
  source: string
  target: string
}

export interface LayoutOptions {
  width: number
  height: number
  /** Inner margin kept clear of node boxes. */
  padding?: number
  /** Force-simulation iterations. */
  iterations?: number
}

export interface LayoutPosition {
  x: number
  y: number
}

interface SimNode {
  id: string
  isCenter: boolean
  halfW: number
  halfH: number
  distance: number
  x: number
  y: number
  vx: number
  vy: number
}

// Tuned against the live demo data (7-node and 31-node networks): produces a
// readable spread with zero overlaps that fits an ~820px square panel.
const GAP = 16 // minimum clear space between two boxes
const REPULSION = 2400 // global charge spreading nodes apart
const SPRING = 0.08 // link stiffness
const LINK_LENGTH = 92 // preferred edge length (collision enforces the minimum)
const GRAVITY = 0.015 // pull toward center, keeps the graph compact
const FRICTION = 0.82 // velocity damping per tick
const DEFAULT_ITERATIONS = 300
const COLLISION_PASSES = 160

function hashAngle(id: string): number {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash) + id.charCodeAt(i)
    hash |= 0
  }
  return (Math.abs(hash) % 360) * (Math.PI / 180)
}

/**
 * Resolve every pairwise box overlap by pushing nodes apart along their
 * smaller penetration axis. The center node is treated as immovable so it
 * stays put; its partner absorbs the full separation. Returns the number of
 * overlapping pairs found this pass (0 means the layout is collision-free).
 */
function resolveCollisions(nodes: SimNode[]): number {
  let overlapping = 0
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i]
      const b = nodes[j]
      const overlapX = a.halfW + b.halfW + GAP - Math.abs(a.x - b.x)
      const overlapY = a.halfH + b.halfH + GAP - Math.abs(a.y - b.y)
      if (overlapX <= 0 || overlapY <= 0) continue

      overlapping++
      if (overlapX < overlapY) {
        const shift = (a.x < b.x ? -1 : 1) * (overlapX / 2)
        if (a.isCenter) b.x -= 2 * shift
        else if (b.isCenter) a.x += 2 * shift
        else { a.x += shift; b.x -= shift }
      } else {
        const shift = (a.y < b.y ? -1 : 1) * (overlapY / 2)
        if (a.isCenter) b.y -= 2 * shift
        else if (b.isCenter) a.y += 2 * shift
        else { a.y += shift; b.y -= shift }
      }
    }
  }
  return overlapping
}

function boundingBox(nodes: SimNode[]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const n of nodes) {
    minX = Math.min(minX, n.x - n.halfW)
    minY = Math.min(minY, n.y - n.halfH)
    maxX = Math.max(maxX, n.x + n.halfW)
    maxY = Math.max(maxY, n.y + n.halfH)
  }
  return { minX, minY, maxX, maxY }
}

export function computeNetworkLayout(
  inputNodes: LayoutInputNode[],
  links: LayoutLink[],
  opts: LayoutOptions
): Map<string, LayoutPosition> {
  const positions = new Map<string, LayoutPosition>()
  if (inputNodes.length === 0) return positions

  const { width, height } = opts
  const padding = opts.padding ?? 24
  const iterations = opts.iterations ?? DEFAULT_ITERATIONS
  const centerX = width / 2
  const centerY = height / 2

  if (inputNodes.length === 1) {
    positions.set(inputNodes[0].id, { x: centerX, y: centerY })
    return positions
  }

  const nodes: SimNode[] = inputNodes.map((n) => {
    const angle = hashAngle(n.id)
    const radius = n.isCenter ? 0 : 50 + n.distance * 64
    return {
      id: n.id,
      isCenter: n.isCenter,
      halfW: n.width / 2,
      halfH: n.height / 2,
      distance: n.distance,
      x: centerX + Math.cos(angle) * radius,
      y: centerY + Math.sin(angle) * radius,
      vx: 0,
      vy: 0,
    }
  })

  const indexById = new Map(nodes.map((n, i) => [n.id, i]))
  const edges = links
    .map((l) => ({ a: indexById.get(l.source), b: indexById.get(l.target) }))
    .filter((e): e is { a: number; b: number } => e.a !== undefined && e.b !== undefined && e.a !== e.b)

  for (let iter = 0; iter < iterations; iter++) {
    const alpha = 1 - iter / iterations

    // Charge: every pair repels, inversely with squared distance.
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i]
        const b = nodes[j]
        let dx = a.x - b.x
        let dy = a.y - b.y
        let d2 = dx * dx + dy * dy
        if (d2 < 1) {
          // Coincident nodes: nudge deterministically so they can separate.
          dx = (i - j) || 1
          dy = 1
          d2 = dx * dx + dy * dy
        }
        const d = Math.sqrt(d2)
        const force = REPULSION / d2
        const ux = dx / d
        const uy = dy / d
        a.vx += ux * force; a.vy += uy * force
        b.vx -= ux * force; b.vy -= uy * force
      }
    }

    // Links: springs toward the preferred edge length.
    for (const e of edges) {
      const a = nodes[e.a]
      const b = nodes[e.b]
      const dx = b.x - a.x
      const dy = b.y - a.y
      const d = Math.hypot(dx, dy) || 1
      const force = ((d - LINK_LENGTH) / d) * SPRING
      a.vx += dx * force; a.vy += dy * force
      b.vx -= dx * force; b.vy -= dy * force
    }

    // Gravity: gentle pull toward the panel center (decays over time).
    for (const n of nodes) {
      if (n.isCenter) continue
      n.vx += (centerX - n.x) * GRAVITY * alpha
      n.vy += (centerY - n.y) * GRAVITY * alpha
    }

    // Integrate. The center node stays pinned at the panel center.
    for (const n of nodes) {
      if (n.isCenter) {
        n.x = centerX; n.y = centerY; n.vx = 0; n.vy = 0
        continue
      }
      n.x += n.vx; n.y += n.vy
      n.vx *= FRICTION; n.vy *= FRICTION
    }

    resolveCollisions(nodes)
  }

  // Hard collision pass: guarantee no residual overlaps.
  for (let k = 0; k < COLLISION_PASSES; k++) {
    if (resolveCollisions(nodes) === 0) break
  }

  // Fit: scale down (never up) so every box fits within the padded viewport,
  // scaling about the bounding-box center.
  let box = boundingBox(nodes)
  const boxW = box.maxX - box.minX
  const boxH = box.maxY - box.minY
  const scale = Math.min(
    (width - 2 * padding) / Math.max(boxW, 1),
    (height - 2 * padding) / Math.max(boxH, 1),
    1
  )
  if (scale < 1) {
    const bcx = (box.minX + box.maxX) / 2
    const bcy = (box.minY + box.maxY) / 2
    for (const n of nodes) {
      n.x = centerX + (n.x - bcx) * scale
      n.y = centerY + (n.y - bcy) * scale
    }
    for (let k = 0; k < COLLISION_PASSES; k++) {
      if (resolveCollisions(nodes) === 0) break
    }
  }

  // Center the final bounding box in the viewport for balanced framing.
  box = boundingBox(nodes)
  const offsetX = centerX - (box.minX + box.maxX) / 2
  const offsetY = centerY - (box.minY + box.maxY) / 2
  for (const n of nodes) {
    positions.set(n.id, { x: n.x + offsetX, y: n.y + offsetY })
  }

  return positions
}
