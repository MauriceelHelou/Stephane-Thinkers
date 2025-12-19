'use client'

import { useState, useEffect } from 'react'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { timelineEventsApi, timelinesApi } from '@/lib/api'
import { Modal, ModalFooter, ModalButton, ModalError } from '@/components/Modal'
import { z } from 'zod'
import type { TimelineEventCreate, TimelineEvent } from '@/types'

const timelineEventSchema = z.object({
  timeline_id: z.string().uuid('Valid timeline is required'),
  name: z.string().min(1, 'Name is required'),
  year: z.number().int().min(-10000).max(10000, 'Year must be between -10000 and 10000'),
  event_type: z.string().min(1, 'Event type is required'),
  description: z.string().optional().nullable(),
})

interface AddTimelineEventModalProps {
  isOpen: boolean
  onClose: () => void
  defaultTimelineId?: string | null
  editingEventId?: string | null
}

export function AddTimelineEventModal({ isOpen, onClose, defaultTimelineId, editingEventId }: AddTimelineEventModalProps) {
  const queryClient = useQueryClient()
  const [formData, setFormData] = useState<TimelineEventCreate>({
    timeline_id: defaultTimelineId || '',
    name: '',
    year: new Date().getFullYear(),
    event_type: 'other',
    description: null,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const isEditing = !!editingEventId

  const { data: timelines = [] } = useQuery({
    queryKey: ['timelines'],
    queryFn: timelinesApi.getAll,
  })

  const { data: existingEvent } = useQuery({
    queryKey: ['timeline-event', editingEventId],
    queryFn: () => timelineEventsApi.getOne(editingEventId!),
    enabled: !!editingEventId && isOpen,
  })

  const createMutation = useMutation({
    mutationFn: timelineEventsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeline-events'] })
      queryClient.invalidateQueries({ queryKey: ['combined-view-events'] })
      onClose()
      resetForm()
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<TimelineEventCreate> }) =>
      timelineEventsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeline-events'] })
      queryClient.invalidateQueries({ queryKey: ['combined-view-events'] })
      queryClient.invalidateQueries({ queryKey: ['timeline-event', editingEventId] })
      onClose()
      resetForm()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: timelineEventsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeline-events'] })
      queryClient.invalidateQueries({ queryKey: ['combined-view-events'] })
      onClose()
      resetForm()
    },
  })

  const resetForm = () => {
    setFormData({
      timeline_id: defaultTimelineId || '',
      name: '',
      year: new Date().getFullYear(),
      event_type: 'other',
      description: null,
    })
    setErrors({})
  }

  // Populate form with existing event data when editing
  useEffect(() => {
    if (existingEvent && isEditing) {
      setFormData({
        timeline_id: existingEvent.timeline_id,
        name: existingEvent.name,
        year: existingEvent.year,
        event_type: existingEvent.event_type,
        description: existingEvent.description,
      })
    }
  }, [existingEvent, isEditing])

  useEffect(() => {
    if (!isOpen) {
      resetForm()
    } else if (defaultTimelineId && !editingEventId) {
      setFormData(prev => ({ ...prev, timeline_id: defaultTimelineId }))
    }
  }, [isOpen, defaultTimelineId, editingEventId])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})

    try {
      const validated = timelineEventSchema.parse(formData)
      if (isEditing && editingEventId) {
        updateMutation.mutate({ id: editingEventId, data: validated })
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

  const handleDelete = () => {
    if (!editingEventId) return
    if (confirm('Are you sure you want to delete this event? This action cannot be undone.')) {
      deleteMutation.mutate(editingEventId)
    }
  }

  const handleChange = (field: keyof TimelineEventCreate, value: string | number | null) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const isPending = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending
  const mutationError = createMutation.error || updateMutation.error || deleteMutation.error

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? 'Edit Timeline Event' : 'Add Timeline Event'}>
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <div>
          <label className="block text-sm font-sans font-medium text-primary mb-1">Timeline *</label>
          <select
            value={formData.timeline_id}
            onChange={(e) => handleChange('timeline_id', e.target.value)}
            className="w-full px-3 py-2 border border-timeline rounded font-serif focus:outline-none focus:ring-2 focus:ring-accent"
          >
            <option value="">Select a timeline</option>
            {timelines.map((timeline) => (
              <option key={timeline.id} value={timeline.id}>{timeline.name}</option>
            ))}
          </select>
          {errors.timeline_id && <p className="text-red-600 text-sm mt-1">{errors.timeline_id}</p>}
        </div>

        <div>
          <label className="block text-sm font-sans font-medium text-primary mb-1">Event Name *</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            className="w-full px-3 py-2 border border-timeline rounded font-serif focus:outline-none focus:ring-2 focus:ring-accent"
            placeholder="e.g., Council of Trent, Publication of Das Kapital"
          />
          {errors.name && <p className="text-red-600 text-sm mt-1">{errors.name}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-sans font-medium text-primary mb-1">Year *</label>
            <input
              type="text"
              inputMode="numeric"
              value={formData.year}
              onChange={(e) => {
                const val = e.target.value
                // Allow empty, minus sign, or numbers
                if (val === '' || val === '-' || /^-?\d+$/.test(val)) {
                  handleChange('year', val === '' || val === '-' ? 0 : parseInt(val))
                }
              }}
              className="w-full px-3 py-2 border border-timeline rounded font-mono focus:outline-none focus:ring-2 focus:ring-accent"
              placeholder="-500 or 1545"
            />
            <p className="text-xs text-gray-500 mt-1">Use negative for BCE (e.g., -500 = 500 BCE)</p>
            {errors.year && <p className="text-red-600 text-sm mt-1">{errors.year}</p>}
          </div>

          <div>
            <label className="block text-sm font-sans font-medium text-primary mb-1">Event Type *</label>
            <select
              value={formData.event_type}
              onChange={(e) => handleChange('event_type', e.target.value)}
              className="w-full px-3 py-2 border border-timeline rounded font-serif focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="council">△ Council</option>
              <option value="publication">▢ Publication</option>
              <option value="war">◇ War</option>
              <option value="invention">★ Invention</option>
              <option value="cultural">● Cultural</option>
              <option value="political">● Political</option>
              <option value="other">● Other</option>
            </select>
            {errors.event_type && <p className="text-red-600 text-sm mt-1">{errors.event_type}</p>}
          </div>
        </div>

        <div>
          <label className="block text-sm font-sans font-medium text-primary mb-1">Description</label>
          <textarea
            value={formData.description || ''}
            onChange={(e) => handleChange('description', e.target.value || null)}
            rows={3}
            className="w-full px-3 py-2 border border-timeline rounded font-serif focus:outline-none focus:ring-2 focus:ring-accent"
            placeholder="Brief description of this historical event..."
          />
        </div>

        <ModalError error={mutationError as Error | null} fallbackMessage={`Failed to ${isEditing ? 'update' : 'add'} timeline event. Please try again.`} />

        <ModalFooter>
          <div className="flex justify-between w-full">
            <div>
              {isEditing && (
                <ModalButton
                  type="button"
                  variant="danger"
                  onClick={handleDelete}
                  disabled={isPending}
                >
                  {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
                </ModalButton>
              )}
            </div>
            <div className="flex gap-2">
              <ModalButton onClick={() => { onClose(); resetForm() }}>Cancel</ModalButton>
              <ModalButton type="submit" variant="primary" disabled={isPending}>
                {isPending ? (isEditing ? 'Saving...' : 'Adding...') : (isEditing ? 'Save Changes' : 'Add Event')}
              </ModalButton>
            </div>
          </div>
        </ModalFooter>
      </form>
    </Modal>
  )
}
