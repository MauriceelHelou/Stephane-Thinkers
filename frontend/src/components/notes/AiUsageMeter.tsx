'use client'

import { useQuery } from '@tanstack/react-query'

import { analysisApi } from '@/lib/api'

interface AiUsageMeterProps {
  used?: number
  limit?: number
}

export function AiUsageMeter({ used, limit }: AiUsageMeterProps) {
  const shouldFetch = used === undefined || limit === undefined
  const { data } = useQuery({
    queryKey: ['ai-usage-meter'],
    queryFn: () => analysisApi.getAiUsage(),
    enabled: shouldFetch,
    staleTime: 15_000,
  })

  const resolvedUsed = shouldFetch ? (data?.used_tokens ?? 0) : (used ?? 0)
  const resolvedLimit = shouldFetch ? (data?.daily_quota_tokens ?? 1000) : (limit ?? 1000)
  const pct = resolvedLimit > 0 ? Math.min(100, Math.round((resolvedUsed / resolvedLimit) * 100)) : 0

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-secondary">
        <span>AI usage</span>
        <span>{resolvedUsed}/{resolvedLimit}</span>
      </div>
      <div className="h-1.5 rounded bg-gray-100 overflow-hidden">
        <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
