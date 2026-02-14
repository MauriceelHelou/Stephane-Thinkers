import { describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'

import { jobsApi } from '@/lib/api'
import { AiJobStatus } from '../notes/AiJobStatus'

function createQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

describe('AiJobStatus', () => {
  it('renders job status', async () => {
    vi.spyOn(jobsApi, 'getStatus').mockResolvedValue({
      job_id: 'job-1',
      job_type: 'transcript',
      status: 'completed',
      result_json: '{}',
      error_message: null,
    })

    render(
      <QueryClientProvider client={createQueryClient()}>
        <AiJobStatus jobId="job-1" />
      </QueryClientProvider>
    )

    expect(await screen.findByText(/Status: completed/i)).toBeInTheDocument()
  })
})
