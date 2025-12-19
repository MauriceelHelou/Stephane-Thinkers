'use client'

import { useState, useEffect, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { thinkersApi, timelinesApi } from '@/lib/api'
import { Modal, ModalFooter, ModalButton, ModalError } from '@/components/Modal'
import { YearPicker } from '@/components/YearPicker'
import { SearchableSelect } from '@/components/SearchableSelect'
import { yearToXPosition, DEFAULT_START_YEAR, DEFAULT_END_YEAR } from '@/lib/constants'
import { z } from 'zod'
import type { ThinkerCreate, Timeline } from '@/types'

const thinkerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  birth_year: z.number().int().min(-10000).max(3000).optional().nullable(),
  death_year: z.number().int().min(-10000).max(3000).optional().nullable(),
  active_period: z.string().optional().nullable(),
  field: z.string().optional().nullable(),
  biography_notes: z.string().optional().nullable(),
  position_x: z.number().optional().nullable(),
  position_y: z.number().optional().nullable(),
  timeline_id: z.string().optional().nullable(),
}).refine(
  (data) => {
    if (data.birth_year != null && data.death_year != null) {
      return data.birth_year < data.death_year
    }
    return true
  },
  { message: 'Birth year must be before death year', path: ['death_year'] }
)

interface AddThinkerModalProps {
  isOpen: boolean
  onClose: () => void
  clickPosition?: { x: number; y: number } | null
  defaultTimelineId?: string | null
}

