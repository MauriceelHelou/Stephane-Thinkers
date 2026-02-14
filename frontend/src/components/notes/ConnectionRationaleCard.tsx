'use client'

import type { ConnectionExplanation } from '@/types'

interface ConnectionRationaleCardProps {
  item: ConnectionExplanation
}

export function ConnectionRationaleCard({ item }: ConnectionRationaleCardProps) {
  return (
    <div className="p-3 rounded border border-gray-100 bg-white space-y-1">
      <p className="text-xs text-primary">Evidence count: {item.evidence_count}</p>
      <p className="text-xs text-secondary">{item.rationale}</p>
      <p className="text-[10px] uppercase tracking-wide text-gray-500">{item.confidence} confidence</p>
      {item.sample_excerpts.slice(0, 2).map((excerpt, idx) => (
        <p key={idx} className="text-xs text-gray-600">"{excerpt}"</p>
      ))}
    </div>
  )
}
