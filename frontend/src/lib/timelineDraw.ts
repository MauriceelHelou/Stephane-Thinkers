// Canvas draw helpers shared by Timeline.tsx and CombinedTimelineCanvas.tsx so
// range bars and tethers render identically in both views. Pure geometry/label
// math lives in `timelineItems.ts`; this module is the canvas-facing layer.

// Range-bar + tether constants
export const MIN_BAR_WIDTH = 12          // tiny spans stay visible/clickable
export const THINKER_BAR_HEIGHT = 24     // matches the point name-box height
export const EVENT_BAR_HEIGHT = 11       // shorter than EVENT_LANE_STEP so event rows never touch
export const BAR_LABEL_PADDING = 6       // inside-label horizontal padding (per side)
export const BAR_LABEL_GAP = 6           // gap between bar and a beside-label
export const BAR_RADIUS = 2
export const TETHER_COLOR = '#C9C2B6'    // low-contrast neutral dropline
export const TETHER_DOT_COLOR = '#8B4513' // accent dot at the axis
export const TETHER_DOT_RADIUS = 2
export const CURRENT_YEAR = new Date().getFullYear()

// Dark label colour used for text that sits on the light page background
// (beside-labels), so it always reads well against the cream canvas.
export const ON_CANVAS_LABEL_COLOR = '#1A1A1A'

// Past this many *visible* years the axis is so compressed that per-item
// droplines turn into clutter, so they're hidden (bars/markers still render).
export const TETHER_HIDE_YEAR_SPAN = 1200

// Event-type → bar fill (brown family, light→dark) and a 1-char type glyph so a
// ranged event stays distinguishable now that bars drop the per-type shape.
export const EVENT_TYPE_FILL: Record<string, string> = {
  council: '#A8662F',
  publication: '#8B4513',
  war: '#6B3410',
  invention: '#9C5A28',
  cultural: '#B07A3D',
  political: '#7A4012',
  other: '#8B5A2B',
}
export const EVENT_TYPE_GLYPH: Record<string, string> = {
  council: '△',
  publication: '▭',
  war: '◆',
  invention: '★',
  cultural: '●',
  political: '●',
  other: '●',
}
export const eventFill = (t: string) => EVENT_TYPE_FILL[t] ?? EVENT_TYPE_FILL.other
export const eventGlyph = (t: string) => EVENT_TYPE_GLYPH[t] ?? EVENT_TYPE_GLYPH.other

// Max width a label may occupy when it spills beside a (narrow) bar, so a long
// title never reserves an absurd footprint. Beyond this it is ellipsized.
export const MAX_BESIDE_LABEL_PX = 180

// Range metadata attached to a position entry when an item is drawn as a bar.
// If the label fits inside the bar it's drawn inside; otherwise it spills to the
// right ("beside"), truncated to `besideMaxPx`. The collision engine reserves
// the beside width too (see callers), so labels never overlap — titles stay
// visible by stacking vertically, even when zoomed out.
export interface BarMeta {
  x0: number
  x1: number
  ongoing: boolean
  labelText: string
  placement: 'inside' | 'beside'
  besideMaxPx: number
}

// Decide how a bar's label is laid out and how much horizontal footprint the
// collision engine must reserve. If the full label fits inside the bar it's
// 'inside' (footprint = bar). Otherwise it spills 'beside' the right edge,
// capped at MAX_BESIDE_LABEL_PX, and the footprint includes that beside width so
// stacking keeps titles from overlapping.
export function resolveBarLabelLayout(input: {
  measure: (s: string) => number
  labelText: string
  barWidthPx: number
  padding: number
  gap: number
  maxBesidePx: number
}): { placement: 'inside' | 'beside'; besideMaxPx: number; footprintWidth: number } {
  const { measure, labelText, barWidthPx, padding, gap, maxBesidePx } = input
  const full = measure(labelText)
  if (full <= barWidthPx - padding * 2) {
    return { placement: 'inside', besideMaxPx: 0, footprintWidth: barWidthPx }
  }
  const besideMaxPx = Math.min(full, maxBesidePx)
  return { placement: 'beside', besideMaxPx, footprintWidth: barWidthPx + gap + besideMaxPx }
}

// Ellipsize `text` to fit `maxWidth` using the given measure fn. Returns '' when
// there isn't room for even one character + ellipsis.
export function fitLabel(measure: (s: string) => number, text: string, maxWidth: number): string {
  if (maxWidth <= 0 || !text) return ''
  if (measure(text) <= maxWidth) return text
  const ell = '…'
  let lo = 0
  let hi = text.length
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2)
    if (measure(text.slice(0, mid) + ell) <= maxWidth) lo = mid
    else hi = mid - 1
  }
  return lo > 0 ? text.slice(0, lo) + ell : ''
}

