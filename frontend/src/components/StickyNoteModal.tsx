'use client'

import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { notesApi } from '@/lib/api'
import type { Note, NoteColor } from '@/types'

interface StickyNoteModalProps {
  isOpen: boolean
  onClose: () => void
  position: { x: number; y: number } | null
  editingNote?: Note | null
}

const NOTE_COLORS: { value: NoteColor; label: string; bg: string; border: string }[] = [
  { value: 'yellow', label: 'Yellow', bg: '#FEF3C7', border: '#F59E0B' },
  { value: 'pink', label: 'Pink', bg: '#FCE7F3', border: '#EC4899' },
  { value: 'blue', label: 'Blue', bg: '#DBEAFE', border: '#3B82F6' },
  { value: 'green', label: 'Green', bg: '#D1FAE5', border: '#10B981' },
]

export function StickyNoteModal({
  isOpen,
  onClose,
  position,
  editingNote,
}: StickyNoteModalProps) {
  const queryClient = useQueryClient()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [color, setColor] = useState<NoteColor>('yellow')

  // Populate form when editing
  useEffect(() => {
    if (editingNote) {
      setTitle(editingNote.title || '')
      setContent(editingNote.content || '')
      setColor((editingNote.color as NoteColor) || 'yellow')
    } else {
      setTitle('')
      setContent('')
      setColor('yellow')
    }
  }, [editingNote, isOpen])

  const createMutation = useMutation({
    mutationFn: notesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['canvas-notes'] })
      onClose()
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof notesApi.update>[1] }) =>
      notesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['canvas-notes'] })
      onClose()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: notesApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['canvas-notes'] })
      onClose()
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim()) return

    if (editingNote) {
      updateMutation.mutate({
        id: editingNote.id,
        data: {
          title: title.trim() || null,
          content: content.trim(),
          color,
        },
      })
    } else if (position) {
      createMutation.mutate({
        title: title.trim() || null,
        content: content.trim(),
        position_x: position.x,
        position_y: position.y,
        color,
        is_canvas_note: true,
        note_type: 'general',
      })
    }
  }

  const handleDelete = () => {
    if (editingNote && confirm('Are you sure you want to delete this sticky note?')) {
      deleteMutation.mutate(editingNote.id)
    }
  }

  if (!isOpen) return null

  const isSubmitting = createMutation.isPending || updateMutation.isPending

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h2 className="font-serif text-lg font-semibold">
            {editingNote ? 'Edit Sticky Note' : 'New Sticky Note'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl"
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Color Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
            <div className="flex gap-2">
              {NOTE_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setColor(c.value)}
                  className={`w-8 h-8 rounded-full border-2 transition-transform ${
                    color === c.value ? 'scale-110 ring-2 ring-offset-2 ring-gray-400' : ''
                  }`}
                  style={{ backgroundColor: c.bg, borderColor: c.border }}
                  title={c.label}
                />
              ))}
            </div>
          </div>

          {/* Title (optional) */}
          <div>
            <label htmlFor="note-title" className="block text-sm font-medium text-gray-700 mb-1">
              Title (optional)
            </label>
            <input
              type="text"
              id="note-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
              placeholder="Note title..."
            />
          </div>

          {/* Content */}
          <div>
            <label htmlFor="note-content" className="block text-sm font-medium text-gray-700 mb-1">
              Content <span className="text-red-500">*</span>
            </label>
            <textarea
              id="note-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent resize-none"
              placeholder="Write your note here..."
              autoFocus
              required
            />
          </div>

          {/* Position info */}
          {position && !editingNote && (
            <p className="text-xs text-gray-500">
              This note will be placed at position ({Math.round(position.x)}, {Math.round(position.y)}) on the canvas.
            </p>
          )}

          {/* Actions */}
          <div className="flex justify-between pt-2">
            <div>
              {editingNote && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleteMutation.isPending}
                  className="px-4 py-2 text-red-600 hover:text-red-800 text-sm font-medium disabled:opacity-50"
                >
                  Delete
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !content.trim()}
                className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Saving...' : editingNote ? 'Save Changes' : 'Create Note'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
