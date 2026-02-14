'use client'

interface ConfidenceBadgeProps {
  label: 'low' | 'medium' | 'high'
}

export function ConfidenceBadge({ label }: ConfidenceBadgeProps) {
  const cls =
    label === 'high'
      ? 'bg-green-100 text-green-700'
      : label === 'medium'
      ? 'bg-yellow-100 text-yellow-700'
      : 'bg-red-100 text-red-700'

  return <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${cls}`}>{label} confidence</span>
}