// --- Accessibility: readable label colours (WCAG contrast) ----------------

const srgbToLinear = (c: number): number =>
  c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)

const hexToRgb = (hex: string): [number, number, number] => {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const n = parseInt(full, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

const relativeLuminance = (hex: string): number => {
  const [r, g, b] = hexToRgb(hex)
  return 0.2126 * srgbToLinear(r / 255) + 0.7152 * srgbToLinear(g / 255) + 0.0722 * srgbToLinear(b / 255)
}

/** WCAG 2.x contrast ratio between two hex colours (1–21, symmetric). */
export function contrastRatio(hexA: string, hexB: string): number {
  const la = relativeLuminance(hexA)
  const lb = relativeLuminance(hexB)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

/**
 * Pick whichever of `dark`/`light` has the higher WCAG contrast against `bg`,
 * so label text stays legible on any bar fill (e.g. white on dark brown)
 * instead of using a fixed colour that vanishes on dark fills.
 */
export function readableTextColor(
  bg: string,
  dark = ON_CANVAS_LABEL_COLOR,
  light = '#FFFFFF'
): string {
  return contrastRatio(light, bg) >= contrastRatio(dark, bg) ? light : dark
}

/** Whether vertical tethers should be drawn at the current zoom (year span). */
export function shouldShowTethers(
  visibleYearSpan: number,
  threshold = TETHER_HIDE_YEAR_SPAN
): boolean {
  return visibleYearSpan <= threshold
}

// --- Collision lane selection (stable across zoom) -------------------------

export interface ScoredLane {
  y: number
  width: number
  /** 0 = least compressed (widest label) — preferred. */
  compressionRank: number
  collisionCount: number
  collisionPenalty: number
  /** True when this lane is on the item's preferred (previous) side of the axis. */
  sameSide?: boolean
}

/**
 * Choose the most stable lane from scored candidates.
 *
 *  1. If any collision-free lanes exist: keep the item on its own side of the
 *     axis when a free lane exists there (avoids items flipping above↔below as
 *     the user zooms); then prefer the least compressed rank (wider labels);
 *     then pick the lane closest to `anchorY`.
 *  2. Otherwise minimise collisionCount, then collisionPenalty, then distance to
 *     `anchorY`.
 *
 * `anchorY` is the item's natural/default row, so within a side the item still
 * compacts toward the axis and moves as neighbours clear — it is the *side*,
 * not the exact row, that is sticky.
 */
export function chooseStableLane(candidates: ScoredLane[], anchorY: number): ScoredLane | null {
  if (candidates.length === 0) return null
  const dist = (c: ScoredLane) => Math.abs(c.y - anchorY)

  const free = candidates.filter((c) => c.collisionCount === 0)
  if (free.length > 0) {
    const sameSide = free.filter((c) => c.sameSide)
    const pool = sameSide.length > 0 ? sameSide : free
    const minRank = Math.min(...pool.map((c) => c.compressionRank))
    return pool
      .filter((c) => c.compressionRank === minRank)
      .reduce((best, c) => (dist(c) < dist(best) ? c : best))
  }

  return candidates.reduce((best, c) => {
    if (c.collisionCount !== best.collisionCount) return c.collisionCount < best.collisionCount ? c : best
    if (c.collisionPenalty !== best.collisionPenalty) return c.collisionPenalty < best.collisionPenalty ? c : best
    return dist(c) < dist(best) ? c : best
  })
}

export interface BarStyle {
  fill: string
  stroke: string
  lineWidth: number
  font: string
  glyph?: string
  /** Fill opacity (0–1) so connector lines behind the bar read through. */
  fillAlpha?: number
  /** Explicit inside-label colour; falls back to WCAG pick against `fill`. */
  textColor?: string
}

// A drawn-dot registry dedupes coincident axis dots (one per rounded x).
export type DotRegistry = Set<number>

export const drawTetherDot = (ctx: CanvasRenderingContext2D, x: number, axisY: number, registry?: DotRegistry) => {
  const key = Math.round(x)
  if (registry) {
    if (registry.has(key)) return
    registry.add(key)
  }
  ctx.save()
  ctx.fillStyle = TETHER_DOT_COLOR
  ctx.beginPath()
  ctx.arc(x, axisY, TETHER_DOT_RADIUS, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

export const drawTetherLine = (ctx: CanvasRenderingContext2D, x: number, fromY: number, axisY: number) => {
  if (Math.abs(axisY - fromY) <= 1) return
  ctx.save()
  ctx.strokeStyle = TETHER_COLOR
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(x, fromY)
  ctx.lineTo(x, axisY)
  ctx.stroke()
  ctx.restore()
}

// Bulk-selection checkbox drawn to the left of an item's left edge.
export const drawBulkCheckbox = (ctx: CanvasRenderingContext2D, leftX: number, y: number) => {
  const size = 12
  const cx = leftX - size - 4
  const cy = y - size / 2
  ctx.save()
  ctx.fillStyle = '#0284C7'
  ctx.fillRect(cx, cy, size, size)
  ctx.strokeStyle = '#FFFFFF'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(cx + 3, cy + 6)
  ctx.lineTo(cx + 5, cy + 9)
  ctx.lineTo(cx + 9, cy + 3)
  ctx.stroke()
  ctx.restore()
}

// Shared range-bar renderer: rounded bar, inside/beside label, and vertical
// tethers + dots to `axisY` (the timeline axis, or a lane centre in the
// combined view). An ongoing bar gets a square open right edge and no right-end
// tether (no asserted end date).
// Level-of-detail toggles. When the time axis is compressed (zoomed out) we
// drop tethers and any label that doesn't fit INSIDE its bar, so dense eras
// don't collapse into an illegible blob of overlapping labels + droplines.
export interface BarLOD {
  tether?: boolean       // draw the vertical tether(s) + dot(s)
  besideLabel?: boolean  // draw a label that spills beside the bar (doesn't fit inside)
}

export const drawBar = (
  ctx: CanvasRenderingContext2D,
  bar: BarMeta,
  y: number,
  height: number,
  style: BarStyle,
  axisY: number,
  dotRegistry?: DotRegistry,
  lod: BarLOD = {},
) => {
  const { tether = true } = lod
  const top = y - height / 2
  const w = bar.x1 - bar.x0
  const r = BAR_RADIUS

  ctx.save()
  ctx.beginPath()
  ctx.roundRect(bar.x0, top, w, height, bar.ongoing ? [r, 0, 0, r] : r)
  // Fill at reduced alpha so connector lines behind the bar read through; the
  // border is drawn at full opacity so the bar's extent stays crisp.
  ctx.fillStyle = style.fill
  ctx.globalAlpha = style.fillAlpha ?? 1
  ctx.fill()
  ctx.globalAlpha = 1
  ctx.strokeStyle = style.stroke
  ctx.lineWidth = style.lineWidth
  ctx.stroke()
  ctx.restore()

  // Label — inside the bar when it fits, otherwise spilled beside (to the right)
  // and ellipsized to its reserved width. Either way it never overlaps a
  // neighbour because the collision engine reserved the footprint.
  ctx.save()
  ctx.font = style.font
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  const measure = (s: string) => ctx.measureText(s).width
  if (bar.placement === 'inside') {
    // Inside text sits on the bar fill → pick a colour with WCAG-readable
    // contrast against it (e.g. white on dark brown).
    ctx.fillStyle = style.textColor ?? readableTextColor(style.fill)
    let lx = bar.x0 + BAR_LABEL_PADDING
    let avail = w - BAR_LABEL_PADDING * 2
    if (style.glyph && avail > 0) {
      const gw = measure(`${style.glyph} `)
      if (gw <= avail) { ctx.fillText(style.glyph, lx, y); lx += gw; avail -= gw }
    }
    const text = fitLabel(measure, bar.labelText, avail)
    if (text) ctx.fillText(text, lx, y)
  } else {
    // Beside text sits on the light page background → always dark.
    ctx.fillStyle = ON_CANVAS_LABEL_COLOR
    const text = fitLabel(measure, bar.labelText, bar.besideMaxPx)
    if (text) ctx.fillText(text, bar.x1 + BAR_LABEL_GAP, y)
  }
  ctx.restore()

  // Tethers: from the bar edge nearest the axis, to the axis.
  if (tether) {
    const fromY = y < axisY ? y + height / 2 : y - height / 2
    drawTetherLine(ctx, bar.x0, fromY, axisY)
    drawTetherDot(ctx, bar.x0, axisY, dotRegistry)
    if (!bar.ongoing) {
      drawTetherLine(ctx, bar.x1, fromY, axisY)
      drawTetherDot(ctx, bar.x1, axisY, dotRegistry)
    }
  }
}
