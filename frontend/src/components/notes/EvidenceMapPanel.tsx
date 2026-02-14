'use client'

import { useQuery } from '@tanstack/react-query'

import { criticalTermsApi } from '@/lib/api'

interface EvidenceMapPanelProps {
  termId: string
  folderId?: string
  thinkerId?: string
  selectedOccurrenceId?: string
  onSelectOccurrence?: (occurrenceId: string) => void
}

export function EvidenceMapPanel({
  termId,
  folderId,
  thinkerId,
  selectedOccurrenceId,
  onSelectOccurrence,
}: EvidenceMapPanelProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['evidence-map', termId, folderId, thinkerId],
    queryFn: () => criticalTermsApi.getEvidenceMap(termId, { folder_id: folderId, thinker_id: thinkerId }),
    enabled: !!termId,
  })

  if (isLoading) return <p className="text-xs text-secondary">Loading evidence map...</p>
  if (!data) return <p className="text-xs text-secondary">No evidence map available.</p>

  return (
    <div className="space-y-2">
      <div className="text-xs text-secondary">
        {data.stats.total_occurrences} occurrences across {data.stats.total_notes} notes
      </div>
      <div className="space-y-1 max-h-40 overflow-y-auto">
        {data.excerpts.slice(0, 8).map((excerpt) => (
          <button
            key={excerpt.id}
            type="button"
            onClick={() => onSelectOccurrence?.(excerpt.id)}
            className={`w-full text-left p-2 border rounded text-xs transition-colors ${
              selectedOccurrenceId === excerpt.id
                ? 'border-accent bg-accent/5'
                : 'border-gray-100 bg-gray-50 hover:bg-gray-100'
            }`}
          >
            <p className="text-primary">{excerpt.context_snippet}</p>
            <p className="text-secondary mt-1">{excerpt.note_title || 'Untitled note'}</p>
          </button>
        ))}
      </div>
    </div>
  )
}
