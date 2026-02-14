'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useDraggable } from '@dnd-kit/core'
import { notesApi, tagsApi } from '@/lib/api'
import type { Note } from '@/types'
import { NoteTagSelector } from '@/components/notes/NoteTagSelector'

const FALLBACK_TAG_COLOR = '#64748b'
const FALLBACK_TAG_CREATED_AT = new Date(0).toISOString()

interface NotesListProps {
  folderId: string | null
  includeArchived?: boolean
  selectedNoteId: string | null
  selectedTagFilterIds: string[]
  onTagFilterIdsChange: (tagIds: string[]) => void
  onSelectNote: (noteId: string) => void
  onCreateNote: () => void
}

type SortMode = 'updated_desc' | 'updated_asc' | 'title_asc'

function DraggableNoteItem({
  note,
  isSelected,
  onSelect,
}: {
  note: Note
  isSelected: boolean
  onSelect: () => void
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `note-${note.id}`,
    data: { type: 'note', id: note.id, title: note.title || 'Untitled Note' },
  })

  return (
    <div
      ref={setNodeRef}
      className={`flex items-center border-b border-timeline last:border-b-0 transition-colors ${
        isDragging ? 'opacity-50' : ''
      } ${isSelected ? 'bg-accent/10' : 'hover:bg-gray-50'}`}
    >
      <span
        {...listeners}
        {...attributes}
        className="px-1.5 py-2 cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 text-xs select-none"
        title="Drag to move to folder"
      >
        ⠿
      </span>
      <button
        type="button"
        onClick={onSelect}
        className="flex-1 text-left px-2 py-2"
      >
        <p className="font-serif text-sm text-primary truncate">{note.title || 'Untitled Note'}</p>
        <p className="font-sans text-[10px] text-secondary mt-0.5">
          {new Date(note.updated_at).toLocaleString()}
        </p>
      </button>
    </div>
  )
}

export function NotesList({
  folderId,
  includeArchived,
  selectedNoteId,
  selectedTagFilterIds,
  onTagFilterIdsChange,
  onSelectNote,
  onCreateNote,
}: NotesListProps) {
  const [query, setQuery] = useState('')
  const [sortMode, setSortMode] = useState<SortMode>('updated_desc')

  const { data: allNoteTags = [] } = useQuery({
    queryKey: ['tags'],
    queryFn: tagsApi.getAll,
  })

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ['notes', folderId, { includeArchived: !!includeArchived, tagIds: selectedTagFilterIds.join(',') }],
    queryFn: async () => {
      const activeTagIds = selectedTagFilterIds.length > 0 ? selectedTagFilterIds : undefined
      if (folderId === 'unfiled') {
        const all = await notesApi.getAll(
          undefined,
          undefined,
          undefined,
          includeArchived || undefined,
          activeTagIds
        )
        return all.filter((note) => !note.folder_id)
      }

      return notesApi.getAll(undefined, undefined, folderId || undefined, includeArchived || undefined, activeTagIds)
    },
  })

  const selectedTagFilters = useMemo(() => {
    const tagsById = new Map(allNoteTags.map((tag) => [tag.id, tag]))
    return selectedTagFilterIds
      .map((tagId) => {
        const existing = tagsById.get(tagId)
        if (existing) return existing
        return {
          id: tagId,
          name: `Missing tag (${tagId.slice(0, 8)})`,
          color: FALLBACK_TAG_COLOR,
          created_at: FALLBACK_TAG_CREATED_AT,
        }
      })
  }, [allNoteTags, selectedTagFilterIds])

  const visibleNotes = useMemo(() => {
    const filtered = notes.filter((note: Note) => {
      if (!query.trim()) return true
      const q = query.toLowerCase()
      return (
        (note.title || '').toLowerCase().includes(q) ||
        (note.content || '').toLowerCase().includes(q)
      )
    })

    filtered.sort((a, b) => {
      if (sortMode === 'title_asc') {
        return (a.title || '').localeCompare(b.title || '')
      }
      if (sortMode === 'updated_asc') {
        return new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()
      }
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    })

    return filtered
  }, [notes, query, sortMode])

  return (
    <div className="h-full min-h-0 p-3 flex flex-col">
      <div className="flex items-center gap-2 mb-2 flex-shrink-0">
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search notes..."
          className="flex-1 px-2 py-1.5 text-xs font-sans border border-timeline rounded bg-white"
        />
        <select
          value={sortMode}
          onChange={(event) => setSortMode(event.target.value as SortMode)}
          className="px-2 py-1.5 text-xs font-sans border border-timeline rounded bg-white"
        >
          <option value="updated_desc">Recent</option>
          <option value="updated_asc">Oldest</option>
          <option value="title_asc">A-Z</option>
        </select>
        <button
          type="button"
          onClick={onCreateNote}
          className="px-2 py-1.5 text-xs font-sans text-white bg-accent rounded hover:bg-accent/90"
        >
          + Note
        </button>
      </div>

      <div className="mb-2 flex-shrink-0">
        <NoteTagSelector
          value={selectedTagFilters}
          onChange={(tags) => onTagFilterIdsChange(tags.map((tag) => tag.id))}
          placeholder="Filter by tags..."
          showClearButton
        />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto border border-timeline rounded bg-white">
        {isLoading ? (
          <p className="px-3 py-2 text-xs font-sans text-secondary">Loading notes...</p>
        ) : visibleNotes.length === 0 ? (
          <p className="px-3 py-2 text-xs font-sans text-secondary italic">No notes found</p>
        ) : (
          visibleNotes.map((note) => (
            <DraggableNoteItem
              key={note.id}
              note={note}
              isSelected={selectedNoteId === note.id}
              onSelect={() => onSelectNote(note.id)}
            />
          ))
        )}
      </div>
    </div>
  )
}
