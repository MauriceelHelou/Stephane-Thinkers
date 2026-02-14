'use client'

import { useMemo } from 'react'
import { useQueries } from '@tanstack/react-query'

import { notesApi, researchQuestionsApi } from '@/lib/api'

type EvidenceKind = 'note' | 'question' | 'unknown'

export interface PlanningEvidenceRef {
  id: string
  kind: EvidenceKind
  label: string
}

const UUID_REGEX = /\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/g

async function resolvePlanningEvidenceRef(id: string): Promise<PlanningEvidenceRef> {
  try {
    const note = await notesApi.getOne(id)
    return {
      id,
      kind: 'note',
      label: (note.title || '').trim() || 'Untitled note',
    }
  } catch {}

  try {
    const question = await researchQuestionsApi.getOne(id)
    return {
      id,
      kind: 'question',
      label: (question.title || '').trim() || 'Untitled question',
    }
  } catch {}

  return {
    id,
    kind: 'unknown',
    label: id,
  }
}

function uniqueRefs(values: string[]): string[] {
  const seen = new Set<string>()
  const deduped: string[] = []
  for (const value of values) {
    const trimmed = (value || '').trim()
    if (!trimmed || seen.has(trimmed)) continue
    seen.add(trimmed)
    deduped.push(trimmed)
  }
  return deduped
}

export function extractEvidenceIdsFromText(text: string): string[] {
  if (!text) return []
  const matches = text.match(UUID_REGEX) || []
  return uniqueRefs(matches)
}

export function extractEvidenceIdsFromTexts(texts: string[]): string[] {
  return uniqueRefs(texts.flatMap((text) => extractEvidenceIdsFromText(text)))
}

export function usePlanningEvidenceMap(refs: string[]): Map<string, PlanningEvidenceRef> {
  const stableRefs = useMemo(() => uniqueRefs(refs), [refs])
  const queryResults = useQueries({
    queries: stableRefs.map((ref) => ({
      queryKey: ['planning-evidence-ref', ref],
      queryFn: () => resolvePlanningEvidenceRef(ref),
      staleTime: 10 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      retry: false,
      refetchOnWindowFocus: false,
    })),
  })

  return useMemo(() => {
    const map = new Map<string, PlanningEvidenceRef>()
    stableRefs.forEach((ref, index) => {
      const resolved = queryResults[index]?.data
      if (resolved) {
        map.set(ref, resolved)
      }
    })
    return map
  }, [stableRefs, queryResults])
}

export function formatPlanningEvidenceLabel(ref: string, resolved?: PlanningEvidenceRef): string {
  if (!resolved) {
    return 'Resolving reference...'
  }
  if (resolved.kind === 'note') {
    return `Note: ${resolved.label}`
  }
  if (resolved.kind === 'question') {
    return `Question: ${resolved.label}`
  }
  const shortId = ref.length > 12 ? `${ref.slice(0, 8)}...` : ref
  return `Reference: ${shortId}`
}
