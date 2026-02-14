'use client'

import type { TimelineBootstrapSession } from '@/types'

interface TimelineBootstrapSummaryPreviewProps {
  session: TimelineBootstrapSession
}

function labelForCountKey(key: string): string {
  if (key === 'thinkers') return 'Thinkers'
  if (key === 'events') return 'Events'
  if (key === 'connections') return 'Connections'
  if (key === 'publications') return 'Publications'
  if (key === 'quotes') return 'Quotes'
  return key
}

export function TimelineBootstrapSummaryPreview({ session }: TimelineBootstrapSummaryPreviewProps) {
  const counts = session.candidate_counts ?? {}
  const countEntries = Object.entries(counts)
  const extractionMode = String(session.telemetry?.extraction_mode ?? 'unknown')
  const processedChunks = String(session.telemetry?.processed_chunks ?? 'n/a')
  const estimatedTokens = String(session.telemetry?.estimated_tokens ?? 'n/a')

  return (
    <div className="space-y-2 rounded border border-sky-200 bg-sky-50 p-3 text-xs">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-sky-900">Summary Preview</h4>
        <p className="text-sky-800">{session.status}</p>
      </div>

      <div className="grid grid-cols-2 gap-1">
        {countEntries.map(([key, value]) => (
          <p key={key} className="text-sky-900">
            {labelForCountKey(key)}: {value}
          </p>
        ))}
      </div>

      <div className="rounded border border-sky-200 bg-white p-2">
        <p className="text-sky-900">Extraction mode: {extractionMode}</p>
        <p className="text-sky-900">Processed chunks: {processedChunks}</p>
        <p className="text-sky-900">Estimated tokens: {estimatedTokens}</p>
      </div>

      {session.partial && (
        <p className="rounded border border-amber-300 bg-amber-100 px-2 py-1 text-amber-900">
          Preview is partial due to context or budget limits.
        </p>
      )}

      {session.warnings.length > 0 && (
        <details className="rounded border border-sky-200 bg-white p-2">
          <summary className="cursor-pointer text-sky-900">Warnings ({session.warnings.length})</summary>
          <div className="mt-2 space-y-1">
            {session.warnings.map((warning, index) => (
              <p key={`${index}-${warning}`} className="text-amber-900">
                {warning}
              </p>
            ))}
          </div>
        </details>
      )}

      {session.summary_markdown && (
        <details className="rounded border border-sky-200 bg-white p-2" open>
          <summary className="cursor-pointer text-sky-900">Narrative Summary</summary>
          <pre className="mt-2 whitespace-pre-wrap text-secondary">{session.summary_markdown}</pre>
        </details>
      )}
    </div>
  )
}
