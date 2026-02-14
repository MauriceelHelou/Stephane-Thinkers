'use client'

import { useQuery } from '@tanstack/react-query'

import { analysisApi } from '@/lib/api'

interface RelatedExcerptsRailProps {
  occurrenceId?: string
}

export function RelatedExcerptsRail({ occurrenceId }: RelatedExcerptsRailProps) {
  const { data = [] } = useQuery({
    queryKey: ['related-excerpts', occurrenceId],
    queryFn: () => analysisApi.getRelatedExcerpts(occurrenceId!, 8),
    enabled: !!occurrenceId,
  })

  if (!occurrenceId) {
    return <p className="text-xs text-secondary">Select an excerpt to see related passages.</p>
  }

  return (
    <div className="space-y-1">
      {data.map((item) => (
        <div key={item.occurrence_id} className="p-2 rounded border border-gray-100 bg-gray-50">
          <p className="text-xs text-primary">{item.context_snippet}</p>
          <p className="text-[10px] text-secondary mt-1">sim {item.similarity.toFixed(3)}</p>
        </div>
      ))}
    </div>
  )
}
