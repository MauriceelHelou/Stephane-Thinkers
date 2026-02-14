import { describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'

import { analysisApi, notesApi } from '@/lib/api'
import { ResearchSprintPlanner } from '../notes/ResearchSprintPlanner'

function createQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

describe('ResearchSprintPlanner', () => {
  it('renders plan tasks and expands card details on click', async () => {
    const fullRationale =
      'Prioritize this item for this week to keep chapter momentum high and reduce uncertainty before advisor review by consolidating excerpts, validating citations, drafting argument transitions, and aligning terminology across sections before submission FINAL_DETAIL_MARKER'

    vi.spyOn(analysisApi, 'getResearchSprintPlan').mockResolvedValue({
      focus: 'all notes',
      tasks: [
        {
          title: 'Task 1',
          rationale: fullRationale,
          evidence_refs: ['11111111-1111-1111-1111-111111111111'],
        },
      ],
    })
    vi.spyOn(notesApi, 'getOne').mockResolvedValue({ title: 'Evidence Note' } as any)
    const onNavigateToNote = vi.fn()

    render(
      <QueryClientProvider client={createQueryClient()}>
        <ResearchSprintPlanner onNavigateToNote={onNavigateToNote} />
      </QueryClientProvider>
    )

    expect(await screen.findByText(/Task 1/)).toBeInTheDocument()
    expect(await screen.findByText(/Evidence:/)).toBeInTheDocument()
    expect(screen.queryByText(/FINAL_DETAIL_MARKER/)).not.toBeInTheDocument()
    expect(screen.queryByText(/11111111-1111-1111-1111-111111111111/)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Task 1/ }))

    expect(await screen.findByText(/FINAL_DETAIL_MARKER/)).toBeInTheDocument()
    expect(await screen.findByText(/Note: Evidence Note/)).toBeInTheDocument()
    expect(screen.queryByText(/11111111-1111-1111-1111-111111111111/)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Note: Evidence Note/ }))
    expect(onNavigateToNote).toHaveBeenCalledWith('11111111-1111-1111-1111-111111111111')
  })
})
