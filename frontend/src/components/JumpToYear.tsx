'use client'

import { useState, useCallback } from 'react'
import { DEFAULT_START_YEAR, DEFAULT_END_YEAR, TIMELINE_CONTENT_WIDTH_PERCENT } from '@/lib/constants'
import type { Timeline as TimelineType } from '@/types'

interface JumpToYearProps {
  scale: number
  canvasWidth: number
  onNavigate: (offsetX: number) => void
  selectedTimeline?: TimelineType | null
  startYear?: number
  endYear?: number
}

export function JumpToYear({
  scale,
  canvasWidth,
  onNavigate,
  selectedTimeline,
  startYear: propStartYear,
  endYear: propEndYear,
}: JumpToYearProps) {
  const [inputValue, setInputValue] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const startYear = propStartYear || selectedTimeline?.start_year || DEFAULT_START_YEAR
  const endYear = propEndYear || selectedTimeline?.end_year || DEFAULT_END_YEAR

  const handleJump = useCallback(() => {
    const year = parseInt(inputValue)

    if (isNaN(year)) {
      setError('Please enter a valid year')
      return
    }

    if (year < startYear || year > endYear) {
      setError(`Year must be between ${startYear} and ${endYear}`)
      return
    }

    setError(null)

    // Calculate offset to center on the specified year
    const yearSpan = endYear - startYear
    const pixelsPerYear = ((canvasWidth * TIMELINE_CONTENT_WIDTH_PERCENT) / yearSpan)

    // Calculate the X position for the target year
    const yearPosition = (year - startYear) * pixelsPerYear * scale

    // Center the viewport on this position
    const newOffsetX = canvasWidth / 2 - yearPosition

    onNavigate(newOffsetX)
    setIsOpen(false)
    setInputValue('')
  }, [inputValue, startYear, endYear, canvasWidth, scale, onNavigate])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleJump()
    } else if (e.key === 'Escape') {
      setIsOpen(false)
      setInputValue('')
      setError(null)
    }
  }

  // Quick navigation buttons for significant dates
  const quickJumps = [
    { label: 'Start', year: startYear },
    { label: 'Mid', year: Math.floor((startYear + endYear) / 2) },
    { label: 'End', year: endYear },
  ]

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="px-3 py-2 bg-white border border-timeline rounded shadow-sm hover:bg-gray-50 font-sans text-sm flex items-center gap-1"
        title="Jump to year (J)"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        Jump to Year
      </button>
    )
  }

  return (
    <div className="bg-white border border-timeline rounded shadow-lg p-3 min-w-[200px]">
      <div className="flex items-center gap-2 mb-2">
        <input
          type="text"
          inputMode="numeric"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value)
            setError(null)
          }}
          onKeyDown={handleKeyDown}
          placeholder={`${startYear} to ${endYear}`}
          className="flex-1 px-2 py-1 border border-gray-300 rounded font-mono text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          autoFocus
        />
        <button
          onClick={handleJump}
          className="px-2 py-1 bg-accent text-white rounded text-sm hover:bg-opacity-90"
        >
          Go
        </button>
        <button
          onClick={() => {
            setIsOpen(false)
            setInputValue('')
            setError(null)
          }}
          className="text-gray-400 hover:text-gray-600"
        >
          ×
        </button>
      </div>

      {error && (
        <p className="text-red-500 text-xs mb-2">{error}</p>
      )}

      <div className="flex gap-1">
        {quickJumps.map(({ label, year }) => (
          <button
            key={label}
            onClick={() => {
              setInputValue(year.toString())
              setError(null)
            }}
            className="flex-1 px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-xs font-mono"
          >
            {label}
            <br />
            <span className="text-gray-500">{year}</span>
          </button>
        ))}
      </div>

      <p className="text-xs text-gray-400 mt-2">
        Use negative for BCE (e.g., -500)
      </p>
    </div>
  )
}
