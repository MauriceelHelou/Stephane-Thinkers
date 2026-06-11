// Pure, DOM-free timeline layout engine.
//
// Greedy interval-partition lane packing: O(n · L) where L = lane depth, zero
// overlaps by construction, minimal lane count, fully deterministic. Plus pure
// helpers for label building, canvas word-wrap, band geometry, and color.
// Text measurement is injected so the module stays unit-testable without a DOM.

export interface LayoutItem {
  id: string
  left: number // screen-x of footprint left edge
  right: number // screen-x of footprint right edge
  height: number
  priority?: number // higher places earlier among free items (default 0)
  pinnedLane?: number // forces a specific lane (manual/drag); placed as obstacle
}

export interface PlacedItem {
  id: string
  lane: number
  y: number // center Y
}

export interface PackOptions {
  topY: number // center Y of lane 0
  laneStep: number // distance between adjacent lane centers
  laneGap: number // min horizontal gap between items in the same lane
}

interface Span {
  left: number
  right: number
}

/**
 * Greedy interval-partition lane assignment. O(n · L) where L = lane depth.
 * Zero overlaps by construction; minimal lane count; deterministic.
 */
export function packLanes(items: LayoutItem[], opts: PackOptions): Map<string, PlacedItem> {
  const result = new Map<string, PlacedItem>()
  const laneSpans: Span[][] = []

  const fits = (lane: number, left: number, right: number): boolean => {
    const spans = laneSpans[lane]
    if (!spans) return true
    for (const s of spans) {
      if (left < s.right + opts.laneGap && right + opts.laneGap > s.left) return false
    }
    return true
  }
  const occupy = (lane: number, left: number, right: number) => {
    ;(laneSpans[lane] ??= []).push({ left, right })
  }
  const place = (id: string, lane: number, left: number, right: number) => {
    occupy(lane, left, right)
    result.set(id, { id, lane, y: opts.topY + lane * opts.laneStep })
  }

  // 1) Pinned/manual items first, as hard obstacles in their lane.
  for (const it of items) {
    if (it.pinnedLane != null) place(it.id, it.pinnedLane, it.left, it.right)
  }

  // 2) Free items, sorted by left asc (greedy optimality), then priority, then id.
  const free = items
    .filter((it) => it.pinnedLane == null)
    .sort((a, b) =>
      a.left !== b.left
        ? a.left - b.left
        : (b.priority ?? 0) - (a.priority ?? 0) || (a.id < b.id ? -1 : 1),
    )

  for (const it of free) {
    let lane = 0
    while (!fits(lane, it.left, it.right)) lane++
    place(it.id, lane, it.left, it.right)
  }

  return result
}

export function buildThinkerLabel(input: {
  name: string
  birthYear?: number | null
  deathYear?: number | null
  measure: (s: string) => number
  maxWidth: number
}): { text: string; truncated: boolean } {
  const { name, birthYear, deathYear, measure, maxWidth } = input

  if (birthYear != null) {
    const full = `${name} (${birthYear}–${deathYear ?? ''})`
    if (measure(full) <= maxWidth) return { text: full, truncated: false }
  }
  if (measure(name) <= maxWidth) return { text: name, truncated: false }

  const ellipsis = '…'
  let s = name
  while (s.length > 1 && measure(`${s}${ellipsis}`) > maxWidth) s = s.slice(0, -1)
  return { text: `${s}${ellipsis}`, truncated: true }
}
