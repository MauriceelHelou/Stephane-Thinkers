'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'

import { ingestionApi } from '@/lib/api'
import { notesAiFlags } from '@/lib/notesAiFlags'
import type {
  TimelineBootstrapCandidateItem,
  TimelineBootstrapCommitResponse,
  TimelineBootstrapDiagnostics,
  TimelineBootstrapEntityType,
  TimelineBootstrapSession,
} from '@/types'
import { AiJobStatus } from './AiJobStatus'
import { CandidateOverride, TimelineBootstrapReviewPanel } from './TimelineBootstrapReviewPanel'
import { TimelineBootstrapCommitResult } from './TimelineBootstrapCommitResult'
import { TimelineBootstrapSummaryPreview } from './TimelineBootstrapSummaryPreview'
import { TimelineBootstrapVerificationPanel } from './TimelineBootstrapVerificationPanel'

type TimelineDraftState = {
  name: string
  description: string
  start_year: string
  end_year: string
}

const READY_STATUSES = new Set(['ready_for_review', 'ready_for_review_partial'])

function parseOptionalInt(value: string): number | undefined {
  const trimmed = value.trim()
  if (!trimmed) return undefined
  const parsed = Number.parseInt(trimmed, 10)
  return Number.isFinite(parsed) ? parsed : undefined
}

function normalizeFieldValue(field: string, value: unknown): unknown {
  if (typeof value !== 'string') return value
  if (field.toLowerCase().includes('year')) {
    const parsed = Number.parseInt(value, 10)
    if (Number.isFinite(parsed)) return parsed
  }
  return value
}

function keyForOverride(entityType: TimelineBootstrapEntityType, candidateId: string): string {
  return `${entityType}:${candidateId}`
}

function initialTimelineDraft(session?: TimelineBootstrapSession): TimelineDraftState {
  return {
    name: session?.timeline_name_suggested ?? '',
    description: '',
    start_year: '',
    end_year: '',
  }
}

function buildValidationPayload(
  timelineDraft: TimelineDraftState,
  candidateOverrides: Record<string, CandidateOverride>
) {
  const timelinePayload = {
    name: timelineDraft.name.trim() || undefined,
    description: timelineDraft.description.trim() || undefined,
    start_year: parseOptionalInt(timelineDraft.start_year),
    end_year: parseOptionalInt(timelineDraft.end_year),
  }

  const candidateUpdates = Object.entries(candidateOverrides).map(([key, override]) => {
    const [entity_type, candidate_id] = key.split(':')
    const fields = Object.entries(override.fields ?? {}).reduce<Record<string, unknown>>((acc, [field, value]) => {
      acc[field] = normalizeFieldValue(field, value)
      return acc
    }, {})

    return {
      entity_type: entity_type as TimelineBootstrapEntityType,
      candidate_id,
      include: override.include,
      fields: Object.keys(fields).length > 0 ? fields : undefined,
      match_action: override.match_action,
      matched_thinker_id: override.matched_thinker_id,
    }
  })

  return {
    timeline: timelinePayload,
    candidates: candidateUpdates,
  }
}

