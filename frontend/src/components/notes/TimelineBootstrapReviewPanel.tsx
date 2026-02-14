'use client'

import type {
  TimelineBootstrapCandidateItem,
  TimelineBootstrapCandidatesResponse,
  TimelineBootstrapEntityType,
  TimelineBootstrapSession,
} from '@/types'

export interface CandidateOverride {
  include?: boolean
  fields?: Record<string, unknown>
  match_action?: 'reuse' | 'create'
  matched_thinker_id?: string
}

interface TimelineDraftState {
  name: string
  description: string
  start_year: string
  end_year: string
}

interface TimelineBootstrapReviewPanelProps {
  session?: TimelineBootstrapSession
  timelineDraft: TimelineDraftState
  onTimelineFieldChange: (field: keyof TimelineDraftState, value: string) => void
  activeEntity: TimelineBootstrapEntityType
  onActiveEntityChange: (entity: TimelineBootstrapEntityType) => void
  candidates?: TimelineBootstrapCandidatesResponse
  thinkerNameByCandidateId?: Record<string, string>
  candidateOverrides: Record<string, CandidateOverride>
  onToggleInclude: (entityType: TimelineBootstrapEntityType, candidate: TimelineBootstrapCandidateItem, include: boolean) => void
  onFieldChange: (
    entityType: TimelineBootstrapEntityType,
    candidate: TimelineBootstrapCandidateItem,
    field: string,
    value: string
  ) => void
  onThinkerMatchChange: (
    candidate: TimelineBootstrapCandidateItem,
    action: 'reuse' | 'create',
    matchedThinkerId?: string
  ) => void
  onSaveValidation: () => void
  savePending: boolean
  onNextPage: () => void
}

const ENTITY_LABELS: Record<TimelineBootstrapEntityType, string> = {
  thinkers: 'Thinkers',
  events: 'Events',
  connections: 'Connections',
  publications: 'Publications',
  quotes: 'Quotes',
}

const EVENT_TYPES = ['council', 'publication', 'war', 'invention', 'cultural', 'political', 'other']
const CONNECTION_TYPES = ['influenced', 'critiqued', 'built_upon', 'synthesized']
const PUBLICATION_TYPES = ['book', 'article', 'chapter', 'thesis', 'conference', 'report', 'other']

function overrideKey(entityType: TimelineBootstrapEntityType, candidateId: string): string {
  return `${entityType}:${candidateId}`
}

function toInputValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value)
}

function EvidenceBlock({ candidate }: { candidate: TimelineBootstrapCandidateItem }) {
  if (!candidate.evidence || candidate.evidence.length === 0) return null

  return (
    <details className="rounded border border-gray-200 bg-gray-50 p-2">
      <summary className="cursor-pointer text-secondary">Evidence ({candidate.evidence.length})</summary>
      <div className="mt-2 space-y-1">
        {candidate.evidence.slice(0, 3).map((evidence, index) => (
          <div key={`${candidate.candidate_id}-evidence-${index}`} className="rounded border border-gray-200 bg-white p-1">
            <p className="text-[10px] text-secondary">
              chunk {evidence.chunk_index} | chars {evidence.char_start}-{evidence.char_end}
            </p>
            <p className="text-secondary">{evidence.excerpt}</p>
          </div>
        ))}
      </div>
    </details>
  )
}

