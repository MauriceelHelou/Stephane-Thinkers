import { afterEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'

import { analysisApi } from '@/lib/api'
import type { ConnectionSuggestionFromNotes } from '@/types'
import { ConnectionSuggestionsPanel } from '../notes/ConnectionSuggestionsPanel'

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
      <ConnectionSuggestionsPanel folderId="folder-1" />
    </QueryClientProvider>
  )
}

function makeSuggestion(overrides: Partial<ConnectionSuggestionFromNotes> = {}): ConnectionSuggestionFromNotes {
  return {
    thinker_a_id: 'thinker-1',
    thinker_a_name: 'Immanuel Kant',
    thinker_a_birth_year: 1724,
    thinker_a_death_year: 1804,
    thinker_b_id: 'thinker-2',
    thinker_b_name: 'Georg Hegel',
    thinker_b_birth_year: 1770,
    thinker_b_death_year: 1831,
    co_occurrence_count: 2,
    same_paragraph_count: 1,
    sample_note_titles: ['Critique notes'],
    sample_excerpts: ['Kant and Hegel appear in the same paragraph.'],
    confidence: 'high',
    ...overrides,
  }
}

describe('ConnectionSuggestionsPanel - Refresh Behavior', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('refetches suggestions when the panel is opened again', async () => {
    const suggestionsSpy = vi
      .spyOn(analysisApi, 'getConnectionSuggestions')
      .mockResolvedValueOnce([makeSuggestion({ co_occurrence_count: 2 })])
      .mockResolvedValueOnce([makeSuggestion({ co_occurrence_count: 6 })])
    const explanationsSpy = vi
      .spyOn(analysisApi, 'getConnectionExplanations')
      .mockResolvedValue([])

    const queryClient = createProductionLikeQueryClient()

    const firstMount = renderWithQueryClient(queryClient)
    await screen.findByText('Immanuel Kant')

    firstMount.unmount()

    renderWithQueryClient(queryClient)

    await waitFor(() => {
      expect(suggestionsSpy).toHaveBeenCalledTimes(2)
      expect(explanationsSpy).toHaveBeenCalled()
    })
  })
})
