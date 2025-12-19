'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log error to console (could be sent to error reporting service)
    console.error('Application error:', error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-xl p-6 text-center">
        <div className="mb-4">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-serif font-semibold text-primary mb-2">
            Something went wrong
          </h2>
          <p className="text-secondary font-sans text-sm mb-4">
            An unexpected error occurred while loading the application.
          </p>
        </div>

        {error.message && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800 text-left">
            <strong>Error details:</strong>
            <p className="mt-1 font-mono text-xs">{error.message}</p>
          </div>
        )}

        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="px-4 py-2 bg-accent text-white rounded font-sans text-sm hover:bg-opacity-90"
          >
            Try again
          </button>
          <button
            onClick={() => window.location.href = '/'}
            className="px-4 py-2 border border-timeline rounded font-sans text-sm hover:bg-gray-50"
          >
            Go to homepage
          </button>
        </div>

        <p className="mt-4 text-xs text-secondary font-sans">
          If this problem persists, please check the console for more details or contact support.
        </p>
      </div>
    </div>
  )
}
