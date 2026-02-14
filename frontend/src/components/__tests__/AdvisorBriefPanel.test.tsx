import { describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'

import { analysisApi, notesApi } from '@/lib/api'
import { AdvisorBriefPanel } from '../notes/AdvisorBriefPanel'

function createQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

describe('AdvisorBriefPanel', () => {
  it('renders sections and toggles expansion', async () => {
    vi.spyOn(notesApi, 'getOne').mockResolvedValue({ title: 'Advisor Evidence Note' } as any)
    const onNavigateToNote = vi.fn()

    vi.spyOn(analysisApi, 'getAdvisorBrief').mockResolvedValue({
      date_window: 'last 7 days',
      highlights: ['Highlight item (evidence: 33333333-3333-3333-3333-333333333333)'],
      decisions_needed: ['Decision item'],
      open_risks: ['Risk item'],
    })

    render(
      <QueryClientProvider client={createQueryClient()}>
        <AdvisorBriefPanel onNavigateToNote={onNavigateToNote} />
      </QueryClientProvider>
    )

    expect(await screen.findByText(/Highlight item/)).toBeInTheDocument()
    expect(await screen.findByText(/Decision item/)).toBeInTheDocument()
    expect(await screen.findByText(/Risk item/)).toBeInTheDocument()
    expect(await screen.findByText(/Note: Advisor Evidence Note/)).toBeInTheDocument()

    const decisionsSectionButton = screen.getByRole('button', { name: /Decisions Needed/ })
    expect(decisionsSectionButton).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(decisionsSectionButton)
    expect(decisionsSectionButton).toHaveAttribute('aria-expanded', 'true')

    fireEvent.click(screen.getByRole('button', { name: /Note: Advisor Evidence Note/ }))
    expect(onNavigateToNote).toHaveBeenCalledWith('33333333-3333-3333-3333-333333333333')
  })
})
