'use client'

import { useCallback, useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { analysisApi } from '@/lib/api'
import { notesAiFlags } from '@/lib/notesAiFlags'
import { AddConnectionModal } from '@/components/AddConnectionModal'
import type { ConnectionSuggestionFromNotes } from '@/types'
import { ConnectionRationaleCard } from './ConnectionRationaleCard'

interface ConnectionSuggestionsPanelProps {
  folderId?: string | null
}

const CONFIDENCE_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  high: { bg: 'bg-green-100', text: 'text-green-800', label: 'High' },
  medium: { bg: 'bg-amber-100', text: 'text-amber-800', label: 'Medium' },
  low: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Low' },
}

const DISMISSED_KEY = 'connection-suggestions-dismissed'

function getDismissedPairs(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  if (!window.localStorage || typeof window.localStorage.getItem !== 'function') return new Set()
  try {
    const stored = localStorage.getItem(DISMISSED_KEY)
    if (stored) return new Set(JSON.parse(stored) as string[])
  } catch {
    // ignore parse errors
  }
  return new Set()
}

function dismissPair(pairKey: string) {
  if (typeof window === 'undefined') return
  if (!window.localStorage || typeof window.localStorage.setItem !== 'function') return
  const dismissed = getDismissedPairs()
  dismissed.add(pairKey)
  localStorage.setItem(DISMISSED_KEY, JSON.stringify([...dismissed]))
}

function undismissAll() {
  if (typeof window === 'undefined') return
  if (!window.localStorage || typeof window.localStorage.removeItem !== 'function') return
  localStorage.removeItem(DISMISSED_KEY)
}

function pairKey(aId: string, bId: string): string {
  return [aId, bId].sort().join('::')
}

