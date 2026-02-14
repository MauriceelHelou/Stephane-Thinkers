import { afterEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { criticalTermsApi } from '@/lib/api'
import type { CriticalTermWithCount } from '@/types'
import { CriticalTermsList } from '../notes/CriticalTermsList'

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
      <CriticalTermsList onFlagNewTerm={vi.fn()} />
    </QueryClientProvider>
  )
}

function makeTerm(overrides: Partial<CriticalTermWithCount> = {}): CriticalTermWithCount {
  return {
    id: 'term-1',
    name: 'Reason',
    description: 'A foundational concept',
    is_active: true,
    occurrence_count: 1,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('CriticalTermsList - Refresh and Delete Behavior', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('refetches term instance counts when notes context is loaded again', async () => {
    const getAllSpy = vi
      .spyOn(criticalTermsApi, 'getAll')
      .mockResolvedValueOnce([makeTerm({ occurrence_count: 1 })])
      .mockResolvedValueOnce([makeTerm({ occurrence_count: 4 })])

    const queryClient = createProductionLikeQueryClient()

    const firstMount = renderWithQueryClient(queryClient)
    await screen.findByText('Reason')
    expect(screen.getByText('1')).toBeInTheDocument()

    firstMount.unmount()

    renderWithQueryClient(queryClient)

    await waitFor(() => {
      expect(getAllSpy).toHaveBeenCalledTimes(2)
    })
    await screen.findByText('4')
  })

  it('allows deleting a critical term from the list and refreshes results', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    const getAllSpy = vi.spyOn(criticalTermsApi, 'getAll').mockResolvedValue([makeTerm()])
    const deleteSpy = vi.spyOn(criticalTermsApi, 'delete').mockResolvedValue(undefined)

    const queryClient = createProductionLikeQueryClient()
    renderWithQueryClient(queryClient)

    await screen.findByText('Reason')

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /delete term/i }))

    await waitFor(() => {
      expect(deleteSpy).toHaveBeenCalledWith('term-1')
    })
    await waitFor(() => {
      expect(getAllSpy).toHaveBeenCalledTimes(2)
    })
  })

  it('does not delete a critical term when deletion is not confirmed', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)

    vi.spyOn(criticalTermsApi, 'getAll').mockResolvedValue([makeTerm()])
    const deleteSpy = vi.spyOn(criticalTermsApi, 'delete').mockResolvedValue(undefined)

    const queryClient = createProductionLikeQueryClient()
    renderWithQueryClient(queryClient)

    await screen.findByText('Reason')

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /delete term/i }))

    expect(deleteSpy).not.toHaveBeenCalled()
  })
})
