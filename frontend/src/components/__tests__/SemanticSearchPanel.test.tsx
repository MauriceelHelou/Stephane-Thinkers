import { describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { analysisApi } from '@/lib/api'
import { SemanticSearchPanel } from '../notes/SemanticSearchPanel'

function createQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

describe('SemanticSearchPanel', () => {
  it('shows results for a query', async () => {
    vi.spyOn(analysisApi, 'semanticSearch').mockResolvedValue([
      {
        note_id: 'note-1',
        note_title: 'Semantic note',
        excerpt: 'semantic snippet',
        score: 0.83,
      },
    ])

    render(
      <QueryClientProvider client={createQueryClient()}>
        <SemanticSearchPanel />
      </QueryClientProvider>
    )

    const user = userEvent.setup()
    await user.type(screen.getByPlaceholderText(/semantic search in notes/i), 'ha')
    expect(await screen.findByText(/Semantic note/i)).toBeInTheDocument()
  })

  it('navigates to a note when a result is clicked', async () => {
    vi.spyOn(analysisApi, 'semanticSearch').mockResolvedValue([
      {
        note_id: 'note-abc',
        note_title: 'Clickable note',
        excerpt: 'click me',
        score: 0.91,
      },
    ])
    const onNavigateToNote = vi.fn()

    render(
      <QueryClientProvider client={createQueryClient()}>
        <SemanticSearchPanel onNavigateToNote={onNavigateToNote} />
      </QueryClientProvider>
    )

    const user = userEvent.setup()
    await user.type(screen.getByPlaceholderText(/semantic search in notes/i), 'ha')
    await user.click(await screen.findByRole('button', { name: /clickable note/i }))
    expect(onNavigateToNote).toHaveBeenCalledWith('note-abc')
  })
})
