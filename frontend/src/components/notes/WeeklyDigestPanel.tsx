'use client'

import { Fragment, useMemo } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'

import { analysisApi } from '@/lib/api'
import {
  extractEvidenceIdsFromText,
  formatPlanningEvidenceLabel,
  type PlanningEvidenceRef,
  usePlanningEvidenceMap,
} from './planningEvidence'

function lastSevenDayWindow(): { start: string; end: string } {
  const end = new Date()
  const start = new Date(end)
  start.setDate(end.getDate() - 6)

  const toDate = (value: Date) => value.toISOString().slice(0, 10)
  return { start: toDate(start), end: toDate(end) }
}

interface WeeklyDigestPanelProps {
  onNavigateToNote?: (noteId: string) => void
}

export function WeeklyDigestPanel({ onNavigateToNote }: WeeklyDigestPanelProps) {
  const renderDigestLine = (
    line: string,
    evidenceMap: Map<string, PlanningEvidenceRef>,
    onNavigateToNote?: (noteId: string) => void
  ) => {
    const uuidRegex = /\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/g
    const matches = line.match(uuidRegex)
    if (!matches || matches.length === 0) return line

    const parts = line.split(uuidRegex)
    return (
      <>
        {parts.map((part, index) => {
          const ref = matches[index]
          if (!ref) return <Fragment key={`digest-end-${index}`}>{part}</Fragment>
          const resolved = evidenceMap.get(ref)
          const label = formatPlanningEvidenceLabel(ref, resolved)
          const canOpenNote = resolved?.kind === 'note' && Boolean(onNavigateToNote)
          return (
            <Fragment key={`digest-${ref}-${index}`}>
              {part}
              {canOpenNote ? (
                <button
                  type="button"
                  onClick={() => onNavigateToNote?.(ref)}
                  className="inline text-accent hover:underline"
                >
                  {label}
                </button>
              ) : (
                <span className="inline text-secondary">{label}</span>
              )}
            </Fragment>
          )
        })}
      </>
    )
  }

  const range = lastSevenDayWindow()
  const latestQuery = useQuery({
    queryKey: ['weekly-digest-latest'],
    queryFn: () => analysisApi.getLatestWeeklyDigest(),
    retry: false,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  const createMutation = useMutation({
    mutationFn: () => analysisApi.createWeeklyDigest(range.start, range.end),
    onSuccess: () => latestQuery.refetch(),
  })
  const digestText = latestQuery.data?.digest_markdown ?? ''
  const evidenceRefs = useMemo(() => extractEvidenceIdsFromText(digestText), [digestText])
  const evidenceMap = usePlanningEvidenceMap(evidenceRefs)

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => createMutation.mutate()}
        className="px-2 py-1 text-xs rounded bg-accent text-white"
        disabled={createMutation.isPending}
      >
        {createMutation.isPending ? 'Generating...' : 'Generate weekly digest'}
      </button>

      {latestQuery.data ? (
        <div className="text-xs whitespace-pre-wrap p-2 bg-gray-50 border border-gray-100 rounded space-y-1">
          {latestQuery.data.digest_markdown.split('\n').map((line, index) => (
            <p key={index} className="break-words">
              {renderDigestLine(line, evidenceMap, onNavigateToNote)}
            </p>
          ))}
        </div>
      ) : latestQuery.isError ? (
        <p className="text-xs text-secondary">No weekly digest generated yet.</p>
      ) : (
        <p className="text-xs text-secondary">No weekly digest generated yet.</p>
      )}
    </div>
  )
}
