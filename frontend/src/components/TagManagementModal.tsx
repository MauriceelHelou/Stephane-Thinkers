'use client'

import { useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { tagsApi } from '@/lib/api'
import { Modal, ModalFooter, ModalButton, ModalError } from '@/components/Modal'
import type { Tag, TagCreate } from '@/types'

interface TagManagementModalProps {
  isOpen: boolean
  onClose: () => void
}

const PRESET_COLORS = [
  '#8B4513', // Saddle Brown
  '#2563eb', // Blue
  '#16a34a', // Green
  '#dc2626', // Red
  '#9333ea', // Purple
  '#ca8a04', // Yellow
  '#0891b2', // Cyan
  '#be185d', // Pink
  '#64748b', // Slate
  '#1f2937', // Gray
]

export function TagManagementModal({ isOpen, onClose }: TagManagementModalProps) {
  const queryClient = useQueryClient()
  const [editingTagId, setEditingTagId] = useState<string | null>(null)
  const [formData, setFormData] = useState<TagCreate>({ name: '', color: PRESET_COLORS[0] })
  const [error, setError] = useState<string | null>(null)

  const { data: tags = [], isLoading } = useQuery({
    queryKey: ['tags'],
    queryFn: tagsApi.getAll,
    enabled: isOpen,
  })

  const createMutation = useMutation({
    mutationFn: tagsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] })
      resetForm()
    },
    onError: (err: Error) => setError(err.message),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<TagCreate> }) =>
      tagsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] })
      resetForm()
    },
    onError: (err: Error) => setError(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: tagsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] })
      queryClient.invalidateQueries({ queryKey: ['thinkers'] })
    },
    onError: (err: Error) => setError(err.message),
  })

  const resetForm = () => {
    setEditingTagId(null)
    setFormData({ name: '', color: PRESET_COLORS[0] })
    setError(null)
  }

  useEffect(() => {
    if (!isOpen) resetForm()
  }, [isOpen])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!formData.name.trim()) {
      setError('Tag name is required')
      return
    }

    if (editingTagId) {
      updateMutation.mutate({ id: editingTagId, data: formData })
    } else {
      createMutation.mutate(formData)
    }
  }

  const handleEdit = (tag: Tag) => {
    setEditingTagId(tag.id)
    setFormData({ name: tag.name, color: tag.color || PRESET_COLORS[0] })
  }

  const handleDelete = (tag: Tag) => {
    if (confirm(`Are you sure you want to delete the tag "${tag.name}"? This will remove it from all thinkers.`)) {
      deleteMutation.mutate(tag.id)
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Manage Tags" maxWidth="md">
      <div className="p-6 space-y-6">
        {/* Tag Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-sm font-sans font-medium text-primary mb-1">
                {editingTagId ? 'Edit Tag' : 'New Tag'}
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-timeline rounded font-serif focus:outline-none focus:ring-2 focus:ring-accent"
                placeholder="Tag name"
              />
            </div>
            <div>
              <label className="block text-sm font-sans font-medium text-primary mb-1">Color</label>
              <div className="flex gap-1 flex-wrap w-32">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setFormData({ ...formData, color })}
                    className={`w-6 h-6 rounded-full border-2 transition-transform ${
                      formData.color === color ? 'border-gray-800 scale-110' : 'border-transparent hover:scale-105'
                    }`}
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
            </div>
          </div>

          {error && (
            <p className="text-red-600 text-sm">{error}</p>
          )}

          <div className="flex gap-2">
            {editingTagId && (
              <button
                type="button"
                onClick={resetForm}
                className="px-3 py-1.5 text-sm border border-timeline rounded font-sans hover:bg-gray-50"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={isPending}
              className="px-3 py-1.5 text-sm bg-accent text-white rounded font-sans hover:bg-opacity-90 disabled:opacity-50"
            >
              {isPending ? 'Saving...' : editingTagId ? 'Update Tag' : 'Add Tag'}
            </button>
          </div>
        </form>

        {/* Tags List */}
        <div>
          <h3 className="text-sm font-sans font-medium text-secondary mb-2">Existing Tags</h3>
          {isLoading ? (
            <p className="text-sm text-gray-500">Loading tags...</p>
          ) : tags.length === 0 ? (
            <p className="text-sm text-gray-500 italic">No tags created yet</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {tags.map((tag: Tag) => (
                <div
                  key={tag.id}
                  className="flex items-center justify-between p-2 bg-gray-50 rounded group"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: tag.color || '#64748b' }}
                    />
                    <span className="font-serif text-sm">{tag.name}</span>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleEdit(tag)}
                      className="px-2 py-0.5 text-xs text-accent hover:bg-gray-200 rounded"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(tag)}
                      disabled={deleteMutation.isPending}
                      className="px-2 py-0.5 text-xs text-red-600 hover:bg-red-50 rounded"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <ModalFooter>
          <ModalButton onClick={onClose}>Done</ModalButton>
        </ModalFooter>
      </div>
    </Modal>
  )
}
