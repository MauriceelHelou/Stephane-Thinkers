'use client'

import type { TimelineBootstrapCommitResponse } from '@/types'

interface TimelineBootstrapCommitResultProps {
  result: TimelineBootstrapCommitResponse
  onOpenTimeline: (timelineId: string) => void
}

export function TimelineBootstrapCommitResult({ result, onOpenTimeline }: TimelineBootstrapCommitResultProps) {
  const createdEntries = Object.entries(result.created_counts)
  const skippedEntries = Object.entries(result.skipped_counts)

  return (
    <div className="space-y-3 rounded border border-emerald-200 bg-emerald-50 p-3 text-xs">
      <h4 className="text-sm font-semibold text-emerald-900">Timeline committed</h4>

      <div className="space-y-1">
        <p className="font-medium text-emerald-900">Created counts</p>
        {createdEntries.map(([key, value]) => (
          <p key={key} className="text-emerald-800">
            {key}: {value}
          </p>
        ))}
      </div>

      <div className="space-y-1">
        <p className="font-medium text-emerald-900">Skipped counts</p>
        {skippedEntries.map(([key, value]) => (
          <p key={key} className="text-emerald-800">
            {key}: {value}
          </p>
        ))}
      </div>

      {result.warnings.length > 0 && (
        <div className="space-y-1">
          <p className="font-medium text-amber-900">Warnings</p>
          {result.warnings.map((warning, index) => (
            <p key={`${index}-${warning}`} className="text-amber-800">
              {warning}
            </p>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => onOpenTimeline(result.timeline_id)}
        className="rounded bg-emerald-700 px-2 py-1 text-xs font-medium text-white"
      >
        Open timeline
      </button>
    </div>
  )
}
