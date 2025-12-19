import type { Thinker, Connection } from '@/types'

export interface ThinkerMetrics {
  thinkerId: string
  thinkerName: string
  inDegree: number          // Number of incoming connections
  outDegree: number         // Number of outgoing connections
  totalDegree: number       // Total connections
  betweenness: number       // How often this thinker is on shortest paths
  pageRank: number          // Influence score based on incoming connection quality
  clusterCoefficient: number // How connected the thinker's neighbors are
}

export interface NetworkStats {
  totalThinkers: number
  totalConnections: number
  averageDegree: number
  networkDensity: number      // Actual connections / possible connections
  mostInfluential: ThinkerMetrics[]  // Top 5 by PageRank
  mostConnected: ThinkerMetrics[]    // Top 5 by total degree
}

export interface PathResult {
  path: string[]
  pathNames: string[]
  length: number
}

/**
 * Calculate in-degree for each thinker (incoming connections)
 */
export function calculateInDegree(thinkerId: string, connections: Connection[]): number {
  return connections.filter(c => c.to_thinker_id === thinkerId).length
}

/**
 * Calculate out-degree for each thinker (outgoing connections)
 */
export function calculateOutDegree(thinkerId: string, connections: Connection[]): number {
  return connections.filter(c => c.from_thinker_id === thinkerId).length
}

/**
 * Build adjacency list from connections
 */
function buildAdjacencyList(
  thinkers: Thinker[],
  connections: Connection[]
): Map<string, Set<string>> {
  const adjacency = new Map<string, Set<string>>()

  // Initialize all thinkers
  thinkers.forEach(t => {
    adjacency.set(t.id, new Set())
  })

  // Add connections (treat bidirectional connections as two-way)
  connections.forEach(c => {
    adjacency.get(c.from_thinker_id)?.add(c.to_thinker_id)
    if (c.bidirectional) {
      adjacency.get(c.to_thinker_id)?.add(c.from_thinker_id)
    }
  })

  return adjacency
}

/**
 * Calculate PageRank-style influence score
 * Simplified iterative algorithm
 */
function calculatePageRank(
  thinkers: Thinker[],
  connections: Connection[],
  iterations: number = 20,
  dampingFactor: number = 0.85
): Map<string, number> {
  const n = thinkers.length
  if (n === 0) return new Map()

  const pageRank = new Map<string, number>()
  const initialValue = 1 / n

  // Initialize
  thinkers.forEach(t => pageRank.set(t.id, initialValue))

  // Build incoming connections map
  const incomingFrom = new Map<string, string[]>()
  const outgoingCount = new Map<string, number>()

  thinkers.forEach(t => {
    incomingFrom.set(t.id, [])
    outgoingCount.set(t.id, 0)
  })

  connections.forEach(c => {
    const incoming = incomingFrom.get(c.to_thinker_id)
    if (incoming) {
      incoming.push(c.from_thinker_id)
    }
    outgoingCount.set(c.from_thinker_id, (outgoingCount.get(c.from_thinker_id) || 0) + 1)

    // Handle bidirectional
    if (c.bidirectional) {
      const reverseIncoming = incomingFrom.get(c.from_thinker_id)
      if (reverseIncoming) {
        reverseIncoming.push(c.to_thinker_id)
      }
      outgoingCount.set(c.to_thinker_id, (outgoingCount.get(c.to_thinker_id) || 0) + 1)
    }
  })

  // Iterate
  for (let i = 0; i < iterations; i++) {
    const newRanks = new Map<string, number>()

    thinkers.forEach(t => {
      const incoming = incomingFrom.get(t.id) || []
      let sum = 0

      incoming.forEach(fromId => {
        const fromRank = pageRank.get(fromId) || 0
        const fromOutgoing = outgoingCount.get(fromId) || 1
        sum += fromRank / fromOutgoing
      })

      const newRank = (1 - dampingFactor) / n + dampingFactor * sum
      newRanks.set(t.id, newRank)
    })

    // Update ranks
    newRanks.forEach((rank, id) => pageRank.set(id, rank))
  }

  return pageRank
}

/**
 * Calculate local clustering coefficient
 */
function calculateClusteringCoefficient(
  thinkerId: string,
  adjacency: Map<string, Set<string>>
): number {
  const neighbors = adjacency.get(thinkerId)
  if (!neighbors || neighbors.size < 2) return 0

  const neighborArray = Array.from(neighbors)
  let triangles = 0
  let possibleTriangles = (neighborArray.length * (neighborArray.length - 1)) / 2

  for (let i = 0; i < neighborArray.length; i++) {
    for (let j = i + 1; j < neighborArray.length; j++) {
      const neighborsOfI = adjacency.get(neighborArray[i])
      if (neighborsOfI?.has(neighborArray[j])) {
        triangles++
      }
    }
  }

  return possibleTriangles > 0 ? triangles / possibleTriangles : 0
}

