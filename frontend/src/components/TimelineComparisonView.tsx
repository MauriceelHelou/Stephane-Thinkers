'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { timelinesApi, thinkersApi, connectionsApi } from '@/lib/api'
import type { Timeline, Thinker, Connection } from '@/types'

interface TimelineComparisonViewProps {
  isOpen: boolean
  onClose: () => void
  onThinkerSelect?: (thinkerId: string) => void
}

interface ThinkerLifespan {
  thinker: Thinker
  startYear: number
  endYear: number
}

export function TimelineComparisonView({
  isOpen,
  onClose,
  onThinkerSelect,
}: TimelineComparisonViewProps) {
  const [leftTimelineId, setLeftTimelineId] = useState<string>('')
  const [rightTimelineId, setRightTimelineId] = useState<string>('')
  const [showOverlapsOnly, setShowOverlapsOnly] = useState(false)

  const { data: timelines = [] } = useQuery({
    queryKey: ['timelines'],
    queryFn: timelinesApi.getAll,
  })

  const { data: thinkers = [] } = useQuery({
    queryKey: ['thinkers'],
    queryFn: () => thinkersApi.getAll(),
  })

  const { data: connections = [] } = useQuery({
    queryKey: ['connections'],
    queryFn: connectionsApi.getAll,
  })

  // Get thinkers for each timeline
  const leftThinkers = useMemo(() => {
    if (!leftTimelineId) return []
    return thinkers.filter((t) => t.timeline_id === leftTimelineId)
  }, [thinkers, leftTimelineId])

  const rightThinkers = useMemo(() => {
    if (!rightTimelineId) return []
    return thinkers.filter((t) => t.timeline_id === rightTimelineId)
  }, [thinkers, rightTimelineId])

  // Calculate lifespans
  const getLifespan = (thinker: Thinker): ThinkerLifespan | null => {
    const startYear = thinker.birth_year
    const endYear = thinker.death_year || new Date().getFullYear()

    if (startYear === null && endYear === null) return null

    return {
      thinker,
      startYear: startYear || endYear - 80, // Estimate if missing
      endYear,
    }
  }

  const leftLifespans = useMemo(
    () => leftThinkers.map(getLifespan).filter(Boolean) as ThinkerLifespan[],
    [leftThinkers]
  )

  const rightLifespans = useMemo(
    () => rightThinkers.map(getLifespan).filter(Boolean) as ThinkerLifespan[],
    [rightThinkers]
  )

  // Find overlapping lifespans between timelines
  const overlaps = useMemo(() => {
    const result: {
      left: ThinkerLifespan
      right: ThinkerLifespan
      overlapStart: number
      overlapEnd: number
      hasConnection: boolean
    }[] = []

    leftLifespans.forEach((left) => {
      rightLifespans.forEach((right) => {
        const overlapStart = Math.max(left.startYear, right.startYear)
        const overlapEnd = Math.min(left.endYear, right.endYear)

        if (overlapStart <= overlapEnd) {
          // Check if there's a connection between them
          const hasConnection = connections.some(
            (c) =>
              (c.from_thinker_id === left.thinker.id &&
                c.to_thinker_id === right.thinker.id) ||
              (c.from_thinker_id === right.thinker.id &&
                c.to_thinker_id === left.thinker.id)
          )

          result.push({
            left,
            right,
            overlapStart,
            overlapEnd,
            hasConnection,
          })
        }
      })
    })

    return result.sort((a, b) => b.overlapEnd - b.overlapStart - (a.overlapEnd - a.overlapStart))
  }, [leftLifespans, rightLifespans, connections])

  // Calculate unified year range
  const yearRange = useMemo(() => {
    const allLifespans = [...leftLifespans, ...rightLifespans]
    if (allLifespans.length === 0) return { start: 1800, end: 2000 }

    const start = Math.min(...allLifespans.map((l) => l.startYear)) - 20
    const end = Math.max(...allLifespans.map((l) => l.endYear)) + 20

    return { start, end }
  }, [leftLifespans, rightLifespans])

  // Stats
  const stats = useMemo(() => {
    const overlappingLeftIds = new Set(overlaps.map((o) => o.left.thinker.id))
    const overlappingRightIds = new Set(overlaps.map((o) => o.right.thinker.id))
    const connectedOverlaps = overlaps.filter((o) => o.hasConnection)

    return {
      totalLeft: leftThinkers.length,
      totalRight: rightThinkers.length,
      overlappingPairs: overlaps.length,
      connectedPairs: connectedOverlaps.length,
      leftWithOverlap: overlappingLeftIds.size,
      rightWithOverlap: overlappingRightIds.size,
    }
  }, [leftThinkers, rightThinkers, overlaps])

  if (!isOpen) return null

  const selectedLeftTimeline = timelines.find((t) => t.id === leftTimelineId)
  const selectedRightTimeline = timelines.find((t) => t.id === rightTimelineId)

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-800">
            Timeline Comparison
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl"
          >
            &times;
          </button>
        </div>

        {/* Timeline Selectors */}
        <div className="flex gap-4 p-4 border-b bg-gray-50">
          <div className="flex-1">
            <label className="block text-sm text-gray-600 mb-1">
              Left Timeline
            </label>
            <select
              value={leftTimelineId}
              onChange={(e) => setLeftTimelineId(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm"
            >
              <option value="">Select timeline...</option>
              {timelines.map((t: Timeline) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <span className="text-gray-400 text-lg">vs</span>
          </div>
          <div className="flex-1">
            <label className="block text-sm text-gray-600 mb-1">
              Right Timeline
            </label>
            <select
              value={rightTimelineId}
              onChange={(e) => setRightTimelineId(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm"
            >
              <option value="">Select timeline...</option>
              {timelines.map((t: Timeline) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {leftTimelineId && rightTimelineId ? (
            <div className="space-y-6">
              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard
                  label={selectedLeftTimeline?.name || 'Left'}
                  value={`${stats.totalLeft} thinkers`}
                />
                <StatCard
                  label={selectedRightTimeline?.name || 'Right'}
                  value={`${stats.totalRight} thinkers`}
                />
                <StatCard
                  label="Temporal Overlaps"
                  value={stats.overlappingPairs}
                />
                <StatCard
                  label="Connected Pairs"
                  value={stats.connectedPairs}
                />
              </div>

              {/* Visual Timeline Comparison */}
              <div className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-gray-700">
                    Lifespan Comparison
                  </h3>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={showOverlapsOnly}
                      onChange={(e) => setShowOverlapsOnly(e.target.checked)}
                    />
                    Show overlaps only
                  </label>
                </div>

                {/* Year scale */}
                <div className="relative h-8 mb-2">
                  <div
                    className="absolute inset-0 flex items-center justify-between text-xs text-gray-400"
                    style={{ paddingLeft: '120px', paddingRight: '20px' }}
                  >
                    <span>{yearRange.start}</span>
                    <span>
                      {Math.round(
                        (yearRange.start + yearRange.end) / 2
                      )}
                    </span>
                    <span>{yearRange.end}</span>
                  </div>
                </div>

                {/* Left Timeline */}
                <div className="mb-6">
                  <div className="text-xs font-semibold text-gray-500 mb-2 pl-1">
                    {selectedLeftTimeline?.name}
                  </div>
                  {(showOverlapsOnly
                    ? leftLifespans.filter((l) =>
                        overlaps.some((o) => o.left.thinker.id === l.thinker.id)
                      )
                    : leftLifespans
                  )
                    .sort((a, b) => a.startYear - b.startYear)
                    .map((lifespan) => (
                      <LifespanBar
                        key={lifespan.thinker.id}
                        lifespan={lifespan}
                        yearRange={yearRange}
                        color="#2563EB"
                        hasOverlap={overlaps.some(
                          (o) => o.left.thinker.id === lifespan.thinker.id
                        )}
                        onClick={() =>
                          onThinkerSelect?.(lifespan.thinker.id)
                        }
                      />
                    ))}
                </div>

                {/* Right Timeline */}
                <div>
                  <div className="text-xs font-semibold text-gray-500 mb-2 pl-1">
                    {selectedRightTimeline?.name}
                  </div>
                  {(showOverlapsOnly
                    ? rightLifespans.filter((l) =>
                        overlaps.some(
                          (o) => o.right.thinker.id === l.thinker.id
                        )
                      )
                    : rightLifespans
                  )
                    .sort((a, b) => a.startYear - b.startYear)
                    .map((lifespan) => (
                      <LifespanBar
                        key={lifespan.thinker.id}
                        lifespan={lifespan}
                        yearRange={yearRange}
                        color="#16A34A"
                        hasOverlap={overlaps.some(
                          (o) => o.right.thinker.id === lifespan.thinker.id
                        )}
                        onClick={() =>
                          onThinkerSelect?.(lifespan.thinker.id)
                        }
                      />
                    ))}
                </div>
              </div>

              {/* Overlap Details */}
              {overlaps.length > 0 && (
                <div className="border rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">
                    Temporal Overlaps ({overlaps.length} pairs)
                  </h3>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {overlaps.slice(0, 50).map((overlap, i) => (
                      <div
                        key={i}
                        className={`flex items-center justify-between py-2 px-3 rounded ${
                          overlap.hasConnection
                            ? 'bg-green-50 border border-green-200'
                            : 'bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <span
                            className="text-sm cursor-pointer hover:underline text-blue-600"
                            onClick={() =>
                              onThinkerSelect?.(overlap.left.thinker.id)
                            }
                          >
                            {overlap.left.thinker.name}
                          </span>
                          <span className="text-gray-400">&harr;</span>
                          <span
                            className="text-sm cursor-pointer hover:underline text-green-600"
                            onClick={() =>
                              onThinkerSelect?.(overlap.right.thinker.id)
                            }
                          >
                            {overlap.right.thinker.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-500">
                            {overlap.overlapStart}-{overlap.overlapEnd} (
                            {overlap.overlapEnd - overlap.overlapStart} years)
                          </span>
                          {overlap.hasConnection && (
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                              Connected
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              Select two timelines to compare
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3">
      <div className="text-xl font-semibold text-gray-800">{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  )
}

function LifespanBar({
  lifespan,
  yearRange,
  color,
  hasOverlap,
  onClick,
}: {
  lifespan: ThinkerLifespan
  yearRange: { start: number; end: number }
  color: string
  hasOverlap: boolean
  onClick?: () => void
}) {
  const totalYears = yearRange.end - yearRange.start
  const leftPercent =
    ((lifespan.startYear - yearRange.start) / totalYears) * 100
  const widthPercent =
    ((lifespan.endYear - lifespan.startYear) / totalYears) * 100

  return (
    <div className="flex items-center h-6 mb-1 group">
      <div className="w-28 text-xs text-gray-600 truncate pr-2 flex-shrink-0">
        {lifespan.thinker.name}
      </div>
      <div className="flex-1 relative h-4 bg-gray-100 rounded overflow-hidden">
        <div
          className={`absolute h-full rounded cursor-pointer transition-opacity ${
            hasOverlap ? 'opacity-100' : 'opacity-60 group-hover:opacity-100'
          }`}
          style={{
            left: `${leftPercent}%`,
            width: `${Math.max(widthPercent, 0.5)}%`,
            backgroundColor: color,
          }}
          onClick={onClick}
          title={`${lifespan.thinker.name}: ${lifespan.startYear}-${lifespan.endYear}`}
        />
      </div>
      <div className="w-16 text-xs text-gray-400 text-right pl-2 flex-shrink-0">
        {lifespan.startYear}-{lifespan.endYear}
      </div>
    </div>
  )
}
