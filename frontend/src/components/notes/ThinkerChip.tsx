'use client'

interface ThinkerChipProps {
  name: string
  birthYear?: number | null
  deathYear?: number | null
}

export function ThinkerChip({ name, birthYear, deathYear }: ThinkerChipProps) {
  const years = birthYear || deathYear ? ` (${birthYear ?? '?'}-${deathYear ?? '?'})` : ''

  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200 text-xs font-sans"
      title={`${name}${years}`}
    >
      {name}
      <span className="text-blue-500">{years}</span>
    </span>
  )
}
