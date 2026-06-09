// Pure, DOM-free helpers for range-aware timeline items.
//
// These contain no canvas/DOM dependency so they can be unit-tested directly.
// Text measurement is injected (see `resolveBarLabel`) and the "current year"
// is injected (see `resolveThinkerRange`) so layout/tests stay deterministic.

export type ItemKind = 'range' | 'point'

export interface ClassifiedItem {
  kind: ItemKind
  startYear: number | null
  endYear: number | null
}

/**
 * Classify an item by its resolved years. An item is a `range` iff both years
 * are present and `endYear > startYear`; otherwise it is a `point`.
 *
 * Classification is data-only and zoom-independent — callers resolve the years
 * first (e.g. a living thinker's end is the injected current year).
 */
export function classifyItem(input: {
  startYear?: number | null
  endYear?: number | null
}): ClassifiedItem {
  const startYear = input.startYear ?? null
  const endYear = input.endYear ?? null
  const isRange = startYear != null && endYear != null && endYear > startYear
  return { kind: isRange ? 'range' : 'point', startYear, endYear }
}

export interface ThinkerRange {
  startYear: number | null
  endYear: number | null
  /** True for a living thinker (has a birth year, no death year). */
  ongoing: boolean
}

/**
 * Resolve a thinker's range. A dead thinker spans birth→death; a living thinker
 * spans birth→`currentYear` and is flagged `ongoing` (drawn open-ended). A
 * thinker with no birth year has no range and renders as a point elsewhere.
 */
export function resolveThinkerRange(
  thinker: { birth_year?: number | null; death_year?: number | null },
  currentYear: number
): ThinkerRange {
  const startYear = thinker.birth_year ?? null
  if (startYear == null) {
    return { startYear: null, endYear: null, ongoing: false }
  }
  if (thinker.death_year != null) {
    return { startYear, endYear: thinker.death_year, ongoing: false }
  }
  return { startYear, endYear: currentYear, ongoing: true }
}

/** Resolve an event's range from its `year` and optional `end_year`. */
export function resolveEventRange(event: {
  year: number
  end_year?: number | null
}): { startYear: number; endYear: number | null } {
  return { startYear: event.year, endYear: event.end_year ?? null }
}

/**
 * Compute a bar's pixel extent from the two endpoint x positions, flooring the
 * width at `minBarWidth` so a tiny span stays visible/clickable. The floor is
 * applied to the right edge so the left edge stays anchored to the start year.
 */
export function barExtent(
  xa: number,
  xb: number,
  minBarWidth: number
): { x0: number; x1: number; barWidth: number } {
  const x0 = Math.min(xa, xb)
  const barWidth = Math.max(minBarWidth, Math.abs(xb - xa))
  return { x0, x1: x0 + barWidth, barWidth }
}
