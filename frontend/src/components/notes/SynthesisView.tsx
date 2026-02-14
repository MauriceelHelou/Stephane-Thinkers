'use client'

import { useMemo, useState, type MouseEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { criticalTermsApi } from '@/lib/api'
import type { SynthesisRun } from '@/types'
import { SynthesisDiffView } from './SynthesisDiffView'

interface SynthesisViewProps {
  termId: string
  termName: string
  folderId?: string
  thinkerId?: string
  filterContext: string
  totalExcerpts: number
  totalNotes: number
  totalThinkers: number
  sourceNoteTitles: string[]
  onNavigateToNote?: (noteId: string) => void
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function renderSimpleMarkdown(text: string): string {
  return escapeHtml(text)
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(
      /\[(E\d+)\]/g,
      '<button type="button" data-citation-key="$1" class="inline-block mx-0.5 px-1 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-mono cursor-pointer hover:bg-amber-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-500">[$1]</button>'
    )
    .replace(/\n/g, '<br/>')
}

export default function SynthesisView({
  termId,
  termName,
  folderId,
  thinkerId,
  filterContext,
  totalExcerpts,
  totalNotes,
  totalThinkers,
  sourceNoteTitles,
  onNavigateToNote,
}: SynthesisViewProps) {
  const [synthesisRequested, setSynthesisRequested] = useState(false)

  const {
    data: synthesisData,
    isLoading: isSynthesizing,
    error: synthesisError,
    refetch,
  } = useQuery<SynthesisRun>({
    queryKey: ['term-synthesis-run', termId, 'definition', folderId, thinkerId],
    queryFn: () =>
      criticalTermsApi.getSynthesis(termId, 'definition', {
        folder_id: folderId,
        thinker_id: thinkerId,
      }),
    enabled: synthesisRequested,
    staleTime: 0,
  })

  const { data: runHistory = [] } = useQuery({
    queryKey: ['term-synthesis-runs', termId],
    queryFn: () => criticalTermsApi.getSynthesisRuns(termId, 5),
    enabled: !!termId,
  })

  const synthesis = synthesisData?.run.synthesis_text
  const synthesisCitations = synthesisData?.citations || []
  const citationNoteMap = useMemo(
    () =>
      new Map(
        synthesisCitations.map((citation) => [citation.citation_key.toUpperCase(), citation.note_id])
      ),
    [synthesisCitations]
  )

  const handleResynthesize = () => {
    setSynthesisRequested(true)
    refetch()
  }

  const handleInlineCitationClick = (event: MouseEvent<HTMLDivElement>) => {
    if (!onNavigateToNote) {
      return
    }

    const citationElement = (event.target as HTMLElement).closest<HTMLElement>('[data-citation-key]')
    const citationKey = citationElement?.dataset.citationKey?.toUpperCase()
    if (!citationKey) {
      return
    }

    const noteId = citationNoteMap.get(citationKey)
    if (noteId) {
      onNavigateToNote(noteId)
    }
  }

  return (
    <div className="px-4 py-3">
      <div className="mb-3 rounded border border-gray-200 bg-gray-50 px-3 py-2">
        <p className="text-[11px] font-sans font-semibold uppercase tracking-wide text-secondary mb-1">Synthesis Scope</p>
        <p className="text-xs text-primary">
          Term: <span className="font-semibold">{termName}</span>
        </p>
        <p className="text-xs text-secondary mt-0.5">Scope: {filterContext}</p>
        <p className="text-xs text-secondary mt-1">
          Using {totalExcerpts} excerpt{totalExcerpts !== 1 ? 's' : ''} from {totalNotes} note
          {totalNotes !== 1 ? 's' : ''}
          {totalThinkers > 0 ? ` mentioning ${totalThinkers} thinker${totalThinkers !== 1 ? 's' : ''}` : ''}.
        </p>
        <p className="text-xs text-secondary mt-1">Mode: grounded definition</p>
        {sourceNoteTitles.length > 0 && (
          <details className="mt-2">
            <summary className="cursor-pointer text-xs text-accent">Source notes in scope</summary>
            <div className="mt-1 max-h-32 overflow-y-auto pr-1">
              <ul className="space-y-1 text-xs text-secondary">
                {sourceNoteTitles.map((title, index) => (
                  <li key={`${title}-${index}`} className="break-words" title={title}>
                    {title}
                  </li>
                ))}
                {totalNotes > sourceNoteTitles.length && (
                  <li className="text-[11px] italic text-gray-500">
                    ...and {totalNotes - sourceNoteTitles.length} more note{totalNotes - sourceNoteTitles.length !== 1 ? 's' : ''}
                  </li>
                )}
              </ul>
            </div>
          </details>
        )}
      </div>

      {!synthesisRequested && !synthesis && (
        <div className="text-center">
          {totalExcerpts < 3 && (
            <p className="text-xs text-amber-600 mb-2">
              Only {totalExcerpts} excerpt{totalExcerpts !== 1 ? 's' : ''} found. Synthesis works best with more data.
            </p>
          )}
          <button
            type="button"
            onClick={() => setSynthesisRequested(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-accent/10 text-accent rounded-lg hover:bg-accent/20 transition-colors"
          >
            Synthesize Current Scope
          </button>
        </div>
      )}

      {isSynthesizing && (
        <div className="flex items-center justify-center py-6">
          <div className="text-center">
            <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-sm text-gray-500 font-serif italic">Synthesizing from your notes...</p>
          </div>
        </div>
      )}

      {synthesisError && (
        <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700 mb-2">
          Failed to synthesize for term "{termName}". {(synthesisError as Error).message}
          <button
            type="button"
            onClick={handleResynthesize}
            className="block mt-1 text-xs text-red-600 underline hover:text-red-800"
          >
            Try again
          </button>
        </div>
      )}

      {synthesis && !isSynthesizing && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-400 italic">AI Synthesis (current scope only)</span>
            <button
              type="button"
              onClick={handleResynthesize}
              className="text-xs text-accent hover:text-accent/80 underline transition-colors"
            >
              Re-synthesize
            </button>
          </div>

          <div
            className="bg-accent/5 border border-accent/10 rounded-lg p-3 font-serif text-sm text-primary/80 leading-relaxed"
            onClick={handleInlineCitationClick}
            dangerouslySetInnerHTML={{ __html: renderSimpleMarkdown(synthesis) }}
          />

          <p className="text-xs text-gray-400 mt-2 italic">
            Generated from the scoped excerpts shown in this panel. No external sources are added.
          </p>

          <div className="mt-3 rounded border border-gray-200 bg-white p-2">
            <p className="text-xs font-sans font-semibold text-secondary mb-1">Synthesis Diff</p>
            <SynthesisDiffView previous={runHistory[1]?.synthesis_text || null} current={synthesis} />
          </div>

          {synthesisCitations.length > 0 && (
            <div className="mt-3 rounded border border-gray-200 bg-white p-2">
              <p className="text-xs font-sans font-semibold text-secondary mb-1">Citation Legend</p>
              <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                {synthesisCitations.map((citation) => (
                  <div key={citation.citation_key} className="text-xs text-secondary">
                    <span className="font-mono text-amber-800 mr-1">[{citation.citation_key}]</span>
                    {onNavigateToNote ? (
                      <button
                        type="button"
                        onClick={() => onNavigateToNote(citation.note_id)}
                        className="text-accent hover:text-accent/80 underline"
                      >
                        {citation.note_title}
                      </button>
                    ) : (
                      <span className="text-primary">{citation.note_title}</span>
                    )}
                    {citation.folder_name ? ` (${citation.folder_name})` : ''}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
