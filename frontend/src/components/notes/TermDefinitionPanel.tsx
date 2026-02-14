'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Group, Panel } from 'react-resizable-panels'
import { criticalTermsApi } from '@/lib/api'
import { notesAiFlags } from '@/lib/notesAiFlags'
import type { TermDefinition, TermDefinitionFilters } from '@/types'
import ExcerptCard from './ExcerptCard'
import SynthesisView from './SynthesisView'
import { ResizeHandle } from './ResizeHandle'
import { EvidenceMapPanel } from './EvidenceMapPanel'

interface TermDefinitionPanelProps {
  termId: string
  folderId?: string | null
  onClose: () => void
  onNavigateToNote?: (noteId: string) => void
  selectedThinkerId?: string | null
}

export default function TermDefinitionPanel({
  termId,
  folderId: initialFolderId,
  onClose,
  onNavigateToNote,
  selectedThinkerId,
}: TermDefinitionPanelProps) {
  const [selectedFolderId, setSelectedFolderId] = useState<string | undefined>(initialFolderId || undefined)
  const [selectedThinkerFilterId, setSelectedThinkerFilterId] = useState<string | undefined>(
    selectedThinkerId || undefined
  )
  const [selectedOccurrenceId, setSelectedOccurrenceId] = useState<string | undefined>(undefined)

  const filters: TermDefinitionFilters = useMemo(
    () => ({
      folder_id: selectedFolderId,
      thinker_id: selectedThinkerFilterId,
    }),
    [selectedFolderId, selectedThinkerFilterId]
  )

  const {
    data: definition,
    isLoading,
    error,
  } = useQuery<TermDefinition>({
    queryKey: ['term-definition', termId, filters],
    queryFn: () => criticalTermsApi.getDefinition(termId, filters),
    enabled: !!termId,
  })

  const allExcerpts = useMemo(() => {
    if (!definition) return []
    const seen = new Set<string>()
    const result: typeof definition.excerpts_by_thinker[0]['excerpts'] = []
    for (const group of definition.excerpts_by_thinker) {
      for (const excerpt of group.excerpts) {
        if (!seen.has(excerpt.id)) {
          seen.add(excerpt.id)
          result.push(excerpt)
        }
      }
    }
    return result
  }, [definition])

  const synthesisScope = useMemo(() => {
    const uniqueNoteIds = new Set<string>()
    const uniqueThinkerNames = new Set<string>()
    const noteTitleById = new Map<string, string>()

    for (const excerpt of allExcerpts) {
      uniqueNoteIds.add(excerpt.note_id)
      if (excerpt.note_title) {
        noteTitleById.set(excerpt.note_id, excerpt.note_title)
      }

      for (const thinker of excerpt.associated_thinkers || []) {
        if (thinker.name) uniqueThinkerNames.add(thinker.name)
      }
    }

    const noteTitles = Array.from(noteTitleById.values())
    return {
      noteCount: uniqueNoteIds.size,
      thinkerCount: uniqueThinkerNames.size,
      noteTitles,
    }
  }, [allExcerpts])

  const hasActiveFilters = !!selectedFolderId || !!selectedThinkerFilterId

  const clearFilters = () => {
    setSelectedFolderId(undefined)
    setSelectedThinkerFilterId(undefined)
    setSelectedOccurrenceId(undefined)
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex-shrink-0 border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-serif text-lg font-bold text-primary truncate">{definition?.term.name || 'Loading...'}</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1"
            aria-label="Close definition panel"
          >
            ×
          </button>
        </div>

        {definition && (
          <p className="text-xs text-gray-500">
            {definition.total_occurrences} occurrence{definition.total_occurrences !== 1 ? 's' : ''} across{' '}
            {definition.filter_context}
          </p>
        )}

        {definition && (
          <div className="mt-3 space-y-2">
            <div className="flex gap-2">
              <select
                value={selectedFolderId || ''}
                onChange={(event) => setSelectedFolderId(event.target.value || undefined)}
                className="flex-1 text-xs border border-gray-200 rounded px-2 py-1.5 bg-white text-primary focus:outline-none focus:ring-1 focus:ring-accent"
              >
                <option value="">All folders</option>
                {definition.available_folders.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {folder.name}
                  </option>
                ))}
              </select>

              <select
                value={selectedThinkerFilterId || ''}
                onChange={(event) => setSelectedThinkerFilterId(event.target.value || undefined)}
                className="flex-1 text-xs border border-gray-200 rounded px-2 py-1.5 bg-white text-primary focus:outline-none focus:ring-1 focus:ring-accent"
              >
                <option value="">All thinkers</option>
                {definition.available_thinkers.map((thinker) => (
                  <option key={thinker.id} value={thinker.id}>
                    {thinker.name}
                  </option>
                ))}
              </select>
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="text-xs text-accent hover:text-accent/80 underline transition-colors"
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0">
        {definition && !isLoading ? (
          <Group orientation="vertical" id="term-definition-sections-v2" className="h-full">
            <Panel id="term-definition-excerpts" defaultSize="52%" minSize="24%">
              <div className="h-full min-h-0 overflow-y-auto px-4 py-3">
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="text-xs font-sans font-semibold text-secondary uppercase tracking-wide">Excerpts</h4>
                  <span className="text-xs text-gray-400">{allExcerpts.length}</span>
                </div>

                <div className="space-y-2">
                  {allExcerpts.length === 0 ? (
                    <p className="text-sm text-gray-500 italic py-4 text-center">No excerpts found with current filters.</p>
                  ) : (
                    allExcerpts.map((excerpt) => (
                      <ExcerptCard
                        key={excerpt.id}
                        excerpt={excerpt}
                        termName={definition.term.name}
                        onClick={() => onNavigateToNote?.(excerpt.note_id)}
                      />
                    ))
                  )}
                </div>
              </div>
            </Panel>

            <ResizeHandle id="term-definition-analysis-resize" orientation="horizontal" />

            <Panel id="term-definition-analysis" defaultSize="48%" minSize="24%">
              <div className="h-full min-h-0 overflow-y-auto border-t border-gray-200">
                {notesAiFlags.phaseA ? (
                  <>
                    <div className="px-4 pt-3">
                      <div className="rounded border border-gray-200 bg-white p-2">
                        <p className="text-xs font-medium text-primary mb-2">Evidence Map</p>
                        <EvidenceMapPanel
                          termId={termId}
                          folderId={selectedFolderId}
                          thinkerId={selectedThinkerFilterId}
                          selectedOccurrenceId={selectedOccurrenceId}
                          onSelectOccurrence={setSelectedOccurrenceId}
                        />
                      </div>
                    </div>

                    <SynthesisView
                      termId={termId}
                      termName={definition.term.name}
                      folderId={selectedFolderId}
                      thinkerId={selectedThinkerFilterId}
                      filterContext={definition.filter_context}
                      totalExcerpts={definition.total_occurrences}
                      totalNotes={synthesisScope.noteCount}
                      totalThinkers={synthesisScope.thinkerCount}
                      sourceNoteTitles={synthesisScope.noteTitles}
                      onNavigateToNote={onNavigateToNote}
                    />
                  </>
                ) : (
                  <div className="px-4 py-3 text-xs text-secondary">
                    Synthesis features are disabled by phase flags.
                  </div>
                )}
              </div>
            </Panel>
          </Group>
        ) : (
          <div className="h-full overflow-y-auto px-4 py-3">
            {isLoading && (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-sm text-gray-500 font-serif italic">Gathering excerpts...</p>
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">
                Failed to load term definition. {(error as Error).message}
              </div>
            )}

            {!isLoading && !error && (
              <p className="text-sm text-gray-500 italic py-4 text-center">No term definition data available.</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
