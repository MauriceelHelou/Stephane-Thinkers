'use client'

import { useMemo } from 'react'
import type { TermOccurrence } from '@/types'

interface ExcerptCardProps {
  excerpt: TermOccurrence
  termName: string
  onClick?: () => void
}

export default function ExcerptCard({ excerpt, termName, onClick }: ExcerptCardProps) {
  const highlightedSnippet = useMemo(() => {
    if (!termName || !excerpt.context_snippet) return excerpt.context_snippet

    const escaped = termName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(`(${escaped})`, 'gi')
    const parts = excerpt.context_snippet.split(regex)

    return parts.map((part, index) => {
      if (part.toLowerCase() === termName.toLowerCase()) {
        return (
          <span key={index} className="font-bold text-accent bg-accent/10 px-0.5 rounded">
            {part}
          </span>
        )
      }
      return <span key={index}>{part}</span>
    })
  }, [excerpt.context_snippet, termName])

  const thinkers = excerpt.associated_thinkers || []

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left group block bg-white border border-gray-100 rounded-lg p-3 hover:border-accent/30 hover:shadow-sm transition-all"
      title="Click to open source note"
    >
      <blockquote className="font-serif text-sm text-primary/90 leading-relaxed border-l-2 border-accent/30 pl-3 mb-2">
        {highlightedSnippet}
      </blockquote>

      <div className="flex items-start justify-between text-xs text-gray-400 gap-2">
        <div className="flex-1 min-w-0 flex items-center gap-1.5 flex-wrap">
          <span className="break-words">{excerpt.note_title || 'Untitled note'}</span>
          {excerpt.note_folder_name && (
            <>
              <span className="text-gray-300">/</span>
              <span className="break-words">{excerpt.note_folder_name}</span>
            </>
          )}
        </div>

        <span className="text-accent opacity-0 group-hover:opacity-100 transition-opacity">→</span>
      </div>

      {thinkers.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {thinkers.map((thinker) => (
            <span
              key={thinker.id}
              className="inline-block text-xs bg-accent/10 text-accent px-1.5 py-0.5 rounded"
            >
              {thinker.name}
            </span>
          ))}
        </div>
      )}
    </button>
  )
}
