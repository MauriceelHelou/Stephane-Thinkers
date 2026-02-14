import { describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import SynthesisView from '../notes/SynthesisView'
import { criticalTermsApi } from '@/lib/api'

function createQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

describe('SynthesisView', () => {
  it('requests synthesis on button click', async () => {
    vi.spyOn(criticalTermsApi, 'getSynthesis').mockResolvedValue({
      run: {
        id: 'run-1',
        term_id: 'term-1',
        mode: 'definition',
        filter_context: 'all notes',
        synthesis_text: 'Test synthesis [E1]',
        created_at: '2026-02-13T00:00:00Z',
      },
      citations: [
        {
          citation_key: 'E1',
          note_id: 'note-1',
          note_title: 'Note 1',
          context_snippet: 'example snippet',
        },
      ],
    } as any)
    vi.spyOn(criticalTermsApi, 'getSynthesisRuns').mockResolvedValue([])

    render(
      <QueryClientProvider client={createQueryClient()}>
        <SynthesisView
          termId="term-1"
          termName="habit"
          filterContext="all notes"
          totalExcerpts={4}
          totalNotes={2}
          totalThinkers={1}
          sourceNoteTitles={['Note 1']}
        />
      </QueryClientProvider>
    )

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /synthesize current scope/i }))
    expect(await screen.findByText('Test synthesis [E1]')).toBeInTheDocument()
  })
})
