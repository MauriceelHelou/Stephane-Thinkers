'use client'

import { useMemo } from 'react'
import { DEFAULT_START_YEAR, DEFAULT_END_YEAR, TIMELINE_CONTENT_WIDTH_PERCENT } from '@/lib/constants'
import type { Timeline as TimelineType } from '@/types'

interface RulerIndicatorProps {
  scale: number
  canvasWidth: number
  selectedTimeline?: TimelineType | null
  startYear?: number
  endYear?: number
}

export function RulerIndicator({
  scale,
  canvasWidth,
  selectedTimeline,
  startYear: propStartYear,
  endYear: propEndYear,
}: RulerIndicatorProps) {
  const startYear = propStartYear || selectedTimeline?.start_year || DEFAULT_START_YEAR
  const endYear = propEndYear || selectedTimeline?.end_year || DEFAULT_END_YEAR

  // Calculate the visible year span based on current viewport and zoom
  const visibleYearSpan = useMemo(() => {
    const yearSpan = endYear - startYear
    const pixelsPerYear = ((canvasWidth * TIMELINE_CONTENT_WIDTH_PERCENT) / yearSpan) * scale

    // Viewport shows canvasWidth pixels
    const yearsInViewport = canvasWidth / pixelsPerYear

    return Math.round(yearsInViewport)
  }, [scale, canvasWidth, startYear, endYear])

  // Calculate a nice scale bar length
  const scaleBarInfo = useMemo(() => {
    // Find a nice round number that fits well in the UI
    const niceIntervals = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000]

    // Target about 100-150 pixels for the scale bar
    const yearSpan = endYear - startYear
    const pixelsPerYear = ((canvasWidth * TIMELINE_CONTENT_WIDTH_PERCENT) / yearSpan) * scale

    const targetPixels = 100
    const targetYears = targetPixels / pixelsPerYear

    // Find the closest nice interval
    let scaleYears = niceIntervals[0]
    for (const interval of niceIntervals) {
      if (interval <= targetYears * 1.5) {
        scaleYears = interval
      }
    }

    const scalePixels = scaleYears * pixelsPerYear

    return {
      years: scaleYears,
      pixels: Math.round(scalePixels),
    }
  }, [scale, canvasWidth, startYear, endYear])

  // Format the year span label
  const formatYearSpan = (years: number): string => {
    if (years >= 1000) {
      return `${years / 1000}k years`
    }
    if (years === 1) {
      return '1 year'
    }
    return `${years} years`
  }

  return (
    <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-sm border border-gray-200 px-3 py-2">
      <div className="flex flex-col gap-1">
        {/* Scale bar */}
        <div className="flex items-center gap-2">
          <div
            className="h-1 bg-gray-400 rounded relative"
            style={{ width: `${Math.min(scaleBarInfo.pixels, 150)}px` }}
          >
            {/* End caps */}
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-px h-2 bg-gray-400" />
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-px h-2 bg-gray-400" />
          </div>
          <span className="text-xs font-mono text-gray-600">
            {formatYearSpan(scaleBarInfo.years)}
          </span>
        </div>

        {/* Viewport info */}
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span>Viewing ~{visibleYearSpan} years</span>
          <span className="text-gray-300">|</span>
          <span>{Math.round(scale * 100)}% zoom</span>
        </div>
      </div>
    </div>
  )
}
