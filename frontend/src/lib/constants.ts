// Timeline constants shared between components

/**
 * Reference canvas width used for position calculations.
 * This is the "standard" width that positions are calculated against.
 * The actual canvas may be larger or smaller, and positions will be scaled accordingly.
 */
export const REFERENCE_CANVAS_WIDTH = 1200

/**
 * Default year range for timelines when not specified
 */
export const DEFAULT_START_YEAR = 1800
export const DEFAULT_END_YEAR = 2050

/**
 * Timeline layout constants
 */
export const TIMELINE_PADDING = 100 // Left/right padding
export const TIMELINE_CONTENT_WIDTH_PERCENT = 0.8 // 80% of canvas is timeline content

/**
 * Helper function to convert a year to an X position
 * This matches the calculation used in Timeline component
 */
export function yearToXPosition(
  year: number,
  startYear: number = DEFAULT_START_YEAR,
  endYear: number = DEFAULT_END_YEAR,
  referenceWidth: number = REFERENCE_CANVAS_WIDTH
): number {
  const yearSpan = endYear - startYear
  const pixelsPerYear = (referenceWidth * TIMELINE_CONTENT_WIDTH_PERCENT) / yearSpan
  return TIMELINE_PADDING + (year - startYear) * pixelsPerYear
}

/**
 * Connection visualization styles
 * Each connection type has a distinct color and optional dash pattern
 */
export const CONNECTION_STYLES = {
  influenced: {
    color: '#2563EB', // Blue - positive influence
    highlightColor: '#1D4ED8',
    dashPattern: [], // Solid line
    label: 'Influenced',
  },
  critiqued: {
    color: '#DC2626', // Red - critical engagement
    highlightColor: '#B91C1C',
    dashPattern: [8, 4], // Dashed line
    label: 'Critiqued',
  },
  built_upon: {
    color: '#16A34A', // Green - constructive building
    highlightColor: '#15803D',
    dashPattern: [], // Solid line
    label: 'Built Upon',
  },
  synthesized: {
    color: '#9333EA', // Purple - combination/synthesis
    highlightColor: '#7E22CE',
    dashPattern: [4, 2], // Short dashes
    label: 'Synthesized',
  },
} as const

export type ConnectionStyleType = keyof typeof CONNECTION_STYLES

/**
 * Calculate line width based on connection strength (1-5)
 * Returns width between 1 and 4 pixels
 */
export function getConnectionLineWidth(strength: number | null | undefined): number {
  const s = strength ?? 3 // Default to 3 if not specified
  return 1 + ((s - 1) / 4) * 3 // Maps 1-5 to 1-4 pixels
}
