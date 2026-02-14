'use client'

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'

import { notesApi } from '@/lib/api'

interface DraftFromExcerptsModalProps {
  excerptIds: string[]
  onInsert: (draft: string) => void
}

export function DraftFromExcerptsModal({ excerptIds, onInsert }: DraftFromExcerptsModalProps) {
  const [tone, setTone] = useState('scholarly')

  const { mutate, data, isPending } = useMutation({
    mutationFn: () => notesApi.draftFromExcerpts({ excerpt_ids: excerptIds, tone }),
  })

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <input
          value={tone}
          onChange={(event) => setTone(event.target.value)}
          className="flex-1 text-xs border border-gray-200 rounded px-2 py-1"
          placeholder="Tone"
        />
        <button
          type="button"
          onClick={() => mutate()}
          className="px-2 py-1 text-xs rounded bg-accent text-white"
          disabled={isPending || excerptIds.length === 0}
        >
          {isPending ? 'Drafting...' : 'Draft'}
        </button>
      </div>

      {data?.draft && (
        <div className="space-y-1">
          <textarea className="w-full h-28 text-xs border border-gray-200 rounded p-2" value={data.draft} readOnly />
          <button
            type="button"
            onClick={() => onInsert(data.draft)}
            className="px-2 py-1 text-xs rounded border border-accent text-accent"
          >
            Insert draft
          </button>
        </div>
      )}
    </div>
  )
}
