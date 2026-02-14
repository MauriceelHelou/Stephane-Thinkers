'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { analysisApi } from '@/lib/api'
import { notesAiFlags } from '@/lib/notesAiFlags'

interface SemanticSearchPanelProps {
  folderId?: string
  onNavigateToNote?: (noteId: string) => void
}

export function SemanticSearchPanel({ folderId, onNavigateToNote }: SemanticSearchPanelProps) {
  const [query, setQuery] = useState('')
  const phaseEnabled = notesAiFlags.phaseD

  const { data = [], isFetching } = useQuery({
    queryKey: ['semantic-search', query, folderId],
    queryFn: () => analysisApi.semanticSearch(query, folderId, 12),
    enabled: phaseEnabled && query.trim().length >= 2,
  })

  if (!phaseEnabled) {
    return <p className="text-xs text-secondary">Discovery features are disabled by phase flags.</p>
  }

  return (
    <div className="space-y-2">
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Semantic search in notes"
        className="w-full text-xs border border-gray-200 rounded px-2 py-1.5"
      />
      {isFetching && <p className="text-xs text-secondary">Searching...</p>}
      <div className="space-y-1 max-h-44 overflow-y-auto">
        {data.map((item) => (
          <button
            key={`${item.note_id}-${item.score}`}
            type="button"
            onClick={() => onNavigateToNote?.(item.note_id)}
            className="w-full text-left p-2 border border-gray-100 rounded hover:border-accent/40 hover:bg-accent/5 transition-colors"
            title="Open note"
          >
            <p className="text-xs font-medium text-primary">{item.note_title && item.note_title.length > 30 ? `${item.note_title.slice(0, 30)}…` : item.note_title}</p>
            <p className="text-xs text-secondary">{item.excerpt}</p>
            <p className="text-[10px] text-gray-400 mt-1">score {item.score.toFixed(3)}</p>
          </button>
        ))}
      </div>
    </div>
  )
}
