'use client'

import { useState, useEffect } from 'react'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { timelinesApi } from '@/lib/api'
import { Modal, ModalFooter, ModalButton, ModalError } from '@/components/Modal'
import { z } from 'zod'
import type { TimelineCreate } from '@/types'

const timelineSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  start_year: z.number().int().min(-10000).max(3000).optional().nullable(),
  end_year: z.number().int().min(-10000).max(3000).optional().nullable(),
  description: z.string().optional().nullable(),
}).refine(
  (data) => {
    if (data.start_year != null && data.end_year != null) {
      return data.start_year < data.end_year
    }
    return true
  },
  {
    message: 'Start year must be before end year',
    path: ['end_year'],
  }
)

interface AddTimelineModalProps {
  isOpen: boolean
  onClose: () => void
  editingTimelineId?: string | null
}

export function AddTimelineModal({ isOpen, onClose, editingTimelineId }: AddTimelineModalProps) {
  const queryClient = useQueryClient()
  const [formData, setFormData] = useState<TimelineCreate>({
    name: '',
    start_year: null,
    end_year: null,
    description: null,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const isEditing = !!editingTimelineId

  const { data: existingTimeline } = useQuery({
    queryKey: ['timeline', editingTimelineId],
    queryFn: () => timelinesApi.getOne(editingTimelineId!),
    enabled: !!editingTimelineId && isOpen,
  })

  const createMutation = useMutation({
    mutationFn: timelinesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timelines'] })
      onClose()
      resetForm()
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<TimelineCreate> }) =>
      timelinesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timelines'] })
      queryClient.invalidateQueries({ queryKey: ['timeline', editingTimelineId] })
      onClose()
      resetForm()
    },
  })

  const resetForm = () => {
    setFormData({ name: '', start_year: null, end_year: null, description: null })
    setErrors({})
  }

  // Populate form with existing timeline data when editing
  useEffect(() => {
    if (existingTimeline && isEditing) {
      setFormData({
        name: existingTimeline.name,
        start_year: existingTimeline.start_year,
        end_year: existingTimeline.end_year,
        description: existingTimeline.description,
      })
    }
  }, [existingTimeline, isEditing])

  useEffect(() => {
    if (!isOpen) resetForm()
  }, [isOpen])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})

    try {
      const validated = timelineSchema.parse(formData)
      if (isEditing && editingTimelineId) {
        updateMutation.mutate({ id: editingTimelineId, data: validated })
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

  const handleChange = (field: keyof TimelineCreate, value: string | number | null) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const isPending = createMutation.isPending || updateMutation.isPending
  const mutationError = createMutation.error || updateMutation.error

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? 'Edit Timeline' : 'Create Timeline'}>
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <div>
          <label className="block text-sm font-sans font-medium text-primary mb-1">
            Timeline Name *
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            className="w-full px-3 py-2 border border-timeline rounded font-serif focus:outline-none focus:ring-2 focus:ring-accent"
            placeholder="e.g., French Theory, Enlightenment Period"
          />
          {errors.name && <p className="text-red-600 text-sm mt-1">{errors.name}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-sans font-medium text-primary mb-1">
              Start Year
            </label>
            <input
              type="number"
              value={formData.start_year || ''}
              onChange={(e) => handleChange('start_year', e.target.value ? parseInt(e.target.value) : null)}
              className="w-full px-3 py-2 border border-timeline rounded font-mono focus:outline-none focus:ring-2 focus:ring-accent"
              placeholder="1950"
            />
            {errors.start_year && <p className="text-red-600 text-sm mt-1">{errors.start_year}</p>}
          </div>

          <div>
            <label className="block text-sm font-sans font-medium text-primary mb-1">
              End Year
            </label>
            <input
              type="number"
              value={formData.end_year || ''}
              onChange={(e) => handleChange('end_year', e.target.value ? parseInt(e.target.value) : null)}
              className="w-full px-3 py-2 border border-timeline rounded font-mono focus:outline-none focus:ring-2 focus:ring-accent"
              placeholder="2000"
            />
            {errors.end_year && <p className="text-red-600 text-sm mt-1">{errors.end_year}</p>}
          </div>
        </div>

        <div>
          <label className="block text-sm font-sans font-medium text-primary mb-1">
            Description
          </label>
          <textarea
            value={formData.description || ''}
            onChange={(e) => handleChange('description', e.target.value || null)}
            rows={3}
            className="w-full px-3 py-2 border border-timeline rounded font-serif focus:outline-none focus:ring-2 focus:ring-accent"
            placeholder="Brief description of this timeline period..."
          />
        </div>

        <ModalError error={mutationError as Error | null} fallbackMessage={`Failed to ${isEditing ? 'update' : 'create'} timeline. Please try again.`} />

        <ModalFooter>
          <ModalButton onClick={() => { onClose(); resetForm() }}>Cancel</ModalButton>
          <ModalButton type="submit" variant="primary" disabled={isPending}>
            {isPending ? (isEditing ? 'Saving...' : 'Creating...') : (isEditing ? 'Save Changes' : 'Create Timeline')}
          </ModalButton>
        </ModalFooter>
      </form>
    </Modal>
  )
}
