import { describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'

import { analysisApi, notesApi } from '@/lib/api'
import { VivaPracticePanel } from '../notes/VivaPracticePanel'

function createQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

describe('VivaPracticePanel', () => {
  it('renders viva cards and expands details on click', async () => {
    const fullRubric =
      'Use claim and one limitation, then cite at least two concrete excerpts, compare competing interpretations, justify method choice, and show how this evidence shifts chapter-level argument strategy in measurable terms FINAL_RUBRIC_MARKER'

    vi.spyOn(analysisApi, 'getVivaPractice').mockResolvedValue({
      topic: 'general',
      questions: [
        {
          question: 'How does this support your thesis?',
          expected_answer_rubric: fullRubric,
          evidence_refs: ['22222222-2222-2222-2222-222222222222'],
        },
      ],
    })
    vi.spyOn(notesApi, 'getOne').mockResolvedValue({ title: 'Method Evidence Note' } as any)
    const onNavigateToNote = vi.fn()

    render(
      <QueryClientProvider client={createQueryClient()}>
        <VivaPracticePanel onNavigateToNote={onNavigateToNote} />
      </QueryClientProvider>
    )

    expect(await screen.findByText(/How does this support your thesis/)).toBeInTheDocument()
    expect(await screen.findByText(/Evidence:/)).toBeInTheDocument()
    expect(screen.queryByText(/FINAL_RUBRIC_MARKER/)).not.toBeInTheDocument()
    expect(screen.queryByText(/22222222-2222-2222-2222-222222222222/)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /How does this support your thesis/ }))

    expect(await screen.findByText(/FINAL_RUBRIC_MARKER/)).toBeInTheDocument()
    expect(await screen.findByText(/Note: Method Evidence Note/)).toBeInTheDocument()
    expect(screen.queryByText(/22222222-2222-2222-2222-222222222222/)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Note: Method Evidence Note/ }))
    expect(onNavigateToNote).toHaveBeenCalledWith('22222222-2222-2222-2222-222222222222')
  })
})
