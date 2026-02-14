import { afterEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'

import { analysisApi } from '@/lib/api'
import type { TermThinkerMatrix } from '@/types'
import ConstellationChart from '../notes/ConstellationChart'

function createProductionLikeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 60_000,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: false,
      },
    },
  })
}

function renderWithQueryClient(queryClient: QueryClient) {
  return render(
    <QueryClientProvider client={queryClient}>
      <ConstellationChart folderId="folder-1" />
    </QueryClientProvider>
  )
}

function makeMatrix(overrides: Partial<TermThinkerMatrix> = {}): TermThinkerMatrix {
  return {
    bubbles: [
      {
        term_id: 'term-1',
        term_name: 'Reason',
        thinker_id: 'thinker-1',
        thinker_name: 'Immanuel Kant',
        thinker_birth_year: 1724,
        thinker_death_year: 1804,
        frequency: 3,
        sample_snippets: ['Reason and Kant are co-mentioned in this note.'],
      },
    ],
    terms: ['Reason'],
    thinkers: ['Immanuel Kant'],
    total_bubbles: 1,
    max_frequency: 3,
    ...overrides,
  }
}

describe('ConstellationChart - Refresh and Zoom Behavior', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('refetches constellation data when the panel is loaded again', async () => {
    const matrixSpy = vi
      .spyOn(analysisApi, 'getTermThinkerMatrix')
      .mockResolvedValueOnce(makeMatrix({ max_frequency: 2 }))
      .mockResolvedValueOnce(makeMatrix({ max_frequency: 5 }))

    const queryClient = createProductionLikeQueryClient()

    const firstMount = renderWithQueryClient(queryClient)
    await screen.findByText('1 pairs')

    firstMount.unmount()

    renderWithQueryClient(queryClient)

    await waitFor(() => {
      expect(matrixSpy).toHaveBeenCalledTimes(2)
    })
  })

  it('exposes zoom controls so users can zoom into constellation data', async () => {
    vi.spyOn(analysisApi, 'getTermThinkerMatrix').mockResolvedValue(makeMatrix())

    const queryClient = createProductionLikeQueryClient()
    renderWithQueryClient(queryClient)

    await screen.findByText('1 pairs')

    expect(screen.getByRole('button', { name: /zoom in/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /zoom out/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /reset zoom/i })).toBeInTheDocument()
  })
})
