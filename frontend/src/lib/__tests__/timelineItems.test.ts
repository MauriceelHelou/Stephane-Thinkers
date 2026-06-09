import { describe, it, expect } from 'vitest'
import {
  classifyItem,
  resolveThinkerRange,
  resolveEventRange,
  barExtent,
} from '../timelineItems'
import {
  fitLabel,
  readableTextColor,
  contrastRatio,
  shouldShowTethers,
  chooseStableLane,
  TETHER_HIDE_YEAR_SPAN,
} from '../timelineDraw'

describe('classifyItem', () => {
  it('is a range when both years present and end > start', () => {
    expect(classifyItem({ startYear: 1545, endYear: 1563 }).kind).toBe('range')
  })

  it('is a point when end_year is missing', () => {
    expect(classifyItem({ startYear: 1600, endYear: null }).kind).toBe('point')
  })

  it('is a point when end equals start', () => {
    expect(classifyItem({ startYear: 1700, endYear: 1700 }).kind).toBe('point')
  })

  it('is a point when end is before start', () => {
    expect(classifyItem({ startYear: 1600, endYear: 1500 }).kind).toBe('point')
  })

  it('is a point when start is missing', () => {
    expect(classifyItem({ startYear: null, endYear: 1600 }).kind).toBe('point')
  })

  it('preserves the resolved years on the result', () => {
    expect(classifyItem({ startYear: 1545, endYear: 1563 })).toMatchObject({
      kind: 'range',
      startYear: 1545,
      endYear: 1563,
    })
  })
})

describe('resolveThinkerRange', () => {
  const CURRENT_YEAR = 2026

  it('spans birth to death for a dead thinker', () => {
    expect(
      resolveThinkerRange({ birth_year: 1724, death_year: 1804 }, CURRENT_YEAR)
    ).toMatchObject({ startYear: 1724, endYear: 1804, ongoing: false })
  })

  it('spans birth to the injected current year for a living thinker', () => {
    expect(
      resolveThinkerRange({ birth_year: 1950, death_year: null }, CURRENT_YEAR)
    ).toMatchObject({ startYear: 1950, endYear: CURRENT_YEAR, ongoing: true })
  })

  it('is a point (null range) when there is no birth year', () => {
    expect(
      resolveThinkerRange({ birth_year: null, death_year: 1804 }, CURRENT_YEAR)
    ).toMatchObject({ startYear: null, endYear: null, ongoing: false })
  })
})

describe('resolveEventRange', () => {
  it('uses year and end_year when end_year is set', () => {
    expect(resolveEventRange({ year: 1545, end_year: 1563 })).toEqual({
      startYear: 1545,
      endYear: 1563,
    })
  })

  it('has a null end when end_year is absent', () => {
    expect(resolveEventRange({ year: 1600, end_year: null })).toEqual({
      startYear: 1600,
      endYear: null,
    })
  })
})

describe('barExtent', () => {
  it('orders the endpoints and measures the width', () => {
    expect(barExtent(120, 300, 12)).toEqual({ x0: 120, x1: 300, barWidth: 180 })
  })

  it('handles reversed endpoints', () => {
    expect(barExtent(300, 120, 12)).toEqual({ x0: 120, x1: 300, barWidth: 180 })
  })

  it('floors a tiny span at minBarWidth, keeping the left edge anchored', () => {
    expect(barExtent(100, 104, 12)).toEqual({ x0: 100, x1: 112, barWidth: 12 })
  })
})

describe('fitLabel', () => {
  // Stub measure: 7px per character — keeps the helper canvas-free.
  const measure = (s: string) => s.length * 7

  it('returns the full text when it fits', () => {
    expect(fitLabel(measure, 'Kant', 200)).toBe('Kant')
  })

  it('ellipsizes to fit when too wide', () => {
    const out = fitLabel(measure, 'Immanuel Kant', 70)
    expect(out.endsWith('…')).toBe(true)
    expect(measure(out)).toBeLessThanOrEqual(70)
    expect(out.length).toBeLessThan('Immanuel Kant'.length)
  })

  it('returns empty string when there is no room', () => {
    expect(fitLabel(measure, 'Immanuel Kant', 3)).toBe('')
    expect(fitLabel(measure, 'Kant', 0)).toBe('')
  })
})

describe('contrastRatio', () => {
  it('is 21:1 for black against white', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 0)
  })

  it('is 1:1 for a colour against itself', () => {
    expect(contrastRatio('#8B4513', '#8B4513')).toBeCloseTo(1, 5)
  })

  it('is symmetric', () => {
    expect(contrastRatio('#6B3410', '#FFFFFF')).toBeCloseTo(
      contrastRatio('#FFFFFF', '#6B3410'),
      5
    )
  })

  it('supports 3-digit hex', () => {
    expect(contrastRatio('#000', '#fff')).toBeCloseTo(21, 0)
  })
})

