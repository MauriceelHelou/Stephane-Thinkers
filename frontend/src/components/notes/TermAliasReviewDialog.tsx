'use client'

import { useMutation } from '@tanstack/react-query'

import { criticalTermsApi } from '@/lib/api'

interface TermAliasReviewDialogProps {
  termId: string
  aliasId: string
  aliasName: string
  onApproved?: () => void
}

export function TermAliasReviewDialog({ termId, aliasId, aliasName, onApproved }: TermAliasReviewDialogProps) {
  const { mutate, isPending } = useMutation({
    mutationFn: () => criticalTermsApi.approveAlias(termId, aliasId),
    onSuccess: () => onApproved?.(),
  })

  return (
    <div className="p-3 border border-gray-200 rounded space-y-2">
      <p className="text-xs text-primary">Review alias: <strong>{aliasName}</strong></p>
      <button
        type="button"
        onClick={() => mutate()}
        disabled={isPending}
        className="px-2 py-1 text-xs rounded bg-accent text-white"
      >
        {isPending ? 'Approving...' : 'Approve alias'}
      </button>
    </div>
  )
}
