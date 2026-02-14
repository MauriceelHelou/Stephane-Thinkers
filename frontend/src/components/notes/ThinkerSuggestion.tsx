'use client'

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
import type { SuggestionKeyDownProps, SuggestionProps } from '@tiptap/suggestion'
import type { ThinkerMentionAttrs } from './tiptap-extensions/ThinkerMention'

export interface ThinkerSuggestionRef {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean
}

interface ThinkerSuggestionProps extends SuggestionProps<ThinkerMentionAttrs> {
  onAddNewThinker?: (name: string) => void
}

export const ThinkerSuggestionList = forwardRef<ThinkerSuggestionRef, ThinkerSuggestionProps>(
  (props, ref) => {
    const { items, command, query, onAddNewThinker } = props
    const [selectedIndex, setSelectedIndex] = useState(0)
    const listRef = useRef<HTMLDivElement>(null)

    const hasExactMatch = items.some((item) => item.name.toLowerCase() === query.toLowerCase())
    const showAddNew = query.length > 0 && !hasExactMatch
    const totalItems = items.length + (showAddNew ? 1 : 0)

    useEffect(() => setSelectedIndex(0), [items])

    useEffect(() => {
      const list = listRef.current
      if (!list) return
      const selected = list.children[selectedIndex] as HTMLElement | undefined
      selected?.scrollIntoView({ block: 'nearest' })
    }, [selectedIndex])

    const selectItem = useCallback(
      (index: number) => {
        if (index < items.length) {
          command(items[index])
          return
        }
        if (showAddNew && onAddNewThinker) {
          onAddNewThinker(query)
        }
      },
      [command, items, onAddNewThinker, query, showAddNew]
    )

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }: SuggestionKeyDownProps) => {
        if (event.key === 'ArrowUp') {
          setSelectedIndex((prev) => (prev - 1 + totalItems) % totalItems)
          return true
        }
        if (event.key === 'ArrowDown') {
          setSelectedIndex((prev) => (prev + 1) % totalItems)
          return true
        }
        if (event.key === 'Enter') {
          selectItem(selectedIndex)
          return true
        }
        if (event.key === 'Escape') {
          return true
        }
        return false
      },
    }))

    if (totalItems === 0) {
      return <div className="bg-white border border-timeline rounded p-2 text-xs text-secondary">No thinkers found</div>
    }

    return (
      <div ref={listRef} className="bg-white border border-timeline rounded shadow max-h-64 overflow-y-auto py-1">
        {items.map((item, index) => {
          const years = item.birthYear || item.deathYear
            ? ` (${item.birthYear ?? '?'}-${item.deathYear ?? '?'})`
            : ''
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => selectItem(index)}
              className={`w-full text-left px-3 py-2 text-xs font-sans transition-colors ${
                index === selectedIndex ? 'bg-accent/10 text-accent' : 'text-primary hover:bg-gray-50'
              }`}
            >
              {item.name}
              <span className="text-secondary">{years}</span>
            </button>
          )
        })}

        {showAddNew && (
          <button
            type="button"
            onClick={() => selectItem(items.length)}
            className={`w-full text-left px-3 py-2 text-xs font-sans border-t border-timeline transition-colors ${
              selectedIndex === items.length ? 'bg-accent/10 text-accent' : 'text-secondary hover:bg-gray-50'
            }`}
          >
            Add new thinker: {query}
          </button>
        )}
      </div>
    )
  }
)

ThinkerSuggestionList.displayName = 'ThinkerSuggestionList'