export function AddThinkerModal({ isOpen, onClose, clickPosition, defaultTimelineId }: AddThinkerModalProps) {
  const queryClient = useQueryClient()
  // BUG #6 & #10 FIX: Track if user manually changed timeline to prevent override
  const userChangedTimeline = useRef(false)
  const prevIsOpen = useRef(isOpen)

  const { data: timelines = [] } = useQuery({
    queryKey: ['timelines'],
    queryFn: timelinesApi.getAll,
  })

  const [formData, setFormData] = useState<ThinkerCreate>({
    name: '',
    birth_year: null,
    death_year: null,
    active_period: null,
    field: null,
    biography_notes: null,
    position_x: clickPosition?.x || 400,
    position_y: clickPosition?.y || 300,
    timeline_id: defaultTimelineId || null,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [positioningMode, setPositioningMode] = useState<'auto' | 'manual'>('auto')
  const [selectedYear, setSelectedYear] = useState<number | null>(null)

  const selectedTimeline = formData.timeline_id
    ? timelines.find((t) => t.id === formData.timeline_id) || null
    : null

  const createMutation = useMutation({
    mutationFn: thinkersApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['thinkers'] })
      onClose()
      resetForm()
    },
  })

  const resetForm = () => {
    setFormData({
      name: '',
      birth_year: null,
      death_year: null,
      active_period: null,
      field: null,
      biography_notes: null,
      position_x: clickPosition?.x || 400,
      position_y: clickPosition?.y || 300,
      timeline_id: defaultTimelineId || null,
    })
    setErrors({})
    setPositioningMode('auto')
    setSelectedYear(null)
    userChangedTimeline.current = false
  }

  // BUG #6 & #10 FIX: Single useEffect that handles both opening and closing
  // Only set timeline_id when modal opens fresh, not when it was already open
  useEffect(() => {
    const wasJustOpened = isOpen && !prevIsOpen.current
    const wasJustClosed = !isOpen && prevIsOpen.current

    if (wasJustClosed) {
      resetForm()
    } else if (wasJustOpened) {
      // Modal just opened - set the default timeline only if user hasn't manually changed it
      userChangedTimeline.current = false
      if (defaultTimelineId) {
        setFormData(prev => ({ ...prev, timeline_id: defaultTimelineId }))
      }
    }

    prevIsOpen.current = isOpen
  }, [isOpen, defaultTimelineId])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})

    let finalFormData = { ...formData }

    if (positioningMode === 'auto') {
      finalFormData.position_x = null
    } else if (positioningMode === 'manual' && selectedYear !== null) {
      const timelineForCalc = selectedTimeline || { start_year: DEFAULT_START_YEAR, end_year: DEFAULT_END_YEAR }
      const startYear = timelineForCalc.start_year || DEFAULT_START_YEAR
      const endYear = timelineForCalc.end_year || DEFAULT_END_YEAR
      finalFormData.position_x = yearToXPosition(selectedYear, startYear, endYear)
      if (!finalFormData.birth_year) {
        finalFormData.birth_year = selectedYear
      }
    }

    try {
      const validated = thinkerSchema.parse(finalFormData)
      createMutation.mutate(validated)
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

  const handleChange = (field: keyof ThinkerCreate, value: string | number | null) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Thinker" maxWidth="2xl">
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <div>
          <label className="block text-sm font-sans font-medium text-primary mb-1">Name *</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            className="w-full px-3 py-2 border border-timeline rounded font-serif focus:outline-none focus:ring-2 focus:ring-accent"
            placeholder="e.g., Michel Foucault"
          />
          {errors.name && <p className="text-red-600 text-sm mt-1">{errors.name}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-sans font-medium text-primary mb-1">Birth Year</label>
            <input
              type="number"
              value={formData.birth_year || ''}
              onChange={(e) => handleChange('birth_year', e.target.value ? parseInt(e.target.value) : null)}
              className="w-full px-3 py-2 border border-timeline rounded font-mono focus:outline-none focus:ring-2 focus:ring-accent"
              placeholder="1926"
            />
            {errors.birth_year && <p className="text-red-600 text-sm mt-1">{errors.birth_year}</p>}
          </div>
          <div>
            <label className="block text-sm font-sans font-medium text-primary mb-1">Death Year</label>
            <input
              type="number"
              value={formData.death_year || ''}
              onChange={(e) => handleChange('death_year', e.target.value ? parseInt(e.target.value) : null)}
              className="w-full px-3 py-2 border border-timeline rounded font-mono focus:outline-none focus:ring-2 focus:ring-accent"
              placeholder="1984"
            />
            {errors.death_year && <p className="text-red-600 text-sm mt-1">{errors.death_year}</p>}
          </div>
        </div>

        <div>
          <label className="block text-sm font-sans font-medium text-primary mb-1">Active Period</label>
          <input
            type="text"
            value={formData.active_period || ''}
            onChange={(e) => handleChange('active_period', e.target.value || null)}
            className="w-full px-3 py-2 border border-timeline rounded font-serif focus:outline-none focus:ring-2 focus:ring-accent"
            placeholder="e.g., 1950s-1980s"
          />
        </div>

        <div>
          <label className="block text-sm font-sans font-medium text-primary mb-1">Field / Discipline</label>
          <input
            type="text"
            value={formData.field || ''}
            onChange={(e) => handleChange('field', e.target.value || null)}
            className="w-full px-3 py-2 border border-timeline rounded font-serif focus:outline-none focus:ring-2 focus:ring-accent"
            placeholder="e.g., Philosophy, Sociology"
          />
        </div>

        <div>
          <label className="block text-sm font-sans font-medium text-primary mb-1">Timeline</label>
          <SearchableSelect<Timeline | { id: null; name: string }>
            options={[{ id: null, name: 'None (show in all timelines)' } as { id: null; name: string }, ...timelines]}
            value={formData.timeline_id ? timelines.find(t => t.id === formData.timeline_id) || null : { id: null, name: 'None (show in all timelines)' }}
            onChange={(selected) => {
              userChangedTimeline.current = true
              handleChange('timeline_id', selected && 'id' in selected && selected.id ? selected.id : null)
            }}
            getLabel={(t) => t.name + (('start_year' in t && t.start_year) ? ` (${t.start_year}–${('end_year' in t && t.end_year) || '...'})` : '')}
            getValue={(t) => t.id || 'none'}
            placeholder="Select timeline..."
            searchPlaceholder="Search timelines..."
            allowClear={false}
          />
        </div>

        <div className="border-t border-timeline pt-4">
          <label className="block text-sm font-sans font-medium text-primary mb-2">Timeline Positioning</label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setPositioningMode('auto')}
              className={`px-4 py-2 font-sans text-sm rounded transition-colors ${
                positioningMode === 'auto' ? 'bg-accent text-white' : 'bg-white border border-timeline hover:bg-gray-50'
              }`}
            >
              Auto (by birth/death year)
            </button>
            <button
              type="button"
              onClick={() => setPositioningMode('manual')}
              className={`px-4 py-2 font-sans text-sm rounded transition-colors ${
                positioningMode === 'manual' ? 'bg-accent text-white' : 'bg-white border border-timeline hover:bg-gray-50'
              }`}
            >
              Manual (select year)
            </button>
          </div>
        </div>

        {positioningMode === 'manual' && (
          <YearPicker
            selectedYear={selectedYear}
            onYearSelect={setSelectedYear}
            timeline={selectedTimeline}
            label="Select positioning year"
          />
        )}

        <div>
          <label className="block text-sm font-sans font-medium text-primary mb-1">Biography Notes</label>
          <textarea
            value={formData.biography_notes || ''}
            onChange={(e) => handleChange('biography_notes', e.target.value || null)}
            rows={4}
            className="w-full px-3 py-2 border border-timeline rounded font-serif focus:outline-none focus:ring-2 focus:ring-accent"
            placeholder="Key biographical information and research notes..."
          />
        </div>

        <ModalError error={createMutation.error as Error | null} fallbackMessage="Failed to create thinker. Please try again." />

        <ModalFooter>
          <ModalButton onClick={() => { onClose(); resetForm() }}>Cancel</ModalButton>
          <ModalButton type="submit" variant="primary" disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Adding...' : 'Add Thinker'}
          </ModalButton>
        </ModalFooter>
      </form>
    </Modal>
  )
}