export function ConnectionSuggestionsPanel({ folderId }: ConnectionSuggestionsPanelProps) {
  const queryClient = useQueryClient()

  const [dismissedPairs, setDismissedPairs] = useState<Set<string>>(new Set())
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null)
  const [connectionModal, setConnectionModal] = useState<{
    isOpen: boolean
    fromThinkerId: string | null
    toThinkerId: string | null
  }>({
    isOpen: false,
    fromThinkerId: null,
    toThinkerId: null,
  })

  useEffect(() => {
    setDismissedPairs(getDismissedPairs())
  }, [])

  const {
    data: suggestions = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['connection-suggestions', folderId],
    queryFn: () =>
      analysisApi.getConnectionSuggestions({
        limit: 20,
        folder_id: folderId || undefined,
      }),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    refetchOnMount: 'always',
  })

  const { data: explanations = [] } = useQuery({
    queryKey: ['connection-explanations', folderId],
    queryFn: () =>
      analysisApi.getConnectionExplanations(folderId || undefined, 8),
    enabled: notesAiFlags.phaseD,
    staleTime: 30_000,
  })

  const visibleSuggestions = suggestions.filter(
    (suggestion) => !dismissedPairs.has(pairKey(suggestion.thinker_a_id, suggestion.thinker_b_id))
  )

  const handleDismiss = useCallback((suggestion: ConnectionSuggestionFromNotes) => {
    const key = pairKey(suggestion.thinker_a_id, suggestion.thinker_b_id)
    dismissPair(key)
    setDismissedPairs((prev) => new Set([...prev, key]))
  }, [])

  const handleCreateConnection = useCallback((suggestion: ConnectionSuggestionFromNotes) => {
    setConnectionModal({
      isOpen: true,
      fromThinkerId: suggestion.thinker_a_id,
      toThinkerId: suggestion.thinker_b_id,
    })
  }, [])

  const handleConnectionModalClose = useCallback(() => {
    setConnectionModal({ isOpen: false, fromThinkerId: null, toThinkerId: null })
    queryClient.invalidateQueries({ queryKey: ['connection-suggestions'] })
    queryClient.invalidateQueries({ queryKey: ['connections'] })
  }, [queryClient])

  const handleUndismissAll = useCallback(() => {
    undismissAll()
    setDismissedPairs(new Set())
  }, [])

  const yearRange = (birthYear?: number | null, deathYear?: number | null): string => {
    if (!birthYear && !deathYear) return ''
    if (birthYear && deathYear) return `(${birthYear}-${deathYear})`
    if (birthYear) return `(b. ${birthYear})`
    return `(d. ${deathYear})`
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-timeline">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-sans font-semibold text-primary uppercase tracking-wide">Connection Suggestions</h3>
            {visibleSuggestions.length > 0 && (
              <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-mono font-medium text-white bg-accent rounded-full">
                {visibleSuggestions.length}
              </span>
            )}
          </div>
          {dismissedPairs.size > 0 && (
            <button
              type="button"
              onClick={handleUndismissAll}
              className="text-xs font-sans text-gray-400 hover:text-accent transition-colors"
              title="Show dismissed suggestions"
            >
              Reset dismissed
            </button>
          )}
        </div>
        <p className="text-xs font-sans text-secondary mt-1">Based on thinkers mentioned together in your notes</p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="px-4 py-8 text-center">
            <div className="inline-block w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-sans text-secondary mt-2">Analyzing co-occurrences...</p>
          </div>
        )}

        {error && (
          <div className="px-4 py-6 text-center">
            <p className="text-sm font-sans text-red-600">Failed to load suggestions. Please try again.</p>
          </div>
        )}

        {!isLoading && !error && visibleSuggestions.length === 0 && (
          <div className="px-4 py-8 text-center">
            <p className="text-sm font-sans text-secondary">No connection suggestions yet.</p>
            <p className="text-xs font-sans text-gray-400 mt-1">
              Write more notes mentioning multiple thinkers to see suggestions here.
            </p>
          </div>
        )}

        {visibleSuggestions.map((suggestion, index) => {
          const key = pairKey(suggestion.thinker_a_id, suggestion.thinker_b_id)
          const isExpanded = expandedIndex === index
          const confidenceStyle = CONFIDENCE_STYLES[suggestion.confidence]

          return (
            <div key={key} className="border-b border-timeline px-4 py-3 hover:bg-gray-50 transition-colors">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-serif text-sm font-semibold text-primary break-words">{suggestion.thinker_a_name}</span>
                    <span className="text-xs font-mono text-gray-400">
                      {yearRange(suggestion.thinker_a_birth_year, suggestion.thinker_a_death_year)}
                    </span>
                  </div>

                  <div className="text-accent text-xs my-0.5">↕</div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-serif text-sm font-semibold text-primary break-words">{suggestion.thinker_b_name}</span>
                    <span className="text-xs font-mono text-gray-400">
                      {yearRange(suggestion.thinker_b_birth_year, suggestion.thinker_b_death_year)}
                    </span>
                  </div>
                </div>

                <span
                  className={`flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded text-xs font-sans font-medium ${confidenceStyle.bg} ${confidenceStyle.text}`}
                >
                  {confidenceStyle.label}
                </span>
              </div>

              <div className="mt-2 flex items-center gap-3 text-xs font-sans text-secondary">
                <span>
                  Mentioned together <strong className="text-primary">{suggestion.co_occurrence_count}</strong> times
                </span>
                {suggestion.same_paragraph_count > 0 && (
                  <span className="text-accent">({suggestion.same_paragraph_count} in same paragraph)</span>
                )}
              </div>

              {suggestion.sample_excerpts.length > 0 && (
                <button
                  type="button"
                  onClick={() => setExpandedIndex(isExpanded ? null : index)}
                  className="mt-1.5 text-xs font-sans text-accent hover:text-accent/80 transition-colors"
                >
                  {isExpanded ? 'Hide excerpts' : 'Show excerpts'}
                </button>
              )}

              {isExpanded && suggestion.sample_excerpts.length > 0 && (
                <div className="mt-2 space-y-2">
                  {suggestion.sample_excerpts.map((excerpt, excerptIndex) => (
                    <div
                      key={excerptIndex}
                      className="bg-gray-50 border border-timeline rounded p-2 text-xs font-serif text-secondary italic leading-relaxed"
                    >
                      {excerpt}
                    </div>
                  ))}
                  {suggestion.sample_note_titles.length > 0 && (
                    <div className="text-xs font-sans text-gray-400">From: {suggestion.sample_note_titles.join(', ')}</div>
                  )}
                </div>
              )}

              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleCreateConnection(suggestion)}
                  className="inline-flex items-center gap-1 text-xs font-sans font-medium text-white bg-accent hover:bg-accent/90 px-3 py-1.5 rounded transition-colors"
                >
                  Create Connection
                </button>
                <button
                  type="button"
                  onClick={() => handleDismiss(suggestion)}
                  className="inline-flex items-center text-xs font-sans text-gray-400 hover:text-gray-600 px-2 py-1.5 rounded transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )
        })}

        {!isLoading && notesAiFlags.phaseD && explanations.length > 0 && (
          <div className="px-4 py-3 border-t border-timeline bg-gray-50/60">
            <h4 className="text-xs font-sans font-semibold uppercase tracking-wide text-secondary mb-2">Rationale feed</h4>
            <div className="space-y-2">
              {explanations.slice(0, 3).map((item) => (
                <ConnectionRationaleCard
                  key={`${item.thinker_a_id}-${item.thinker_b_id}`}
                  item={item}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <AddConnectionModal
        isOpen={connectionModal.isOpen}
        onClose={handleConnectionModalClose}
        fromThinkerId={connectionModal.fromThinkerId}
        toThinkerId={connectionModal.toThinkerId}
      />
    </div>
  )
}