describe('readableTextColor', () => {
  it('uses light text on dark brown bar fills', () => {
    for (const dark of ['#6B3410', '#7A4012', '#8B4513', '#9C5A28', '#8B5A2B']) {
      expect(readableTextColor(dark)).toBe('#FFFFFF')
    }
  })

  it('uses dark text on light fills', () => {
    for (const light of ['#FFFFFF', '#FAFAF8', '#E0F2FE']) {
      expect(readableTextColor(light)).toBe('#1A1A1A')
    }
  })

  it('always picks the higher-contrast of the two candidates', () => {
    for (const bg of ['#6B3410', '#B07A3D', '#A8662F', '#E0F2FE', '#8B5A2B', '#7A4012']) {
      const chosen = readableTextColor(bg)
      const other = chosen === '#FFFFFF' ? '#1A1A1A' : '#FFFFFF'
      expect(contrastRatio(chosen, bg)).toBeGreaterThanOrEqual(contrastRatio(other, bg))
    }
  })

  it('respects custom candidate colours', () => {
    expect(readableTextColor('#000000', '#111111', '#EEEEEE')).toBe('#EEEEEE')
  })
})

describe('shouldShowTethers', () => {
  it('shows tethers when the visible span is within the threshold', () => {
    expect(shouldShowTethers(800)).toBe(true)
    expect(shouldShowTethers(TETHER_HIDE_YEAR_SPAN)).toBe(true)
  })

  it('hides tethers once zoomed out past the threshold', () => {
    expect(shouldShowTethers(TETHER_HIDE_YEAR_SPAN + 1)).toBe(false)
    expect(shouldShowTethers(5000)).toBe(false)
  })

  it('honours a custom threshold', () => {
    expect(shouldShowTethers(300, 200)).toBe(false)
    expect(shouldShowTethers(150, 200)).toBe(true)
  })
})

describe('chooseStableLane', () => {
  const lane = (y: number, collisionCount = 0, opts: Partial<{ compressionRank: number; collisionPenalty: number; width: number }> = {}) => ({
    y,
    width: opts.width ?? 100,
    compressionRank: opts.compressionRank ?? 0,
    collisionCount,
    collisionPenalty: opts.collisionPenalty ?? 0,
  })

  it('returns null for no candidates', () => {
    expect(chooseStableLane([], 0)).toBeNull()
  })

  it('prefers a collision-free lane over any colliding one', () => {
    const chosen = chooseStableLane([lane(0, 2), lane(50, 0), lane(100, 1)], 0)
    expect(chosen?.y).toBe(50)
  })

  it('among free lanes picks the one closest to the anchor', () => {
    const chosen = chooseStableLane([lane(0), lane(40), lane(80)], 45)
    expect(chosen?.y).toBe(40)
  })

  it('among free lanes picks closest to the anchor so items move naturally', () => {
    // Not locked to a previous row: with the default as anchor it compacts
    // toward it rather than freezing wherever it last sat.
    const chosen = chooseStableLane([lane(0), lane(120)], 0)
    expect(chosen?.y).toBe(0)
  })

  it('prefers a free lane on the item’s side over a free lane across the axis', () => {
    const chosen = chooseStableLane(
      [
        { y: -30, width: 100, compressionRank: 0, collisionCount: 0, collisionPenalty: 0, sameSide: true },
        { y: 10, width: 100, compressionRank: 0, collisionCount: 0, collisionPenalty: 0, sameSide: false },
      ],
      0
    )
    expect(chosen?.y).toBe(-30)
  })

  it('crosses the axis only when no same-side lane is free', () => {
    const chosen = chooseStableLane(
      [
        { y: -30, width: 100, compressionRank: 0, collisionCount: 2, collisionPenalty: 5, sameSide: true },
        { y: 40, width: 100, compressionRank: 0, collisionCount: 0, collisionPenalty: 0, sameSide: false },
      ],
      0
    )
    expect(chosen?.y).toBe(40)
  })

  it('ignores side preference when none is supplied', () => {
    const chosen = chooseStableLane([lane(0), lane(40), lane(80)], 45)
    expect(chosen?.y).toBe(40)
  })

  it('among free lanes prefers the least-compressed rank', () => {
    const chosen = chooseStableLane(
      [lane(10, 0, { compressionRank: 1, width: 60 }), lane(40, 0, { compressionRank: 0, width: 100 })],
      10
    )
    expect(chosen?.y).toBe(40)
    expect(chosen?.width).toBe(100)
  })

  it('with no free lane minimises collisions, then penalty, then anchor distance', () => {
    const byCount = chooseStableLane([lane(0, 3), lane(50, 1), lane(90, 2)], 0)
    expect(byCount?.y).toBe(50)

    const byPenalty = chooseStableLane(
      [lane(0, 1, { collisionPenalty: 80 }), lane(50, 1, { collisionPenalty: 20 })],
      0
    )
    expect(byPenalty?.y).toBe(50)

    const byAnchor = chooseStableLane(
      [lane(0, 1, { collisionPenalty: 20 }), lane(50, 1, { collisionPenalty: 20 })],
      48
    )
    expect(byAnchor?.y).toBe(50)
  })
})
