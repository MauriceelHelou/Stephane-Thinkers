'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface TimelineAnimationControlsProps {
  startYear: number
  endYear: number
  currentYear: number | null
  onYearChange: (year: number | null) => void
  isPlaying: boolean
  onPlayPauseToggle: () => void
  speed: number
  onSpeedChange: (speed: number) => void
}

export function TimelineAnimationControls({
  startYear,
  endYear,
  currentYear,
  onYearChange,
  isPlaying,
  onPlayPauseToggle,
  speed,
  onSpeedChange,
}: TimelineAnimationControlsProps) {
  const progressRef = useRef<HTMLDivElement>(null)

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = progressRef.current?.getBoundingClientRect()
    if (!rect) return

    const x = e.clientX - rect.left
    const percent = x / rect.width
    const year = Math.round(startYear + percent * (endYear - startYear))
    onYearChange(Math.max(startYear, Math.min(endYear, year)))
  }

  const handleReset = () => {
    onYearChange(null)
  }

  const progressPercent = currentYear
    ? ((currentYear - startYear) / (endYear - startYear)) * 100
    : 100

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
      <div className="flex items-center gap-3 mb-2">
        {/* Play/Pause button */}
        <button
          onClick={onPlayPauseToggle}
          className={`w-8 h-8 flex items-center justify-center rounded-full ${
            isPlaying
              ? 'bg-red-100 text-red-600 hover:bg-red-200'
              : 'bg-green-100 text-green-600 hover:bg-green-200'
          }`}
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="4" width="4" height="16" />
              <rect x="14" y="4" width="4" height="16" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <polygon points="5,3 19,12 5,21" />
            </svg>
          )}
        </button>

        {/* Reset button */}
        <button
          onClick={handleReset}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200"
          title="Reset (show all)"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </button>

        {/* Current year display */}
        <div className="flex-1 text-center">
          <span className="text-lg font-semibold text-gray-800">
            {currentYear !== null ? currentYear : 'All Time'}
          </span>
        </div>

        {/* Speed control */}
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-500">Speed:</span>
          <select
            value={speed}
            onChange={(e) => onSpeedChange(Number(e.target.value))}
            className="text-xs border rounded px-1 py-0.5"
          >
            <option value={0.5}>0.5x</option>
            <option value={1}>1x</option>
            <option value={2}>2x</option>
            <option value={5}>5x</option>
            <option value={10}>10x</option>
          </select>
        </div>
      </div>

      {/* Progress bar */}
      <div
        ref={progressRef}
        className="relative h-2 bg-gray-200 rounded-full cursor-pointer"
        onClick={handleProgressClick}
      >
        <div
          className="absolute top-0 left-0 h-full bg-accent rounded-full transition-all"
          style={{ width: `${progressPercent}%` }}
        />
        {currentYear !== null && (
          <div
            className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-accent rounded-full border-2 border-white shadow"
            style={{ left: `calc(${progressPercent}% - 8px)` }}
          />
        )}
      </div>

      {/* Year range labels */}
      <div className="flex justify-between mt-1 text-xs text-gray-400">
        <span>{startYear}</span>
        <span>{endYear}</span>
      </div>
    </div>
  )
}

// Hook for managing animation state
export function useTimelineAnimation(startYear: number, endYear: number) {
  const [currentYear, setCurrentYear] = useState<number | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeed] = useState(2)
  const animationRef = useRef<NodeJS.Timeout | null>(null)

  const stopAnimation = useCallback(() => {
    if (animationRef.current) {
      clearInterval(animationRef.current)
      animationRef.current = null
    }
    setIsPlaying(false)
  }, [])

  const startAnimation = useCallback(() => {
    // Start from beginning if at end or null
    if (currentYear === null || currentYear >= endYear) {
      setCurrentYear(startYear)
    }
    setIsPlaying(true)
  }, [currentYear, startYear, endYear])

  const togglePlayPause = useCallback(() => {
    if (isPlaying) {
      stopAnimation()
    } else {
      startAnimation()
    }
  }, [isPlaying, stopAnimation, startAnimation])

  // Animation loop
  useEffect(() => {
    if (!isPlaying) return

    const interval = 1000 / speed // Base interval adjusted by speed
    animationRef.current = setInterval(() => {
      setCurrentYear((prev) => {
        if (prev === null) return startYear
        const next = prev + 1
        if (next > endYear) {
          stopAnimation()
          return endYear
        }
        return next
      })
    }, interval)

    return () => {
      if (animationRef.current) {
        clearInterval(animationRef.current)
      }
    }
  }, [isPlaying, speed, startYear, endYear, stopAnimation])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        clearInterval(animationRef.current)
      }
    }
  }, [])

  return {
    currentYear,
    setCurrentYear,
    isPlaying,
    togglePlayPause,
    speed,
    setSpeed,
    stopAnimation,
  }
}
