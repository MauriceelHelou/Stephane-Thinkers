import { describe, it, expect } from 'vitest'
import {
  computeNetworkLayout,
  LayoutInputNode,
  LayoutLink,
  LayoutPosition,
} from '../connectionMapLayout'

const W = 820
const H = 820
const PADDING = 24

function node(id: string, distance: number, isCenter = false): LayoutInputNode {
  // Realistic label-box sizes from the renderer (~110px wide, 24px tall).
  return {
    id,
    isCenter,
    distance,
    width: isCenter ? 130 : 110,
    height: isCenter ? 28 : 24,
  }
}

/** Count pairs of boxes whose axis-aligned bounding boxes overlap. */
function countOverlaps(
  positions: Map<string, LayoutPosition>,
  nodes: LayoutInputNode[]
): number {
  const placed = nodes.map((n) => {
    const p = positions.get(n.id)!
    return { ...n, x: p.x, y: p.y }
  })
  let overlaps = 0
  for (let i = 0; i < placed.length; i++) {
    for (let j = i + 1; j < placed.length; j++) {
      const a = placed[i]
      const b = placed[j]
      if (
        Math.abs(a.x - b.x) < (a.width + b.width) / 2 &&
        Math.abs(a.y - b.y) < (a.height + b.height) / 2
      ) {
        overlaps++
      }
    }
  }
  return overlaps
}

function assertInBounds(positions: Map<string, LayoutPosition>, nodes: LayoutInputNode[]) {
  for (const n of nodes) {
    const p = positions.get(n.id)!
    expect(p.x - n.width / 2).toBeGreaterThanOrEqual(-2)
    expect(p.y - n.height / 2).toBeGreaterThanOrEqual(-2)
    expect(p.x + n.width / 2).toBeLessThanOrEqual(W + 2)
    expect(p.y + n.height / 2).toBeLessThanOrEqual(H + 2)
  }
}

describe('computeNetworkLayout', () => {
  it('produces no overlapping boxes for a dense single-ring hub (20 direct neighbors)', () => {
    const nodes: LayoutInputNode[] = [node('center', 0, true)]
    const links: LayoutLink[] = []
    for (let i = 0; i < 20; i++) {
      nodes.push(node(`n${i}`, 1))
      links.push({ source: 'center', target: `n${i}` })
    }

    const positions = computeNetworkLayout(nodes, links, { width: W, height: H, padding: PADDING })

    expect(positions.size).toBe(nodes.length)
    expect(countOverlaps(positions, nodes)).toBe(0)
    assertInBounds(positions, nodes)
  })

  it('produces no overlapping boxes for a deep multi-hop network (the cascade case)', () => {
    // Mimics the René Descartes network: ~30 nodes across 8 BFS rings.
    const nodes: LayoutInputNode[] = [node('center', 0, true)]
    const links: LayoutLink[] = []
    let prevRing = ['center']
    let counter = 0
    const ringSizes = [2, 1, 3, 6, 7, 7, 3, 1]
    ringSizes.forEach((size, ringIndex) => {
      const distance = ringIndex + 1
      const thisRing: string[] = []
      for (let i = 0; i < size; i++) {
        const id = `r${distance}_${i}`
        nodes.push(node(id, distance))
        links.push({ source: prevRing[counter % prevRing.length], target: id })
        thisRing.push(id)
        counter++
      }
      prevRing = thisRing
    })

    const positions = computeNetworkLayout(nodes, links, { width: W, height: H, padding: PADDING })

    expect(countOverlaps(positions, nodes)).toBe(0)
    assertInBounds(positions, nodes)
  })

  it('handles tiny networks without flinging boxes off-screen', () => {
    const nodes = [node('center', 0, true), node('a', 1), node('b', 1)]
    const links = [
      { source: 'center', target: 'a' },
      { source: 'center', target: 'b' },
    ]

    const positions = computeNetworkLayout(nodes, links, { width: W, height: H, padding: PADDING })

    expect(countOverlaps(positions, nodes)).toBe(0)
    assertInBounds(positions, nodes)
  })

  it('separates coincident-seed nodes (no shared exact position)', () => {
    // Two leaves with no edges still must not stack on top of each other.
    const nodes = [node('center', 0, true), node('x', 1), node('y', 1)]
    const positions = computeNetworkLayout(nodes, [], { width: W, height: H, padding: PADDING })
    expect(countOverlaps(positions, nodes)).toBe(0)
  })

  it('places a single node at the panel center', () => {
    const positions = computeNetworkLayout([node('only', 0, true)], [], { width: W, height: H })
    expect(positions.get('only')).toEqual({ x: W / 2, y: H / 2 })
  })

  it('is deterministic — identical input yields identical output', () => {
    const nodes: LayoutInputNode[] = [node('center', 0, true)]
    const links: LayoutLink[] = []
    for (let i = 0; i < 12; i++) {
      nodes.push(node(`n${i}`, (i % 3) + 1))
      links.push({ source: 'center', target: `n${i}` })
    }

    const a = computeNetworkLayout(nodes, links, { width: W, height: H })
    const b = computeNetworkLayout(nodes, links, { width: W, height: H })

    for (const n of nodes) {
      expect(a.get(n.id)).toEqual(b.get(n.id))
    }
  })
})