export function AiIngestionPanel() {
  const queryClient = useQueryClient()
  const router = useRouter()

  const [fileName, setFileName] = useState('source-text.txt')
  const [timelineNameHint, setTimelineNameHint] = useState('')
  const [startYearHint, setStartYearHint] = useState('')
  const [endYearHint, setEndYearHint] = useState('')
  const [text, setText] = useState('')

  const [sessionId, setSessionId] = useState<string | undefined>()
  const [jobId, setJobId] = useState<string | undefined>()
  const [activeEntity, setActiveEntity] = useState<TimelineBootstrapEntityType>('thinkers')
  const [candidateCursor, setCandidateCursor] = useState<string | undefined>()
  const [candidateOverrides, setCandidateOverrides] = useState<Record<string, CandidateOverride>>({})
  const [timelineDraft, setTimelineDraft] = useState<TimelineDraftState>(initialTimelineDraft())
  const [diagnostics, setDiagnostics] = useState<TimelineBootstrapDiagnostics | undefined>()
  const [commitResult, setCommitResult] = useState<TimelineBootstrapCommitResponse | undefined>()
  const [forceSkipInvalid, setForceSkipInvalid] = useState(true)
  const candidateOverridesRef = useRef<Record<string, CandidateOverride>>({})

  const createPreviewMutation = useMutation({
    mutationFn: async () => {
      return ingestionApi.createTimelinePreview({
        file_name: fileName.trim() || 'source-text.txt',
        content: text,
        timeline_name_hint: timelineNameHint.trim() || undefined,
        start_year_hint: parseOptionalInt(startYearHint),
        end_year_hint: parseOptionalInt(endYearHint),
      })
    },
    onSuccess: (response) => {
      setSessionId(response.session_id)
      setJobId(response.job_id)
      setActiveEntity('thinkers')
      setCandidateCursor(undefined)
      setCandidateOverrides({})
      setTimelineDraft(initialTimelineDraft())
      setDiagnostics(undefined)
      setCommitResult(undefined)
    },
  })

  const sessionQuery = useQuery({
    queryKey: ['timeline-preview-session', sessionId],
    queryFn: () => ingestionApi.getTimelinePreviewSession(sessionId!),
    enabled: !!sessionId,
    refetchInterval: (query) => {
      const status = query.state.data?.status
      if (!status) return 2000
      if (status === 'queued' || status === 'running' || status === 'committing') {
        return 2000
      }
      return false
    },
  })

  const session = sessionQuery.data

  useEffect(() => {
    if (!session) return
    setTimelineDraft((current) => {
      if (current.name || current.description || current.start_year || current.end_year) {
        return current
      }
      return initialTimelineDraft(session)
    })
  }, [session])

  useEffect(() => {
    setCandidateCursor(undefined)
  }, [activeEntity, sessionId])

  useEffect(() => {
    candidateOverridesRef.current = candidateOverrides
  }, [candidateOverrides])

  const candidatesQuery = useQuery({
    queryKey: ['timeline-preview-candidates', sessionId, activeEntity, candidateCursor],
    queryFn: () =>
      ingestionApi.getTimelinePreviewCandidates(sessionId!, {
        entity_type: activeEntity,
        limit: 25,
        cursor: candidateCursor,
        include_evidence: true,
      }),
    enabled: !!sessionId && !!session && READY_STATUSES.has(session.status),
  })

  const thinkerNameMapQuery = useQuery({
    queryKey: ['timeline-preview-thinker-map', sessionId],
    queryFn: async () => {
      if (!sessionId) return {}

      const lookup: Record<string, string> = {}
      let cursor: string | undefined = undefined
      let guard = 0

      while (guard < 20) {
        const response = await ingestionApi.getTimelinePreviewCandidates(sessionId, {
          entity_type: 'thinkers',
          limit: 200,
          cursor,
          include_evidence: false,
        })
        response.items.forEach((item) => {
          const thinkerName = String(item.fields?.name ?? '').trim()
          if (thinkerName) {
            lookup[item.candidate_id] = thinkerName
          }
        })
        if (!response.has_more || !response.next_cursor) break
        cursor = response.next_cursor
        guard += 1
      }

      return lookup
    },
    enabled: !!sessionId && !!session && READY_STATUSES.has(session.status),
  })

  const saveValidationMutation = useMutation({
    mutationFn: async (
      input?: {
        candidateOverrides?: Record<string, CandidateOverride>
        timelineDraft?: TimelineDraftState
      }
    ) => {
      if (!sessionId) throw new Error('No preview session available')
      return ingestionApi.updateTimelinePreviewValidation(
        sessionId,
        buildValidationPayload(input?.timelineDraft ?? timelineDraft, input?.candidateOverrides ?? candidateOverrides)
      )
    },
    onSuccess: (response) => {
      setDiagnostics(response.diagnostics)
      queryClient.invalidateQueries({ queryKey: ['timeline-preview-session', sessionId] })
    },
  })

  const commitMutation = useMutation({
    mutationFn: async () => {
      if (!sessionId) throw new Error('No preview session available')
      return ingestionApi.commitTimelinePreview(sessionId, { force_skip_invalid: forceSkipInvalid })
    },
    onSuccess: (response) => {
      setCommitResult(response)
      queryClient.invalidateQueries({ queryKey: ['timelines'] })
      queryClient.invalidateQueries({ queryKey: ['thinkers'] })
      queryClient.invalidateQueries({ queryKey: ['timeline-events'] })
      queryClient.invalidateQueries({ queryKey: ['connections'] })
      queryClient.invalidateQueries({ queryKey: ['publications'] })
      queryClient.invalidateQueries({ queryKey: ['quotes'] })
      queryClient.invalidateQueries({ queryKey: ['timeline-preview-session', sessionId] })
    },
  })

  const activeStep = useMemo(() => {
    if (commitResult) return 'committed'
    if (!session) return 'input'
    if (READY_STATUSES.has(session.status)) return 'review'
    return 'processing'
  }, [session, commitResult])

  const handleToggleInclude = (
    entityType: TimelineBootstrapEntityType,
    candidate: TimelineBootstrapCandidateItem,
    include: boolean
  ) => {
    const key = keyForOverride(entityType, candidate.candidate_id)
    setCandidateOverrides((current) => ({
      ...current,
      [key]: {
        ...(current[key] ?? {}),
        include,
      },
    }))
  }

  const handleFieldChange = (
    entityType: TimelineBootstrapEntityType,
    candidate: TimelineBootstrapCandidateItem,
    field: string,
    value: string
  ) => {
    const key = keyForOverride(entityType, candidate.candidate_id)
    setCandidateOverrides((current) => ({
      ...current,
      [key]: {
        ...(current[key] ?? {}),
        fields: {
          ...((current[key] ?? {}).fields ?? {}),
          [field]: value,
        },
      },
    }))
  }

  const handleThinkerMatchChange = (
    candidate: TimelineBootstrapCandidateItem,
    action: 'reuse' | 'create',
    matchedThinkerId?: string
  ) => {
    const key = keyForOverride('thinkers', candidate.candidate_id)
    const nextOverrides = {
      ...candidateOverridesRef.current,
      [key]: {
        ...(candidateOverridesRef.current[key] ?? {}),
        match_action: action,
        matched_thinker_id: matchedThinkerId,
      },
    }

    candidateOverridesRef.current = nextOverrides
    setCandidateOverrides(nextOverrides)

    if (session && READY_STATUSES.has(session.status)) {
      saveValidationMutation.mutate({ candidateOverrides: nextOverrides })
    }
  }

  const handleSaveValidation = () => {
    saveValidationMutation.mutate(undefined)
  }

  const handleCommit = async () => {
    try {
      const validationResult = await saveValidationMutation.mutateAsync(undefined)
      if (validationResult.diagnostics.has_blocking && !forceSkipInvalid) {
        return
      }
      await commitMutation.mutateAsync()
    } catch {
      // Error is surfaced through mutation state.
    }
  }

  const handleOpenTimeline = (timelineId: string) => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('focus_timeline_id', timelineId)
    }
    router.push('/')
  }

  if (!notesAiFlags.timelineBootstrap) {
    return (
      <div className="space-y-2 text-xs">
        <p className="text-secondary">Timeline bootstrap is disabled by feature flag.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3 text-xs">
      {activeStep === 'input' && (
        <div className="space-y-2 rounded border border-gray-200 bg-white p-3">
          <h4 className="text-sm font-semibold text-primary">Text to Timeline</h4>
          <input
            value={fileName}
            onChange={(event) => setFileName(event.target.value)}
            className="w-full rounded border border-gray-300 p-1"
            placeholder="Source file name"
          />
          <input
            value={timelineNameHint}
            onChange={(event) => setTimelineNameHint(event.target.value)}
            className="w-full rounded border border-gray-300 p-1"
            placeholder="Timeline name hint (optional)"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              value={startYearHint}
              onChange={(event) => setStartYearHint(event.target.value)}
              className="rounded border border-gray-300 p-1"
              placeholder="Start year hint"
            />
            <input
              value={endYearHint}
              onChange={(event) => setEndYearHint(event.target.value)}
              className="rounded border border-gray-300 p-1"
              placeholder="End year hint"
            />
          </div>
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            className="h-32 w-full rounded border border-gray-300 p-2"
            placeholder="Paste source text"
          />

          <button
            type="button"
            onClick={() => createPreviewMutation.mutate()}
            className="rounded bg-accent px-2 py-1 text-white"
            disabled={!text.trim() || createPreviewMutation.isPending}
          >
            {createPreviewMutation.isPending ? 'Generating preview...' : 'Generate preview'}
          </button>

          {createPreviewMutation.error && (
            <p className="text-red-600">{(createPreviewMutation.error as Error).message}</p>
          )}
        </div>
      )}

      {activeStep === 'processing' && (
        <div className="space-y-2 rounded border border-blue-200 bg-blue-50 p-3">
          <p className="font-medium text-blue-900">Processing timeline preview...</p>
          {session && <p className="text-blue-800">Session status: {session.status}</p>}
          <AiJobStatus jobId={jobId} />
        </div>
      )}

      {activeStep === 'review' && (
        <div className="space-y-3">
          {session && <TimelineBootstrapSummaryPreview session={session} />}

          <TimelineBootstrapReviewPanel
            session={session}
            timelineDraft={timelineDraft}
            onTimelineFieldChange={(field, value) => setTimelineDraft((current) => ({ ...current, [field]: value }))}
            activeEntity={activeEntity}
            onActiveEntityChange={setActiveEntity}
            candidates={candidatesQuery.data}
            thinkerNameByCandidateId={thinkerNameMapQuery.data}
            candidateOverrides={candidateOverrides}
            onToggleInclude={handleToggleInclude}
            onFieldChange={handleFieldChange}
            onThinkerMatchChange={handleThinkerMatchChange}
            onSaveValidation={handleSaveValidation}
            savePending={saveValidationMutation.isPending}
            onNextPage={() => setCandidateCursor(candidatesQuery.data?.next_cursor ?? undefined)}
          />

          <TimelineBootstrapVerificationPanel
            session={session}
            diagnostics={diagnostics}
            forceSkipInvalid={forceSkipInvalid}
          />

          <div className="space-y-2 rounded border border-gray-200 bg-white p-3">
            <label className="flex items-center gap-2 text-secondary">
              <input
                type="checkbox"
                checked={forceSkipInvalid}
                onChange={(event) => setForceSkipInvalid(event.target.checked)}
              />
              Skip invalid candidates at commit time
            </label>

            {diagnostics?.has_blocking && !forceSkipInvalid && (
              <p className="text-red-600">Resolve blocking issues or enable skip-invalid before commit.</p>
            )}

            <button
              type="button"
              onClick={handleCommit}
              disabled={
                commitMutation.isPending ||
                saveValidationMutation.isPending ||
                (!!diagnostics?.has_blocking && !forceSkipInvalid)
              }
              className="rounded bg-emerald-700 px-2 py-1 text-white"
            >
              {commitMutation.isPending ? 'Committing...' : 'Commit to timeline'}
            </button>

            {commitMutation.error && <p className="text-red-600">{(commitMutation.error as Error).message}</p>}
          </div>
        </div>
      )}

      {activeStep === 'committed' && commitResult && (
        <TimelineBootstrapCommitResult result={commitResult} onOpenTimeline={handleOpenTimeline} />
      )}
    </div>
  )
}
