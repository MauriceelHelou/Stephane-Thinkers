import { describe, it, expect } from 'vitest'
import { packLanes, type LayoutItem } from '../timelineLayout'

const opts = { topY: 100, laneStep: 23, laneGap: 6 }

describe('packLanes', () => {
  it('never overlaps: items sharing an x-span get different lanes', () => {
    const items: LayoutItem[] = [
      { id: 'a', left: 0, right: 50, height: 20 },
      { id: 'b', left: 10, right: 60, height: 20 }, // overlaps a
      { id: 'c', left: 200, right: 250, height: 20 }, // clear of both
    ]
    const out = packLanes(items, opts)
    expect(out.get('a')!.lane).not.toBe(out.get('b')!.lane)
    expect(out.get('c')!.lane).toBe(0) // reuses lane 0, no overlap
  })

  it('uses exactly depth lanes (minimal) for N mutually-overlapping items', () => {
    const items: LayoutItem[] = Array.from({ length: 5 }, (_, i) => ({
      id: `t${i}`, left: 0, right: 100, height: 20,
    }))
    const lanes = new Set([...packLanes(items, opts).values()].map((p) => p.lane))
    expect(lanes.size).toBe(5)
  })

  it('is deterministic: identical input → identical output', () => {
    const items: LayoutItem[] = [
      { id: 'a', left: 5, right: 40, height: 20 },
      { id: 'b', left: 5, right: 40, height: 20 },
      { id: 'c', left: 5, right: 40, height: 20 },
    ]
    const a = JSON.stringify([...packLanes(items, opts)])
    const b = JSON.stringify([...packLanes(items, opts)])
    expect(a).toBe(b)
  })

  it('computes y from lane index and topY', () => {
    const out = packLanes([{ id: 'a', left: 0, right: 10, height: 20 }], opts)
    expect(out.get('a')!.y).toBe(100) // topY + 0*laneStep
  })

  it('honors a pinned lane and reflows others around it', () => {
    const items: LayoutItem[] = [
      { id: 'pin', left: 0, right: 100, height: 20, pinnedLane: 2 },
      { id: 'x', left: 0, right: 100, height: 20 },
      { id: 'y', left: 0, right: 100, height: 20 },
    ]
    const out = packLanes(items, opts)
    expect(out.get('pin')!.lane).toBe(2)
    // x and y avoid lane 2 (and each other)
    expect([out.get('x')!.lane, out.get('y')!.lane]).not.toContain(2)
    expect(out.get('x')!.lane).not.toBe(out.get('y')!.lane)
  })
})
