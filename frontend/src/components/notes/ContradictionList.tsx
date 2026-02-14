'use client'

import type { ContradictionSignal } from '@/types'

interface ContradictionListProps {
  contradictions: ContradictionSignal[]
}

export function ContradictionList({ contradictions }: ContradictionListProps) {
  if (contradictions.length === 0) {
    return <p className="text-xs text-secondary">No contradiction signals detected.</p>
  }

  return (
    <div className="space-y-2">
      {contradictions.map((item, index) => (
        <div key={index} className="p-2 rounded border border-red-100 bg-red-50">
          <p className="text-xs font-medium text-red-800">{item.summary}</p>
          <p className="text-xs text-red-700 mt-1">A: {item.evidence_a}</p>
          <p className="text-xs text-red-700">B: {item.evidence_b}</p>
        </div>
      ))}
    </div>
  )
}
