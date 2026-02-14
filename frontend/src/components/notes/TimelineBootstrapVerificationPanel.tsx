'use client'

import type { TimelineBootstrapDiagnostics, TimelineBootstrapSession } from '@/types'

interface TimelineBootstrapVerificationPanelProps {
  session?: TimelineBootstrapSession
  diagnostics?: TimelineBootstrapDiagnostics
  forceSkipInvalid: boolean
}

export function TimelineBootstrapVerificationPanel({
  session,
  diagnostics,
  forceSkipInvalid,
}: TimelineBootstrapVerificationPanelProps) {
  const blockingCount = diagnostics?.blocking.length ?? 0
  const warningCount = diagnostics?.non_blocking.length ?? 0

  const commitReady = forceSkipInvalid || blockingCount === 0
  const extractionMode = String(session?.telemetry?.extraction_mode ?? 'unknown')

  return (
    <div className="space-y-2 rounded border border-amber-200 bg-amber-50 p-3 text-xs">
      <h4 className="text-sm font-semibold text-amber-900">Verification Panel</h4>

      <p className="text-amber-900">Session status: {session?.status ?? 'unknown'}</p>
      <p className="text-amber-900">Extraction mode: {extractionMode}</p>
      <p className={commitReady ? 'text-emerald-800' : 'text-red-700'}>
        Commit readiness: {commitReady ? 'ready' : 'blocked'}
      </p>
      <p className="text-amber-900">Blocking issues: {blockingCount}</p>
      <p className="text-amber-900">Warnings: {warningCount}</p>

      {blockingCount > 0 && (
        <div className="rounded border border-red-300 bg-red-50 p-2">
          <p className="font-medium text-red-700">Blocking diagnostics</p>
          <div className="mt-1 space-y-1">
            {diagnostics?.blocking.slice(0, 8).map((item) => (
              <p key={`${item.code}-${item.candidate_id ?? 'global'}`} className="text-red-700">
                {item.message}
              </p>
            ))}
          </div>
        </div>
      )}

      {warningCount > 0 && (
        <details className="rounded border border-amber-300 bg-white p-2">
          <summary className="cursor-pointer text-amber-900">Validation warnings</summary>
          <div className="mt-2 space-y-1">
            {diagnostics?.non_blocking.slice(0, 12).map((item, index) => (
              <p key={`${index}-${item.code}-${item.candidate_id ?? 'global'}`} className="text-amber-900">
                {item.message}
              </p>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}