/**
 * Calculate betweenness centrality using BFS
 * Simplified version: counts how often a node appears in shortest paths
 */
function calculateBetweennessCentrality(
  thinkers: Thinker[],
  adjacency: Map<string, Set<string>>
): Map<string, number> {
  const betweenness = new Map<string, number>()
  thinkers.forEach(t => betweenness.set(t.id, 0))

  thinkers.forEach(source => {
    // BFS from source
    const distances = new Map<string, number>()
    const paths = new Map<string, number>()  // Number of shortest paths
    const predecessors = new Map<string, string[]>()

    distances.set(source.id, 0)
    paths.set(source.id, 1)

    const queue: string[] = [source.id]
    const stack: string[] = []

    while (queue.length > 0) {
      const current = queue.shift()!
      stack.push(current)

      const neighbors = adjacency.get(current) || new Set()
      neighbors.forEach(neighbor => {
        // First time seeing this node
        if (!distances.has(neighbor)) {
          distances.set(neighbor, (distances.get(current) || 0) + 1)
          queue.push(neighbor)
        }

        // Shortest path to neighbor via current
        if (distances.get(neighbor) === (distances.get(current) || 0) + 1) {
          paths.set(neighbor, (paths.get(neighbor) || 0) + (paths.get(current) || 0))
          const preds = predecessors.get(neighbor) || []
          preds.push(current)
          predecessors.set(neighbor, preds)
        }
      })
    }

    // Accumulate betweenness
    const dependency = new Map<string, number>()
    thinkers.forEach(t => dependency.set(t.id, 0))

    while (stack.length > 0) {
      const w = stack.pop()!
      const preds = predecessors.get(w) || []

      preds.forEach(v => {
        const contrib =
          ((paths.get(v) || 0) / (paths.get(w) || 1)) *
          (1 + (dependency.get(w) || 0))
        dependency.set(v, (dependency.get(v) || 0) + contrib)
      })

      if (w !== source.id) {
        betweenness.set(w, (betweenness.get(w) || 0) + (dependency.get(w) || 0))
      }
    }
  })

  // Normalize
  const n = thinkers.length
  if (n > 2) {
    const normalization = 2 / ((n - 1) * (n - 2))
    betweenness.forEach((value, key) => {
      betweenness.set(key, value * normalization)
    })
  }

  return betweenness
}

/**
 * Calculate all metrics for all thinkers
 */
export function calculateAllMetrics(
  thinkers: Thinker[],
  connections: Connection[]
): ThinkerMetrics[] {
  if (thinkers.length === 0) return []

  const adjacency = buildAdjacencyList(thinkers, connections)
  const pageRanks = calculatePageRank(thinkers, connections)
  const betweenness = calculateBetweennessCentrality(thinkers, adjacency)

  return thinkers.map(t => ({
    thinkerId: t.id,
    thinkerName: t.name,
    inDegree: calculateInDegree(t.id, connections),
    outDegree: calculateOutDegree(t.id, connections),
    totalDegree: calculateInDegree(t.id, connections) + calculateOutDegree(t.id, connections),
    betweenness: betweenness.get(t.id) || 0,
    pageRank: pageRanks.get(t.id) || 0,
    clusterCoefficient: calculateClusteringCoefficient(t.id, adjacency),
  }))
}

/**
 * Calculate network-level statistics
 */
export function calculateNetworkStats(
  thinkers: Thinker[],
  connections: Connection[]
): NetworkStats {
  const metrics = calculateAllMetrics(thinkers, connections)

  const n = thinkers.length
  const m = connections.length
  const maxPossibleConnections = n * (n - 1) // Directed graph

  const totalDegree = metrics.reduce((sum, m) => sum + m.totalDegree, 0)

  // Sort for top metrics
  const byPageRank = [...metrics].sort((a, b) => b.pageRank - a.pageRank)
  const byDegree = [...metrics].sort((a, b) => b.totalDegree - a.totalDegree)

  return {
    totalThinkers: n,
    totalConnections: m,
    averageDegree: n > 0 ? totalDegree / n : 0,
    networkDensity: maxPossibleConnections > 0 ? m / maxPossibleConnections : 0,
    mostInfluential: byPageRank.slice(0, 5),
    mostConnected: byDegree.slice(0, 5),
  }
}

/**
 * Find shortest path between two thinkers using BFS
 */
