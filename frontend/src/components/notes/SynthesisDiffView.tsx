'use client'

interface SynthesisDiffViewProps {
  previous?: string | null
  current?: string | null
}

export function SynthesisDiffView({ previous, current }: SynthesisDiffViewProps) {
  if (!previous && !current) {
    return <p className="text-xs text-secondary">No synthesis history to compare yet.</p>
  }

  const previousLines = (previous || '').split('\n')
  const currentLines = (current || '').split('\n')
  const maxLength = Math.max(previousLines.length, currentLines.length)

  return (
    <div className="space-y-1 text-xs font-sans">
      {Array.from({ length: maxLength }).map((_, idx) => {
        const before = previousLines[idx] || ''
        const after = currentLines[idx] || ''
        const changed = before !== after
        return (
          <div key={idx} className={`grid grid-cols-2 gap-2 p-1 rounded ${changed ? 'bg-amber-50' : 'bg-white'}`}>
            <div className="text-gray-500">{before || '∅'}</div>
            <div className="text-primary">{after || '∅'}</div>
          </div>
        )
      })}
    </div>
  )
}
