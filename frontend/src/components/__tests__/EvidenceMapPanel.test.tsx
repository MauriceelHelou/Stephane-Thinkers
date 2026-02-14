import { describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'

import { criticalTermsApi } from '@/lib/api'
import { EvidenceMapPanel } from '../notes/EvidenceMapPanel'

function createQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

describe('EvidenceMapPanel', () => {
  it('renders evidence stats and snippets', async () => {
    vi.spyOn(criticalTermsApi, 'getEvidenceMap').mockResolvedValue({
      term: {
        id: 'term-1',
        name: 'habit',
        is_active: true,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
      excerpts: [
        {
          id: 'occ-1',
          note_id: 'note-1',
          context_snippet: 'habit appears here',
          created_at: '2026-01-01T00:00:00Z',
          thinker_names: [],
        },
      ],
      stats: {
        total_occurrences: 1,
        total_notes: 1,
        thinker_distribution: {},
        folder_distribution: {},
        co_terms: [],
      },
    } as any)

    render(
      <QueryClientProvider client={createQueryClient()}>
        <EvidenceMapPanel termId="term-1" />
      </QueryClientProvider>
    )

    expect(await screen.findByText(/1 occurrences across 1 notes/i)).toBeInTheDocument()
    expect(screen.getByText(/habit appears here/i)).toBeInTheDocument()
  })
})
