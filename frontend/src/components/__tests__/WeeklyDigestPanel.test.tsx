import { describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'

import { analysisApi, notesApi } from '@/lib/api'
import { WeeklyDigestPanel } from '../notes/WeeklyDigestPanel'

function createQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

describe('WeeklyDigestPanel', () => {
  it('renders digest and navigates when evidence note is clicked', async () => {
    vi.spyOn(notesApi, 'getOne').mockResolvedValue({ title: 'Digest Evidence Note' } as any)
    vi.spyOn(analysisApi, 'getLatestWeeklyDigest').mockResolvedValue({
      id: 'digest-1',
      period_start: '2026-01-01',
      period_end: '2026-01-07',
      digest_markdown:
        '## Weekly Digest (2026-01-01 to 2026-01-07)\n- Evidence line (evidence: 44444444-4444-4444-4444-444444444444)',
    })
    vi.spyOn(analysisApi, 'createWeeklyDigest').mockResolvedValue({
      id: 'digest-2',
      period_start: '2026-01-08',
      period_end: '2026-01-14',
      digest_markdown: '## Weekly Digest',
    })

    const onNavigateToNote = vi.fn()

    render(
      <QueryClientProvider client={createQueryClient()}>
        <WeeklyDigestPanel onNavigateToNote={onNavigateToNote} />
      </QueryClientProvider>
    )

    expect(await screen.findByText(/Weekly Digest/)).toBeInTheDocument()
    const evidenceButton = await screen.findByRole('button', { name: /Note: Digest Evidence Note/ })
    fireEvent.click(evidenceButton)

    expect(onNavigateToNote).toHaveBeenCalledWith('44444444-4444-4444-4444-444444444444')
  })
})
