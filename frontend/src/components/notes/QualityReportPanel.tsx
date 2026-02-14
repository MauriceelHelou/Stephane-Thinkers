'use client'

import { useQuery } from '@tanstack/react-query'

import { criticalTermsApi } from '@/lib/api'
import { ConfidenceBadge } from './ConfidenceBadge'
import { ContradictionList } from './ContradictionList'

interface QualityReportPanelProps {
  termId: string
  runId?: string
}

export function QualityReportPanel({ termId, runId }: QualityReportPanelProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['quality-report', termId, runId],
    queryFn: () => criticalTermsApi.getQualityReport(termId, runId),
    enabled: !!termId,
  })

  if (isLoading) return <p className="text-xs text-secondary">Analyzing synthesis quality...</p>
  if (error) return <p className="text-xs text-red-600">Failed to load quality report.</p>
  if (!data) return <p className="text-xs text-secondary">No quality report available.</p>

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-secondary">Coverage: {(data.coverage_rate * 100).toFixed(0)}%</p>
        <ConfidenceBadge label={data.uncertainty_label} />
      </div>

      {data.unsupported_claims.length > 0 ? (
        <ul className="list-disc pl-4 text-xs text-amber-700 space-y-1">
          {data.unsupported_claims.map((item, idx) => (
            <li key={idx}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-green-700">All sentences include citation keys.</p>
      )}

      <ContradictionList contradictions={data.contradiction_signals} />
    </div>
  )
}
