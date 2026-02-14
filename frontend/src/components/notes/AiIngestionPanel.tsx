'use client'

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'

import { ingestionApi } from '@/lib/api'
import { AiJobStatus } from './AiJobStatus'

export function AiIngestionPanel() {
  const [text, setText] = useState('')
  const [jobId, setJobId] = useState<string | undefined>()

  const transcriptMutation = useMutation({
    mutationFn: () => ingestionApi.ingestTranscript({ file_name: 'transcript.txt', content: text }),
    onSuccess: (response) => setJobId(response.job_id),
  })

  const pdfMutation = useMutation({
    mutationFn: () => ingestionApi.ingestPdfHighlights({ file_name: 'highlights.txt', content: text }),
    onSuccess: (response) => setJobId(response.job_id),
  })

  return (
    <div className="space-y-2">
      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        className="w-full h-24 text-xs border border-gray-200 rounded p-2"
        placeholder="Paste transcript text or PDF highlights"
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => transcriptMutation.mutate()}
          className="px-2 py-1 text-xs rounded bg-accent text-white"
          disabled={!text.trim() || transcriptMutation.isPending}
        >
          Ingest transcript
        </button>
        <button
          type="button"
          onClick={() => pdfMutation.mutate()}
          className="px-2 py-1 text-xs rounded border border-accent text-accent"
          disabled={!text.trim() || pdfMutation.isPending}
        >
          Ingest PDF highlights
        </button>
      </div>
      <AiJobStatus jobId={jobId} />
    </div>
  )
}
