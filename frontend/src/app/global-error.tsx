'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html>
      <body>
        <div style={{
          minHeight: '100vh',
          backgroundColor: '#FAFAF8',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <div style={{ textAlign: 'center' }}>
            <h1 style={{
              fontSize: '3.75rem',
              fontFamily: 'serif',
              color: '#8B4513',
              marginBottom: '1rem',
            }}>
              Error
            </h1>
            <h2 style={{
              fontSize: '1.5rem',
              fontFamily: 'serif',
              color: '#1A1A1A',
              marginBottom: '1rem',
            }}>
              Something went wrong
            </h2>
            <p style={{
              color: '#666',
              marginBottom: '2rem',
            }}>
              A critical error occurred. Please refresh the page.
            </p>
            <button
              onClick={() => reset()}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: '#8B4513',
                color: 'white',
                borderRadius: '0.5rem',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Try Again
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
