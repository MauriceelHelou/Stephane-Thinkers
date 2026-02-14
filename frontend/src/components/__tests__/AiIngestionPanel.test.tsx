import { describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { ingestionApi, jobsApi } from '@/lib/api'
import { AiIngestionPanel } from '../notes/AiIngestionPanel'

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}))

function createQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
}

describe('AiIngestionPanel', () => {
  it('submits preview request from input step', async () => {
    vi.spyOn(ingestionApi, 'createTimelinePreview').mockResolvedValue({
      job_id: 'job-1',
      session_id: 'session-1',
      status: 'queued',
      execution_mode: 'inline_dev',
    })
    vi.spyOn(ingestionApi, 'getTimelinePreviewSession').mockResolvedValue({
      session_id: 'session-1',
      ingestion_job_id: 'job-1',
      status: 'queued',
      timeline_name_suggested: 'Draft Timeline',
      summary_markdown: null,
      candidate_counts: {
        thinkers: 0,
        events: 0,
        connections: 0,
        publications: 0,
        quotes: 0,
      },
      warnings: [],
      partial: false,
      telemetry: {
        extraction_mode: 'full_context',
      },
      error_message: null,
      committed_timeline_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    vi.spyOn(jobsApi, 'getStatus').mockResolvedValue({
      job_id: 'job-1',
      job_type: 'text_to_timeline_preview',
      status: 'running',
      result_json: null,
      error_message: null,
    })

    render(
      <QueryClientProvider client={createQueryClient()}>
        <AiIngestionPanel />
      </QueryClientProvider>
    )

    await userEvent.type(screen.getByPlaceholderText(/Paste source text/i), 'Sample timeline text')
    await userEvent.click(screen.getByRole('button', { name: /Generate preview/i }))

    await waitFor(() => {
      expect(ingestionApi.createTimelinePreview).toHaveBeenCalledTimes(1)
    })
  })

  it('updates thinker match decision and auto-saves validation', async () => {
    vi.spyOn(ingestionApi, 'createTimelinePreview').mockResolvedValue({
      job_id: 'job-2',
      session_id: 'session-2',
      status: 'ready_for_review',
      execution_mode: 'inline_dev',
    })

    vi.spyOn(ingestionApi, 'getTimelinePreviewSession').mockResolvedValue({
      session_id: 'session-2',
      ingestion_job_id: 'job-2',
      status: 'ready_for_review',
      timeline_name_suggested: 'Draft Timeline',
      summary_markdown: null,
      candidate_counts: {
        thinkers: 1,
        events: 0,
        connections: 0,
        publications: 0,
        quotes: 0,
      },
      warnings: [],
      partial: false,
      telemetry: {
        extraction_mode: 'full_context',
      },
      error_message: null,
      committed_timeline_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })

    vi.spyOn(ingestionApi, 'getTimelinePreviewCandidates').mockImplementation(async (_sessionId, params) => {
      const thinkerCandidate = {
        candidate_id: 'thinker-1',
        entity_type: 'thinkers' as const,
        confidence: 0.92,
        include: true,
        fields: {
          name: 'Aristotle',
          field: 'Philosophy',
        },
        dependency_keys: [],
        evidence: [],
        match_status: 'review_needed',
        matched_thinker_id: null,
        match_score: null,
        match_reasons: [],
        metadata_delta: {},
        sort_key: 0,
      }

      return {
        items: [thinkerCandidate],
        next_cursor: null,
        has_more: false,
        total: 1,
      }
    })

    const updateValidationSpy = vi.spyOn(ingestionApi, 'updateTimelinePreviewValidation').mockResolvedValue({
      validation_json: { timeline: {}, candidates: {} },
      diagnostics: {
        blocking: [],
        non_blocking: [],
        has_blocking: false,
      },
    })

    vi.spyOn(jobsApi, 'getStatus').mockResolvedValue({
      job_id: 'job-2',
      job_type: 'text_to_timeline_preview',
      status: 'completed',
      result_json: null,
      error_message: null,
    })

    render(
      <QueryClientProvider client={createQueryClient()}>
        <AiIngestionPanel />
      </QueryClientProvider>
    )

    await userEvent.type(screen.getByPlaceholderText(/Paste source text/i), 'Sample timeline text')
    await userEvent.click(screen.getByRole('button', { name: /Generate preview/i }))

    await screen.findByText(/Review Timeline Preview/i)
    await userEvent.click(screen.getByRole('button', { name: /Create new/i }))

    await screen.findByText(/Decision: Create new thinker/i)
    await waitFor(() => {
      expect(updateValidationSpy).toHaveBeenCalled()
    })

    const [, payload] = updateValidationSpy.mock.calls.at(-1) ?? []
    expect(payload?.candidates?.some((candidate: { match_action?: string; candidate_id?: string }) => (
      candidate.candidate_id === 'thinker-1' && candidate.match_action === 'create'
    ))).toBe(true)
  })
})
