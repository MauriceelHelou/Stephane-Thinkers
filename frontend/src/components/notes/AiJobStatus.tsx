'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { jobsApi } from '@/lib/api'

interface AiJobStatusProps {
  jobId?: string
}

export function AiJobStatus({ jobId }: AiJobStatusProps) {
  const queryClient = useQueryClient()
  const { data } = useQuery({
    queryKey: ['job-status', jobId],
    queryFn: () => jobsApi.getStatus(jobId!),
    enabled: !!jobId,
    refetchInterval: 2000,
  })

  const cancelMutation = useMutation({
    mutationFn: () => jobsApi.cancel(jobId!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['job-status', jobId] }),
  })

  const retryMutation = useMutation({
    mutationFn: () => jobsApi.retry(jobId!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['job-status', jobId] }),
  })

  if (!jobId) return <p className="text-xs text-secondary">No job started.</p>
  if (!data) return <p className="text-xs text-secondary">Loading job status...</p>

  return (
    <div className="p-2 border border-gray-100 rounded text-xs space-y-1">
      <p className="text-primary">Job: {data.job_type}</p>
      <p className="text-secondary">Status: {data.status}</p>
      {data.error_message && <p className="text-red-600">{data.error_message}</p>}
      <div className="flex gap-2 pt-1">
        {data.status === 'queued' && (
          <button
            type="button"
            onClick={() => cancelMutation.mutate()}
            disabled={cancelMutation.isPending}
            className="px-2 py-1 text-xs rounded border border-gray-300 text-secondary"
          >
            {cancelMutation.isPending ? 'Cancelling...' : 'Cancel'}
          </button>
        )}
        {(data.status === 'failed' || data.status === 'cancelled') && (
          <button
            type="button"
            onClick={() => retryMutation.mutate()}
            disabled={retryMutation.isPending}
            className="px-2 py-1 text-xs rounded bg-accent text-white"
          >
            {retryMutation.isPending ? 'Retrying...' : 'Retry'}
          </button>
        )}
      </div>
    </div>
  )
}
