'use client'

import { useState, useRef, useEffect } from 'react'
import { DEFAULT_START_YEAR, DEFAULT_END_YEAR } from '@/lib/constants'
import type { Timeline } from '@/types'

interface YearPickerProps {
  selectedYear: number | null
  onYearSelect: (year: number) => void
  timeline: Timeline | null
  label?: string
}

export function YearPicker({ selectedYear, onYearSelect, timeline, label = 'Select Year' }: YearPickerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [hoveredYear, setHoveredYear] = useState<number | null>(null)

  const startYear = timeline?.start_year || DEFAULT_START_YEAR
  const endYear = timeline?.end_year || DEFAULT_END_YEAR

  // Helper function to convert year to X position
  const yearToX = (year: number, canvasWidth: number): number => {
    const yearSpan = endYear - startYear
    const pixelsPerYear = (canvasWidth - 40) / yearSpan
    return 20 + (year - startYear) * pixelsPerYear
  }

  // Helper function to convert X position to year
  const xToYear = (x: number, canvasWidth: number): number => {
    const yearSpan = endYear - startYear
    const pixelsPerYear = (canvasWidth - 40) / yearSpan
    const year = startYear + Math.round((x - 20) / pixelsPerYear)
    return Math.max(startYear, Math.min(endYear, year))
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = canvas.offsetWidth
    canvas.height = 80

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Draw timeline
    ctx.strokeStyle = '#E0E0E0'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(20, 40)
    ctx.lineTo(canvas.width - 20, 40)
    ctx.stroke()

    // Draw year markers
    ctx.fillStyle = '#666666'
    ctx.font = '10px "JetBrains Mono", monospace'
    ctx.textAlign = 'center'

    const yearSpan = endYear - startYear
    let interval = 50
    if (yearSpan <= 100) interval = 10
    else if (yearSpan <= 200) interval = 20
    else if (yearSpan <= 500) interval = 50
    else interval = 100

    for (let year = Math.ceil(startYear / interval) * interval; year <= endYear; year += interval) {
      const x = yearToX(year, canvas.width)
      ctx.fillText(year.toString(), x, 60)

      ctx.strokeStyle = '#CCCCCC'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x, 35)
      ctx.lineTo(x, 45)
      ctx.stroke()
    }

    // Draw selected year marker
    if (selectedYear !== null) {
      const x = yearToX(selectedYear, canvas.width)
      ctx.fillStyle = '#8B4513'
      ctx.beginPath()
      ctx.arc(x, 40, 6, 0, Math.PI * 2)
      ctx.fill()

      // Draw year label
      ctx.fillStyle = '#1A1A1A'
      ctx.font = 'bold 12px "JetBrains Mono", monospace'
      ctx.fillText(selectedYear.toString(), x, 25)
    }

    // Draw hovered year marker
    if (hoveredYear !== null && hoveredYear !== selectedYear) {
      const x = yearToX(hoveredYear, canvas.width)
      ctx.fillStyle = '#CCCCCC'
      ctx.beginPath()
      ctx.arc(x, 40, 4, 0, Math.PI * 2)
      ctx.fill()

      ctx.fillStyle = '#666666'
      ctx.font = '11px "JetBrains Mono", monospace'
      ctx.fillText(hoveredYear.toString(), x, 25)
    }
  }, [selectedYear, hoveredYear, startYear, endYear])

  const handleMouseMove = (e: React.MouseEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const year = xToYear(x, canvas.width)
    setHoveredYear(year)
  }

  const handleMouseLeave = () => {
    setHoveredYear(null)
  }

  const handleClick = (e: React.MouseEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const year = xToYear(x, canvas.width)
    onYearSelect(year)
  }

  return (
    <div>
      <label className="block text-sm font-sans font-medium text-primary mb-2">
        {label}
        {selectedYear !== null && (
          <span className="ml-2 font-mono text-accent">{selectedYear}</span>
        )}
      </label>
      <canvas
        ref={canvasRef}
        className="w-full border border-timeline rounded cursor-crosshair"
        style={{ height: '80px' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
      />
      <p className="text-xs text-secondary mt-1 font-sans">
        Click on the timeline to select a year for positioning
      </p>
    </div>
  )
}
