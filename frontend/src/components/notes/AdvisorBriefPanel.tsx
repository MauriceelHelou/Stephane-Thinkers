'use client'

import { Fragment, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { analysisApi } from '@/lib/api'
import {
  extractEvidenceIdsFromTexts,
  formatPlanningEvidenceLabel,
  type PlanningEvidenceRef,
  usePlanningEvidenceMap,
} from './planningEvidence'

type BriefSectionKey = 'highlights' | 'decisions' | 'risks'

function previewText(value: string, maxChars: number): string {
  const normalized = value.trim()
  if (normalized.length <= maxChars) return normalized
  return `${normalized.slice(0, maxChars).trim()}...`
}

const UUID_REGEX = /\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/g

interface AdvisorBriefPanelProps {
  onNavigateToNote?: (noteId: string) => void
}

function renderEvidenceAwareText(
  text: string,
  evidenceMap: Map<string, PlanningEvidenceRef>,
  onNavigateToNote?: (noteId: string) => void
) {
  const matches = text.match(UUID_REGEX)
  if (!matches || matches.length === 0) {
    return text
  }

  const parts = text.split(UUID_REGEX)
  return (
    <>
      {parts.map((part, index) => {
        const ref = matches[index]
        if (!ref) {
          return <Fragment key={`part-end-${index}`}>{part}</Fragment>
        }
        const resolved = evidenceMap.get(ref)
        const label = formatPlanningEvidenceLabel(ref, resolved)
        const canOpenNote = resolved?.kind === 'note' && Boolean(onNavigateToNote)
        return (
          <Fragment key={`part-${ref}-${index}`}>
            {part}
            {canOpenNote ? (
              <button
                type="button"
                onClick={() => onNavigateToNote?.(ref)}
                className="inline text-[11px] text-accent hover:underline"
              >
                {label}
              </button>
            ) : (
              <span className="inline text-[11px] text-secondary">{label}</span>
            )}
          </Fragment>
        )
      })}
    </>
  )
}

export function AdvisorBriefPanel({ onNavigateToNote }: AdvisorBriefPanelProps) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['advisor-brief'],
    queryFn: () => analysisApi.getAdvisorBrief('last 7 days'),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
  const [expandedSections, setExpandedSections] = useState<Record<BriefSectionKey, boolean>>({
    highlights: true,
    decisions: false,
    risks: false,
  })
  const sections = useMemo(
    () => [
      { key: 'highlights' as const, title: 'Highlights', items: data?.highlights ?? [] },
      { key: 'decisions' as const, title: 'Decisions Needed', items: data?.decisions_needed ?? [] },
      { key: 'risks' as const, title: 'Open Risks', items: data?.open_risks ?? [] },
    ],
    [data]
  )
  const evidenceRefs = useMemo(
    () => extractEvidenceIdsFromTexts(sections.flatMap((section) => section.items)),
    [sections]
  )
  const evidenceMap = usePlanningEvidenceMap(evidenceRefs)

  if (isLoading) return <p className="text-xs text-secondary">Preparing advisor brief...</p>
  if (isError) return <p className="text-xs text-secondary">Could not generate advisor brief right now.</p>
  if (!data) return null

  const toggleSection = (key: BriefSectionKey) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const expandAll = () => {
    setExpandedSections({ highlights: true, decisions: true, risks: true })
  }

  const collapseAll = () => {
    setExpandedSections({ highlights: false, decisions: false, risks: false })
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-xs font-semibold text-primary">Advisor Brief</h4>
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
      </div>

      {sections.map((section) => {
        const isExpanded = expandedSections[section.key]
        return (
          <div key={section.key} className="rounded border border-gray-200 bg-white">
            <button
              type="button"
              onClick={() => toggleSection(section.key)}
              aria-expanded={isExpanded}
              className="w-full px-2 py-1.5 flex items-center justify-between text-left"
            >
              <span className="text-xs font-medium text-primary">{section.title}</span>
              <span className="text-[11px] text-secondary">
                {section.items.length} {section.items.length === 1 ? 'item' : 'items'} ·{' '}
                {isExpanded ? 'Collapse' : 'Expand'}
              </span>
            </button>

            {isExpanded ? (
              <div className="px-2 pb-2 space-y-1">
                {section.items.length > 0 ? (
                  section.items.map((item, idx) => (
                    <p key={idx} className="text-xs text-secondary break-words">
                      •{' '}
                      {renderEvidenceAwareText(item, evidenceMap, onNavigateToNote)}
                    </p>
                  ))
                ) : (
                  <p className="text-xs text-secondary">No items.</p>
                )}
              </div>
            ) : section.items[0] ? (
              <div className="px-2 pb-2">
                <p className="text-xs text-secondary break-words">
                  • {previewText(section.items[0].replace(UUID_REGEX, ''), 120)}
                </p>
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