export function TimelineBootstrapReviewPanel({
  session,
  timelineDraft,
  onTimelineFieldChange,
  activeEntity,
  onActiveEntityChange,
  candidates,
  thinkerNameByCandidateId = {},
  candidateOverrides,
  onToggleInclude,
  onFieldChange,
  onThinkerMatchChange,
  onSaveValidation,
  savePending,
  onNextPage,
}: TimelineBootstrapReviewPanelProps) {
  const rows = candidates?.items ?? []
  const thinkerLabel = (candidateId: unknown): string => {
    const key = toInputValue(candidateId)
    if (!key) return 'Unknown thinker'
    return thinkerNameByCandidateId[key] || key
  }

  return (
    <div className="space-y-3 rounded border border-gray-200 bg-white p-3 text-xs">
      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-primary">Review Timeline Preview</h4>
        <p className="text-secondary">Status: {session?.status ?? 'unknown'}</p>

        <div className="grid grid-cols-2 gap-2">
          <input
            value={timelineDraft.name}
            onChange={(event) => onTimelineFieldChange('name', event.target.value)}
            className="rounded border border-gray-300 p-1"
            placeholder="Timeline name"
          />
          <input
            value={timelineDraft.description}
            onChange={(event) => onTimelineFieldChange('description', event.target.value)}
            className="rounded border border-gray-300 p-1"
            placeholder="Description"
          />
          <input
            value={timelineDraft.start_year}
            onChange={(event) => onTimelineFieldChange('start_year', event.target.value)}
            className="rounded border border-gray-300 p-1"
            placeholder="Start year"
          />
          <input
            value={timelineDraft.end_year}
            onChange={(event) => onTimelineFieldChange('end_year', event.target.value)}
            className="rounded border border-gray-300 p-1"
            placeholder="End year"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-1">
        {(Object.keys(ENTITY_LABELS) as TimelineBootstrapEntityType[]).map((entity) => (
          <button
            key={entity}
            type="button"
            onClick={() => onActiveEntityChange(entity)}
            className={`rounded px-2 py-1 ${
              activeEntity === entity ? 'bg-accent text-white' : 'border border-gray-300 text-secondary'
            }`}
          >
            {ENTITY_LABELS[entity]}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {rows.length === 0 && <p className="text-secondary">No candidates for this entity type.</p>}

        {rows.map((candidate) => {
          const key = overrideKey(candidate.entity_type, candidate.candidate_id)
          const override = candidateOverrides[key] ?? {}
          const include = override.include ?? candidate.include
          const fields = { ...candidate.fields, ...(override.fields ?? {}) }
          const selectedMatchAction =
            candidate.entity_type === 'thinkers'
              ? override.match_action ?? (candidate.match_status === 'reuse_high_confidence' ? 'reuse' : undefined)
              : undefined
          const canReuseThinker = Boolean(candidate.matched_thinker_id)

          return (
            <div key={candidate.candidate_id} className="space-y-2 rounded border border-gray-200 p-2">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium text-primary">{candidate.candidate_id}</p>
                <label className="flex items-center gap-1 text-secondary">
                  <input
                    type="checkbox"
                    checked={include}
                    onChange={(event) => onToggleInclude(candidate.entity_type, candidate, event.target.checked)}
                  />
                  Include
                </label>
              </div>

              {candidate.entity_type === 'thinkers' && (
                <div className="grid grid-cols-2 gap-1">
                  <input
                    value={toInputValue(fields.name)}
                    onChange={(event) => onFieldChange(candidate.entity_type, candidate, 'name', event.target.value)}
                    className="rounded border border-gray-300 p-1"
                    placeholder="Name"
                  />
                  <input
                    value={toInputValue(fields.field)}
                    onChange={(event) => onFieldChange(candidate.entity_type, candidate, 'field', event.target.value)}
                    className="rounded border border-gray-300 p-1"
                    placeholder="Field"
                  />
                  <input
                    value={toInputValue(fields.birth_year)}
                    onChange={(event) => onFieldChange(candidate.entity_type, candidate, 'birth_year', event.target.value)}
                    className="rounded border border-gray-300 p-1"
                    placeholder="Birth year"
                  />
                  <input
                    value={toInputValue(fields.death_year)}
                    onChange={(event) => onFieldChange(candidate.entity_type, candidate, 'death_year', event.target.value)}
                    className="rounded border border-gray-300 p-1"
                    placeholder="Death year"
                  />
                </div>
              )}

              {candidate.entity_type === 'events' && (
                <div className="grid grid-cols-2 gap-1">
                  <input
                    value={toInputValue(fields.name)}
                    onChange={(event) => onFieldChange(candidate.entity_type, candidate, 'name', event.target.value)}
                    className="rounded border border-gray-300 p-1"
                    placeholder="Event name"
                  />
                  <input
                    value={toInputValue(fields.year)}
                    onChange={(event) => onFieldChange(candidate.entity_type, candidate, 'year', event.target.value)}
                    className="rounded border border-gray-300 p-1"
                    placeholder="Year"
                  />
                  <select
                    value={toInputValue(fields.event_type) || 'other'}
                    onChange={(event) => onFieldChange(candidate.entity_type, candidate, 'event_type', event.target.value)}
                    className="rounded border border-gray-300 p-1"
                  >
                    {EVENT_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {candidate.entity_type === 'connections' && (
                <div className="grid grid-cols-1 gap-1">
                  <select
                    value={toInputValue(fields.connection_type) || 'influenced'}
                    onChange={(event) =>
                      onFieldChange(candidate.entity_type, candidate, 'connection_type', event.target.value)
                    }
                    className="rounded border border-gray-300 p-1"
                  >
                    {CONNECTION_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                  <p className="text-secondary">
                    {thinkerLabel(fields.from_thinker_candidate_id)}
                    {' -> '}
                    {thinkerLabel(fields.to_thinker_candidate_id)}
                  </p>
                </div>
              )}

              {candidate.entity_type === 'publications' && (
                <div className="grid grid-cols-2 gap-1">
                  <input
                    value={toInputValue(fields.title)}
                    onChange={(event) => onFieldChange(candidate.entity_type, candidate, 'title', event.target.value)}
                    className="rounded border border-gray-300 p-1"
                    placeholder="Title"
                  />
                  <input
                    value={toInputValue(fields.year)}
                    onChange={(event) => onFieldChange(candidate.entity_type, candidate, 'year', event.target.value)}
                    className="rounded border border-gray-300 p-1"
                    placeholder="Year"
                  />
                  <select
                    value={toInputValue(fields.publication_type) || 'other'}
                    onChange={(event) =>
                      onFieldChange(candidate.entity_type, candidate, 'publication_type', event.target.value)
                    }
                    className="rounded border border-gray-300 p-1"
                  >
                    {PUBLICATION_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                  <p className="col-span-2 text-secondary">
                    Thinker: {thinkerLabel(fields.thinker_candidate_id)}
                  </p>
                </div>
              )}

              {candidate.entity_type === 'quotes' && (
                <div className="grid grid-cols-1 gap-1">
                  <textarea
                    value={toInputValue(fields.text)}
                    onChange={(event) => onFieldChange(candidate.entity_type, candidate, 'text', event.target.value)}
                    className="h-14 rounded border border-gray-300 p-1"
                    placeholder="Quote text"
                  />
                  <input
                    value={toInputValue(fields.year)}
                    onChange={(event) => onFieldChange(candidate.entity_type, candidate, 'year', event.target.value)}
                    className="rounded border border-gray-300 p-1"
                    placeholder="Year"
                  />
                  <p className="text-secondary">Thinker: {thinkerLabel(fields.thinker_candidate_id)}</p>
                </div>
              )}

              {candidate.entity_type === 'thinkers' && (
                <div className="space-y-1 border-t border-gray-100 pt-1">
                  <p className="text-secondary">Matcher status: {candidate.match_status ?? 'n/a'}</p>
                  {candidate.matched_thinker_id && (
                    <p className="text-secondary">Matched thinker: {candidate.matched_thinker_id}</p>
                  )}
                  {!candidate.matched_thinker_id && (
                    <p className="text-secondary">No reusable thinker match was found for this candidate.</p>
                  )}
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        onThinkerMatchChange(candidate, 'reuse', candidate.matched_thinker_id ?? undefined)
                      }
                      disabled={!canReuseThinker}
                      className={`rounded border px-2 py-1 ${
                        selectedMatchAction === 'reuse'
                          ? 'border-emerald-700 bg-emerald-700 text-white'
                          : 'border-gray-300 text-secondary'
                      } ${!canReuseThinker ? 'cursor-not-allowed opacity-50' : ''}`}
                    >
                      Reuse
                    </button>
                    <button
                      type="button"
                      onClick={() => onThinkerMatchChange(candidate, 'create')}
                      className={`rounded border px-2 py-1 ${
                        selectedMatchAction === 'create'
                          ? 'border-emerald-700 bg-emerald-700 text-white'
                          : 'border-gray-300 text-secondary'
                      }`}
                    >
                      Create new
                    </button>
                  </div>
                  <p className="text-secondary">
                    Decision: {selectedMatchAction === 'reuse' ? 'Reuse existing thinker' : selectedMatchAction === 'create' ? 'Create new thinker' : 'Not selected'}
                  </p>
                  {savePending && <p className="text-secondary">Saving decision...</p>}
                </div>
              )}

              <EvidenceBlock candidate={candidate} />
            </div>
          )
        })}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onSaveValidation}
          disabled={savePending}
          className="rounded bg-accent px-2 py-1 text-white"
        >
          {savePending ? 'Saving...' : 'Save validation'}
        </button>

        <button
          type="button"
          onClick={onNextPage}
          disabled={!candidates?.has_more}
          className="rounded border border-gray-300 px-2 py-1 text-secondary disabled:opacity-50"
        >
          Next page
        </button>
      </div>
    </div>
  )
}
