import { describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { notesApi } from '@/lib/api'
import { DraftFromExcerptsModal } from '../notes/DraftFromExcerptsModal'

function createQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
}

describe('DraftFromExcerptsModal', () => {
  it('generates and inserts draft', async () => {
    const insertSpy = vi.fn()
    vi.spyOn(notesApi, 'draftFromExcerpts').mockResolvedValue({
      draft: 'Synthesized draft text',
      citations: ['note-1'],
    })

    render(
      <QueryClientProvider client={createQueryClient()}>
        <DraftFromExcerptsModal excerptIds={['occ-1']} onInsert={insertSpy} />
      </QueryClientProvider>
    )

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /^Draft$/i }))
    expect(await screen.findByDisplayValue(/Synthesized draft text/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /insert draft/i }))
    expect(insertSpy).toHaveBeenCalledWith('Synthesized draft text')
  })
})