export function findShortestPath(
  fromId: string,
  toId: string,
  thinkers: Thinker[],
  connections: Connection[]
): PathResult | null {
  if (fromId === toId) {
    const thinker = thinkers.find(t => t.id === fromId)
    return {
      path: [fromId],
      pathNames: [thinker?.name || fromId],
      length: 0,
    }
  }

  const adjacency = buildAdjacencyList(thinkers, connections)

  // BFS
  const visited = new Set<string>()
  const parent = new Map<string, string>()
  const queue: string[] = [fromId]
  visited.add(fromId)

  while (queue.length > 0) {
    const current = queue.shift()!

    if (current === toId) {
      // Reconstruct path
      const path: string[] = []
      let node: string | undefined = toId

      while (node !== undefined) {
        path.unshift(node)
        node = parent.get(node)
      }

      const pathNames = path.map(
        id => thinkers.find(t => t.id === id)?.name || id
      )

      return {
        path,
        pathNames,
        length: path.length - 1,
      }
    }

    const neighbors = adjacency.get(current) || new Set()
    neighbors.forEach(neighbor => {
      if (!visited.has(neighbor)) {
        visited.add(neighbor)
        parent.set(neighbor, current)
        queue.push(neighbor)
      }
    })
  }

  return null // No path found
}

/**
 * Find all paths between two thinkers (up to a max length)
 */
export function findAllPaths(
  fromId: string,
  toId: string,
  thinkers: Thinker[],
  connections: Connection[],
  maxLength: number = 4
): PathResult[] {
  const adjacency = buildAdjacencyList(thinkers, connections)
  const results: PathResult[] = []

  function dfs(current: string, target: string, path: string[], visited: Set<string>) {
    if (path.length > maxLength + 1) return

    if (current === target && path.length > 1) {
      const pathNames = path.map(
        id => thinkers.find(t => t.id === id)?.name || id
      )
      results.push({
        path: [...path],
        pathNames,
        length: path.length - 1,
      })
      return
    }

    const neighbors = adjacency.get(current) || new Set()
    neighbors.forEach(neighbor => {
      if (!visited.has(neighbor)) {
        visited.add(neighbor)
        path.push(neighbor)
        dfs(neighbor, target, path, visited)
        path.pop()
        visited.delete(neighbor)
      }
    })
  }

  const visited = new Set<string>([fromId])
  dfs(fromId, toId, [fromId], visited)

  return results.sort((a, b) => a.length - b.length)
}

/**
 * Detect clusters/communities using label propagation
 */
export function detectClusters(
  thinkers: Thinker[],
  connections: Connection[]
): Map<string, number> {
  const adjacency = buildAdjacencyList(thinkers, connections)
  const labels = new Map<string, number>()

  // Initialize each node with unique label
  thinkers.forEach((t, i) => labels.set(t.id, i))

  // Iterate until convergence (or max iterations)
  const maxIterations = 10
  let changed = true
  let iteration = 0

  while (changed && iteration < maxIterations) {
    changed = false
    iteration++

    // Shuffle order for processing
    const shuffled = [...thinkers].sort(() => Math.random() - 0.5)

    shuffled.forEach(thinker => {
      const neighbors = adjacency.get(thinker.id)
      if (!neighbors || neighbors.size === 0) return

      // Count label frequencies among neighbors
      const labelCounts = new Map<number, number>()
      neighbors.forEach(neighborId => {
        const neighborLabel = labels.get(neighborId)
        if (neighborLabel !== undefined) {
          labelCounts.set(neighborLabel, (labelCounts.get(neighborLabel) || 0) + 1)
        }
      })

      // Find most common label
      let maxCount = 0
      let mostCommonLabel = labels.get(thinker.id)!

      labelCounts.forEach((count, label) => {
        if (count > maxCount) {
          maxCount = count
          mostCommonLabel = label
        }
      })

      if (mostCommonLabel !== labels.get(thinker.id)) {
        labels.set(thinker.id, mostCommonLabel)
        changed = true
      }
    })
  }

  return labels
}

/**
 * Get cluster summary
 */
export function getClusterSummary(
  thinkers: Thinker[],
  connections: Connection[]
): { clusterId: number; members: { id: string; name: string }[] }[] {
  const labels = detectClusters(thinkers, connections)

  // Group by cluster
  const clusters = new Map<number, { id: string; name: string }[]>()

  labels.forEach((label, thinkerId) => {
    const thinker = thinkers.find(t => t.id === thinkerId)
    if (thinker) {
      const cluster = clusters.get(label) || []
      cluster.push({ id: thinker.id, name: thinker.name })
      clusters.set(label, cluster)
    }
  })

  // Convert to array and sort by size
  return Array.from(clusters.entries())
    .map(([clusterId, members]) => ({ clusterId, members }))
    .sort((a, b) => b.members.length - a.members.length)
}
