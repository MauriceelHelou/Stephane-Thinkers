'use client'

import { useMutation } from '@tanstack/react-query'

import { criticalTermsApi } from '@/lib/api'
import type { ThesisCandidate } from '@/types'

interface ThesisCandidatesPanelProps {
  termId: string
  onUseCandidate?: (candidate: ThesisCandidate) => void
}

export function ThesisCandidatesPanel({ termId, onUseCandidate }: ThesisCandidatesPanelProps) {
  const { mutate, data, isPending } = useMutation({
    mutationFn: () => criticalTermsApi.getThesisCandidates(termId),
  })

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => mutate()}
        className="px-2 py-1 text-xs rounded bg-accent text-white hover:bg-accent/90"
        disabled={isPending || !termId}
      >
        {isPending ? 'Generating...' : 'Generate thesis candidates'}
      </button>

      <div className="space-y-2">
        {data?.candidates.map((candidate, index) => (
          <button
            key={index}
            type="button"
            onClick={() => onUseCandidate?.(candidate)}
            className="w-full text-left p-2 border border-gray-100 rounded hover:border-accent/40"
          >
            <p className="text-xs font-medium text-primary">{candidate.claim}</p>
            <p className="text-xs text-secondary mt-1">confidence {(candidate.confidence * 100).toFixed(0)}%</p>
          </button>
        ))}
      </div>
    </div>
  )
}
