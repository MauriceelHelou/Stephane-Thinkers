'use client'

import { useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { combinedViewsApi, timelinesApi } from '@/lib/api'
import { Modal, ModalFooter, ModalButton, ModalError } from '@/components/Modal'
import { z } from 'zod'
import type { CombinedTimelineViewCreate, CombinedViewMember } from '@/types'

const combinedViewSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional().nullable(),
  timeline_ids: z.array(z.string()).min(2, 'Please select at least 2 timelines'),
})

interface CreateCombinedViewModalProps {
  isOpen: boolean
  onClose: () => void
  editingViewId?: string | null
}

export function CreateCombinedViewModal({ isOpen, onClose, editingViewId }: CreateCombinedViewModalProps) {
  const queryClient = useQueryClient()
  const [formData, setFormData] = useState<CombinedTimelineViewCreate>({
    name: '',
    description: null,
    timeline_ids: [],
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const isEditing = !!editingViewId

  const { data: timelines = [] } = useQuery({
    queryKey: ['timelines'],
    queryFn: timelinesApi.getAll,
  })

  const { data: existingView } = useQuery({
    queryKey: ['combined-view', editingViewId],
    queryFn: () => combinedViewsApi.getOne(editingViewId!),
    enabled: !!editingViewId && isOpen,
  })

  const createMutation = useMutation({
    mutationFn: combinedViewsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['combined-views'] })
      onClose()
      resetForm()
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CombinedTimelineViewCreate> }) =>
      combinedViewsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['combined-views'] })
      queryClient.invalidateQueries({ queryKey: ['combined-view', editingViewId] })
      onClose()
      resetForm()
    },
  })

  const resetForm = () => {
    setFormData({ name: '', description: null, timeline_ids: [] })
    setErrors({})
  }

  // Populate form with existing view data when editing
  useEffect(() => {
    if (existingView && isEditing) {
      setFormData({
        name: existingView.name,
        description: existingView.description,
        timeline_ids: existingView.members.map((m: CombinedViewMember) => m.timeline_id),
      })
    }
  }, [existingView, isEditing])

  useEffect(() => {
    if (!isOpen) resetForm()
  }, [isOpen])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})

    try {
      const validated = combinedViewSchema.parse(formData)
      if (isEditing && editingViewId) {
        updateMutation.mutate({ id: editingViewId, data: validated })
      } else {
        createMutation.mutate(validated)
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {}
        error.errors.forEach((err) => {
          if (err.path[0]) newErrors[err.path[0].toString()] = err.message
        })
        setErrors(newErrors)
      }
    }
  }

  const handleChange = (field: keyof CombinedTimelineViewCreate, value: string | null) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleTimelineToggle = (timelineId: string) => {
    setFormData((prev) => ({
      ...prev,
      timeline_ids: prev.timeline_ids.includes(timelineId)
        ? prev.timeline_ids.filter(id => id !== timelineId)
        : [...prev.timeline_ids, timelineId],
    }))
  }

  const isPending = createMutation.isPending || updateMutation.isPending
  const mutationError = createMutation.error || updateMutation.error

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? 'Edit Combined View' : 'Create Combined Timeline View'}>
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <div>
          <label className="block text-sm font-sans font-medium text-primary mb-1">View Name *</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            className="w-full px-3 py-2 border border-timeline rounded font-serif focus:outline-none focus:ring-2 focus:ring-accent"
            placeholder="e.g., Major Philosophical Movements"
          />
          {errors.name && <p className="text-red-600 text-sm mt-1">{errors.name}</p>}
        </div>

        <div>
          <label className="block text-sm font-sans font-medium text-primary mb-1">Description</label>
          <textarea
            value={formData.description || ''}
            onChange={(e) => handleChange('description', e.target.value || null)}
            rows={2}
            className="w-full px-3 py-2 border border-timeline rounded font-serif focus:outline-none focus:ring-2 focus:ring-accent"
            placeholder="Brief description of this combined view..."
          />
        </div>

        <div>
          <label className="block text-sm font-sans font-medium text-primary mb-2">
            Select Timelines * (minimum 2)
          </label>
          <div className="border border-timeline rounded p-3 max-h-48 overflow-y-auto space-y-2">
            {timelines.length === 0 ? (
              <p className="text-sm text-gray-500 italic">No timelines available. Create timelines first.</p>
            ) : (
              timelines.map((timeline) => (
                <label key={timeline.id} className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                  <input
                    type="checkbox"
                    checked={formData.timeline_ids.includes(timeline.id)}
                    onChange={() => handleTimelineToggle(timeline.id)}
                    className="w-4 h-4 text-accent border-gray-300 rounded focus:ring-accent"
                  />
                  <span className="text-sm font-serif">
                    {timeline.name}
                    {timeline.start_year && timeline.end_year && (
                      <span className="text-gray-500 ml-2 font-mono text-xs">
                        ({timeline.start_year} - {timeline.end_year})
                      </span>
                    )}
                  </span>
                </label>
              ))
            )}
          </div>
          {errors.timeline_ids && <p className="text-red-600 text-sm mt-1">{errors.timeline_ids}</p>}
          <p className="text-xs text-gray-500 mt-1">
            Selected: {formData.timeline_ids.length} timeline{formData.timeline_ids.length !== 1 ? 's' : ''}
          </p>
        </div>

        <ModalError error={mutationError as Error | null} fallbackMessage={`Failed to ${isEditing ? 'update' : 'create'} combined view. Please try again.`} />

        <ModalFooter>
          <ModalButton onClick={() => { onClose(); resetForm() }}>Cancel</ModalButton>
          <ModalButton type="submit" variant="primary" disabled={isPending || timelines.length === 0}>
            {isPending ? (isEditing ? 'Saving...' : 'Creating...') : (isEditing ? 'Save Changes' : 'Create Combined View')}
          </ModalButton>
        </ModalFooter>
      </form>
    </Modal>
  )
}
