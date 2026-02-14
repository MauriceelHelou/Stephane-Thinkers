'use client'

import { createPortal } from 'react-dom'
import type { TermThinkerBubble } from '@/types'

interface ConstellationTooltipProps {
  bubble: TermThinkerBubble
  position: { x: number; y: number }
}

export default function ConstellationTooltip({ bubble, position }: ConstellationTooltipProps) {
  if (typeof window === 'undefined') return null

  const lifeDates = (() => {
    if (bubble.thinker_birth_year && bubble.thinker_death_year) {
      return `${bubble.thinker_birth_year}-${bubble.thinker_death_year}`
    }
    if (bubble.thinker_birth_year) return `b. ${bubble.thinker_birth_year}`
    if (bubble.thinker_death_year) return `d. ${bubble.thinker_death_year}`
    return null
  })()

  const tooltipWidth = 280
  const left =
    position.x + 16 + tooltipWidth > window.innerWidth ? position.x - tooltipWidth - 16 : position.x + 16
  const top = position.y + 16 + 220 > window.innerHeight ? position.y - 140 : position.y + 16

  return createPortal(
    <div className="fixed z-[9999] pointer-events-none" style={{ left, top }}>
      <div className="rounded-lg shadow-lg border border-[#1A1A1A]/10 p-3 max-w-[280px] bg-background">
        <div className="mb-2">
          <span className="font-serif text-base font-semibold text-primary">{bubble.thinker_name}</span>
          {lifeDates && <span className="font-sans text-xs text-secondary ml-2">({lifeDates})</span>}
        </div>

        <div className="flex items-center gap-2 mb-2">
          <span className="font-sans text-xs px-2 py-0.5 rounded bg-accent/10 text-accent font-medium">
            {bubble.term_name}
          </span>
          <span className="font-sans text-xs text-secondary">
            {bubble.frequency} co-occurrence{bubble.frequency !== 1 ? 's' : ''}
          </span>
        </div>

        {bubble.sample_snippets.length > 0 && (
          <div className="border-t border-timeline pt-2 mt-2">
            <p className="font-sans text-[10px] text-secondary uppercase tracking-wide mb-1">From your notes</p>
            {bubble.sample_snippets.map((snippet, index) => (
              <p key={index} className="font-serif text-xs text-primary/70 italic mb-1 leading-relaxed">
                “{snippet.length > 120 ? `${snippet.slice(0, 120)}...` : snippet}”
              </p>
            ))}
          </div>
        )}

        <p className="font-sans text-[10px] text-secondary mt-2">Click to view definition</p>
      </div>
    </div>,
    document.body
  )
}
