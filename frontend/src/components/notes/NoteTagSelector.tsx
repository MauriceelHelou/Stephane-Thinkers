'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { tagsApi } from '@/lib/api'
import type { Tag } from '@/types'

interface NoteTagSelectorProps {
  value: Tag[]
  onChange: (tags: Tag[]) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  showClearButton?: boolean
}

const DEFAULT_NEW_TAG_COLOR = '#64748b'

function normalizeTagName(name: string): string {
  return name.trim().toLowerCase()
}

export function NoteTagSelector({
  value,
  onChange,
  placeholder = 'Add tags...',
  className = '',
  disabled = false,
  showClearButton = false,
}: NoteTagSelectorProps) {
  const queryClient = useQueryClient()
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  const { data: allTags = [] } = useQuery({
    queryKey: ['tags'],
    queryFn: tagsApi.getAll,
  })

  const createTagMutation = useMutation({
    mutationFn: tagsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] })
    },
  })

  const selectedIdSet = useMemo(() => new Set(value.map((tag) => tag.id)), [value])

  const normalizedTagMap = useMemo(() => {
    const map = new Map<string, Tag>()
    for (const tag of allTags) {
      map.set(normalizeTagName(tag.name), tag)
    }
    return map
  }, [allTags])

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase()
    return allTags.filter((tag) => {
      if (selectedIdSet.has(tag.id)) return false
      if (!q) return true
      return tag.name.toLowerCase().includes(q)
    })
  }, [allTags, query, selectedIdSet])

  const exactMatch = query.trim() ? normalizedTagMap.get(normalizeTagName(query)) : undefined
  const canCreate = query.trim().length > 0 && !exactMatch

  const addTag = (tag: Tag) => {
    if (selectedIdSet.has(tag.id)) return
    onChange([...value, tag])
    setQuery('')
    setLocalError(null)
    inputRef.current?.focus()
  }

  const removeTag = (tagId: string) => {
    onChange(value.filter((tag) => tag.id !== tagId))
  }

  const handleCreateOrSelect = async () => {
    const trimmed = query.trim()
    if (!trimmed || disabled) return

    setLocalError(null)

    const existing = normalizedTagMap.get(normalizeTagName(trimmed))
    if (existing) {
      addTag(existing)
      return
    }

    try {
      const created = await createTagMutation.mutateAsync({
        name: trimmed,
        color: DEFAULT_NEW_TAG_COLOR,
      })
      addTag(created)
    } catch (error) {
      if (error instanceof Error) {
        setLocalError(error.message)
      } else {
        setLocalError('Unable to create tag')
      }
    }
  }

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!containerRef.current) return
      if (!containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  return (
    <div ref={containerRef} className={className}>
      <div
        className={`w-full min-h-[34px] px-2 py-1 border border-timeline rounded bg-white flex flex-wrap items-center gap-1 ${
          disabled ? 'opacity-70 cursor-not-allowed' : 'cursor-text'
        }`}
        onClick={() => {
          if (disabled) return
          setIsOpen(true)
          inputRef.current?.focus()
        }}
      >
        {value.map((tag) => (
          <span
            key={tag.id}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-sans text-white"
            style={{ backgroundColor: tag.color || DEFAULT_NEW_TAG_COLOR }}
          >
            {tag.name}
            {!disabled && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  removeTag(tag.id)
                }}
                className="text-white/80 hover:text-white"
                aria-label={`Remove ${tag.name}`}
              >
                ×
              </button>
            )}
          </span>
        ))}

        <input
          ref={inputRef}
          type="text"
          value={query}
          onFocus={() => !disabled && setIsOpen(true)}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={async (event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              await handleCreateOrSelect()
            } else if (event.key === 'Backspace' && !query.trim() && value.length > 0) {
              removeTag(value[value.length - 1].id)
            } else if (event.key === 'Escape') {
              setIsOpen(false)
            }
          }}
          disabled={disabled}
          placeholder={value.length > 0 ? '' : placeholder}
          className="flex-1 min-w-[96px] text-xs font-sans bg-transparent border-none outline-none placeholder:text-gray-400"
        />

        {showClearButton && value.length > 0 && !disabled && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onChange([])
              setQuery('')
            }}
            className="text-[10px] font-sans text-secondary hover:text-primary"
          >
            Clear
          </button>
        )}
      </div>

      {localError && (
        <p className="mt-1 text-[10px] font-sans text-red-600">{localError}</p>
      )}

      {isOpen && !disabled && (
        <div className="relative">
          <div className="absolute top-1 z-20 w-full max-h-48 overflow-y-auto border border-timeline rounded bg-white shadow-sm">
            {filteredOptions.length === 0 && !canCreate ? (
              <p className="px-2 py-1.5 text-[10px] font-sans text-secondary italic">No matching tags</p>
            ) : (
              <ul className="py-1">
                {filteredOptions.map((tag) => (
                  <li key={tag.id}>
                    <button
                      type="button"
                      onClick={() => addTag(tag)}
                      className="w-full text-left px-2 py-1 text-xs font-sans hover:bg-gray-50"
                    >
                      {tag.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {canCreate && (
              <button
                type="button"
                onClick={handleCreateOrSelect}
                disabled={createTagMutation.isPending}
                className="w-full text-left px-2 py-1.5 text-xs font-sans border-t border-timeline hover:bg-gray-50 disabled:opacity-60"
              >
                {createTagMutation.isPending ? 'Creating...' : `Create "${query.trim()}"`}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
