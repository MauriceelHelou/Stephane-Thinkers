import { describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'

import { criticalTermsApi } from '@/lib/api'
import { QualityReportPanel } from '../notes/QualityReportPanel'

function createQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

describe('QualityReportPanel', () => {
  it('renders quality metrics', async () => {
    vi.spyOn(criticalTermsApi, 'getQualityReport').mockResolvedValue({
      coverage_rate: 0.75,
      unsupported_claims: ['1 sentence missing citation'],
      contradiction_signals: [],
      uncertainty_label: 'medium',
    })

    render(
      <QueryClientProvider client={createQueryClient()}>
        <QualityReportPanel termId="term-1" />
      </QueryClientProvider>
    )

    expect(await screen.findByText(/Coverage: 75%/i)).toBeInTheDocument()
    expect(screen.getByText(/1 sentence missing citation/i)).toBeInTheDocument()
  })
})
