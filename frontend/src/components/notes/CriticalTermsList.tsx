'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { criticalTermsApi } from '@/lib/api'
import type { CriticalTermWithCount } from '@/types'

interface CriticalTermsListProps {
  onSelectTerm?: (termId: string) => void
  selectedTermId?: string | null
  onFlagNewTerm: () => void
}

type SortMode = 'name' | 'count'

export function CriticalTermsList({ onSelectTerm, selectedTermId, onFlagNewTerm }: CriticalTermsListProps) {
  const queryClient = useQueryClient()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [sortMode, setSortMode] = useState<SortMode>('name')

  const { data: terms = [], isLoading } = useQuery({
    queryKey: ['critical-terms'],
    queryFn: () => criticalTermsApi.getAll(),
    refetchOnMount: 'always',
  })

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      criticalTermsApi.update(id, { is_active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['critical-terms'] })
      queryClient.invalidateQueries({ queryKey: ['term-thinker-matrix'] })
    },
  })

  const deleteTermMutation = useMutation({
    mutationFn: (id: string) => criticalTermsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['critical-terms'] })
      queryClient.invalidateQueries({ queryKey: ['term-thinker-matrix'] })
      queryClient.invalidateQueries({ queryKey: ['term-definition'] })
    },
  })

  const sortedTerms = [...terms].sort((a, b) => {
    if (sortMode === 'count') {
      return b.occurrence_count - a.occurrence_count
    }
    return a.name.localeCompare(b.name)
  })

  return (
    <div className="h-full min-h-0 flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50">
        <button
          type="button"
          onClick={() => setIsCollapsed((prev) => !prev)}
          className="flex items-center gap-1 text-xs font-sans font-medium text-secondary uppercase tracking-wide hover:text-primary"
        >
          <span className="inline-block transition-transform" style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}>
            ▼
          </span>
          Critical Terms
          {terms.length > 0 && <span className="ml-1 text-gray-400">({terms.length})</span>}
        </button>

        <button
          type="button"
          onClick={() => setSortMode((prev) => (prev === 'name' ? 'count' : 'name'))}
          className="text-xs text-gray-400 hover:text-gray-600 px-1"
          title={`Sort by ${sortMode === 'name' ? 'occurrence count' : 'name'}`}
        >
          {sortMode === 'name' ? 'A-Z' : '#'}
        </button>
      </div>

      {!isCollapsed && (
        <div className="px-2 py-1 flex-1 min-h-0 flex flex-col">
          {isLoading ? (
            <p className="text-xs text-gray-400 px-1 py-2">Loading terms...</p>
          ) : sortedTerms.length === 0 ? (
            <p className="text-xs text-gray-400 italic px-1 py-2">No critical terms flagged yet</p>
          ) : (
            <div className="space-y-0.5 flex-1 min-h-0 overflow-y-auto">
              {sortedTerms.map((term: CriticalTermWithCount) => (
                <div
                  key={term.id}
                  onClick={() => onSelectTerm?.(term.id)}
                  className={`flex items-center justify-between px-2 py-1.5 rounded cursor-pointer group transition-colors ${
                    selectedTermId === term.id ? 'bg-amber-50 border border-amber-200' : 'hover:bg-gray-50'
                  } ${!term.is_active ? 'opacity-50' : ''}`}
                >
                  <span className="text-sm font-mono truncate flex-1" title={term.name}>
                    {term.name}
                  </span>
                  <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded-full font-sans ${
                        term.is_active ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {term.occurrence_count}
                    </span>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        toggleActiveMutation.mutate({ id: term.id, is_active: !term.is_active })
                      }}
                      className="opacity-0 group-hover:opacity-100 text-xs text-gray-400 hover:text-gray-600 transition-opacity"
                      title={term.is_active ? 'Deactivate term' : 'Activate term'}
                    >
                      {term.is_active ? '◉' : '○'}
                    </button>
                    <button
                      type="button"
                      aria-label="Delete term"
                      onClick={(event) => {
                        event.stopPropagation()
                        const isConfirmed = window.confirm(`Delete "${term.name}"? This cannot be undone.`)
                        if (!isConfirmed) return
                        deleteTermMutation.mutate(term.id)
                      }}
                      className="opacity-0 group-hover:opacity-100 text-[10px] font-sans text-red-400 hover:text-red-600 transition-opacity"
                      title="Delete term"
                    >
                      Del
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={onFlagNewTerm}
            className="w-full mt-2 mb-1 px-2 py-1.5 text-xs font-sans text-accent hover:bg-amber-50 rounded border border-dashed border-amber-300 transition-colors"
          >
            Flag New Term
          </button>
        </div>
      )}
    </div>
  )
}
