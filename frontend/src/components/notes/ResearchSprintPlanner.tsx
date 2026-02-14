'use client'

import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { analysisApi } from '@/lib/api'
import { formatPlanningEvidenceLabel, usePlanningEvidenceMap } from './planningEvidence'

function previewText(value: string, maxChars: number): string {
  const normalized = value.trim()
  if (normalized.length <= maxChars) return normalized
  return `${normalized.slice(0, maxChars).trim()}...`
}

interface ResearchSprintPlannerProps {
  onNavigateToNote?: (noteId: string) => void
}

export function ResearchSprintPlanner({ onNavigateToNote }: ResearchSprintPlannerProps) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['research-sprint-plan'],
    queryFn: () => analysisApi.getResearchSprintPlan('all notes'),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
  const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set())
  const tasks = data?.tasks ?? []
  const evidenceRefs = useMemo(() => tasks.flatMap((task) => task.evidence_refs || []), [tasks])
  const evidenceMap = usePlanningEvidenceMap(evidenceRefs)

  useEffect(() => {
    setExpandedCards(new Set())
  }, [data?.tasks.length])

  if (isLoading) return <p className="text-xs text-secondary">Generating sprint plan...</p>
  if (isError) return <p className="text-xs text-secondary">Could not generate sprint plan right now.</p>
  if (!data) return null

  const expandAll = () => {
    setExpandedCards(new Set(data.tasks.map((_, index) => index)))
  }

  const collapseAll = () => {
    setExpandedCards(new Set())
  }

  const toggleCard = (index: number) => {
    setExpandedCards((prev) => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-xs font-semibold text-primary">Research Sprint</h4>
        {data.tasks.length > 0 && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={expandAll}
              className="px-2 py-1 text-[11px] rounded border border-gray-200 text-secondary hover:text-primary"
            >
              Expand all
            </button>
            <button
              type="button"
              onClick={collapseAll}
              className="px-2 py-1 text-[11px] rounded border border-gray-200 text-secondary hover:text-primary"
            >
              Collapse all
            </button>
          </div>
        )}
      </div>
      {data.tasks.map((task, idx) => (
        <div key={idx} className="w-full rounded border border-gray-200 bg-white hover:border-accent/60">
          <button
            type="button"
            onClick={() => toggleCard(idx)}
            aria-expanded={expandedCards.has(idx)}
            className="w-full p-2 text-left"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs font-medium text-primary break-words">
                {idx + 1}. {expandedCards.has(idx) ? task.title : previewText(task.title, 92)}
              </p>
              <span className="shrink-0 text-[11px] text-secondary">
                {expandedCards.has(idx) ? 'Collapse' : 'Expand'}
              </span>
            </div>
            <p className="mt-1 text-xs text-secondary break-words">
              {expandedCards.has(idx) ? task.rationale : previewText(task.rationale, 140)}
            </p>
            {task.evidence_refs.length > 0 && !expandedCards.has(idx) && (
              <p className="mt-1 text-[11px] text-secondary">
                Evidence: {task.evidence_refs.length} refs (click to view)
              </p>
            )}
          </button>

          {task.evidence_refs.length > 0 && expandedCards.has(idx) && (
            <div className="px-2 pb-2 border-t border-gray-100 space-y-0.5">
              <p className="pt-1 text-[11px] font-medium text-secondary">Evidence</p>
              {task.evidence_refs.map((ref) => {
                const resolved = evidenceMap.get(ref)
                const label = formatPlanningEvidenceLabel(ref, resolved)
                const canOpenNote = resolved?.kind === 'note' && Boolean(onNavigateToNote)

                if (!canOpenNote) {
                  return (
                    <p key={ref} className="text-[11px] text-secondary break-words">
                      • {label}
                    </p>
                  )
                }

                return (
                  <button
                    key={ref}
                    type="button"
                    onClick={() => onNavigateToNote?.(ref)}
                    className="block w-full text-left text-[11px] text-accent hover:underline break-words"
                  >
                    • {label}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
