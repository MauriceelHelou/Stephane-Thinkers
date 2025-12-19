'use client'

import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { institutionsApi } from '@/lib/api'
import { Modal, ModalFooter, ModalButton, ModalError } from '@/components/Modal'
import { z } from 'zod'
import type { InstitutionCreate, Institution } from '@/types'

const institutionSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  city: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  founded_year: z.number().int().min(-5000).max(2200).optional().nullable(),
  notes: z.string().optional().nullable(),
})

interface AddInstitutionModalProps {
  isOpen: boolean
  onClose: () => void
  editInstitution?: Institution | null
}

export function AddInstitutionModal({ isOpen, onClose, editInstitution }: AddInstitutionModalProps) {
  const queryClient = useQueryClient()
  const isEditMode = !!editInstitution

  const [formData, setFormData] = useState<InstitutionCreate>({
    name: '',
    city: null,
    country: null,
    latitude: null,
    longitude: null,
    founded_year: null,
    notes: null,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (isOpen && editInstitution) {
      setFormData({
        name: editInstitution.name,
        city: editInstitution.city || null,
        country: editInstitution.country || null,
        latitude: editInstitution.latitude || null,
        longitude: editInstitution.longitude || null,
        founded_year: editInstitution.founded_year || null,
        notes: editInstitution.notes || null,
      })
    } else if (!isOpen) {
      resetForm()
    }
  }, [isOpen, editInstitution])

  const createMutation = useMutation({
    mutationFn: institutionsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['institutions'] })
      onClose()
      resetForm()
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: InstitutionCreate }) => institutionsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['institutions'] })
      onClose()
      resetForm()
    },
  })

  const resetForm = () => {
    setFormData({
      name: '',
      city: null,
      country: null,
      latitude: null,
      longitude: null,
      founded_year: null,
      notes: null,
    })
    setErrors({})
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})

    try {
      const validated = institutionSchema.parse(formData)
      if (isEditMode && editInstitution) {
        updateMutation.mutate({ id: editInstitution.id, data: validated })
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

  const handleChange = (field: keyof InstitutionCreate, value: string | number | null) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const isPending = createMutation.isPending || updateMutation.isPending
  const mutationError = (createMutation.error || updateMutation.error) as Error | null

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEditMode ? 'Edit Institution' : 'Add Institution'} maxWidth="lg">
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <div>
          <label htmlFor="institution-name" className="block text-sm font-sans font-medium text-primary mb-1">Name *</label>
          <input
            id="institution-name"
            type="text"
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            className="w-full px-3 py-2 border border-timeline rounded font-serif focus:outline-none focus:ring-2 focus:ring-accent"
            placeholder="e.g., Harvard University"
          />
          {errors.name && <p className="text-red-600 text-sm mt-1">{errors.name}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="institution-city" className="block text-sm font-sans font-medium text-primary mb-1">City</label>
            <input
              id="institution-city"
              type="text"
              value={formData.city || ''}
              onChange={(e) => handleChange('city', e.target.value || null)}
              className="w-full px-3 py-2 border border-timeline rounded font-serif focus:outline-none focus:ring-2 focus:ring-accent"
              placeholder="e.g., Cambridge"
            />
          </div>
          <div>
            <label htmlFor="institution-country" className="block text-sm font-sans font-medium text-primary mb-1">Country</label>
            <input
              id="institution-country"
              type="text"
              value={formData.country || ''}
              onChange={(e) => handleChange('country', e.target.value || null)}
              className="w-full px-3 py-2 border border-timeline rounded font-serif focus:outline-none focus:ring-2 focus:ring-accent"
              placeholder="e.g., USA"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="institution-latitude" className="block text-sm font-sans font-medium text-primary mb-1">Latitude</label>
            <input
              id="institution-latitude"
              type="number"
              step="0.000001"
              value={formData.latitude ?? ''}
              onChange={(e) => handleChange('latitude', e.target.value ? parseFloat(e.target.value) : null)}
              className="w-full px-3 py-2 border border-timeline rounded font-mono focus:outline-none focus:ring-2 focus:ring-accent"
              placeholder="42.3736"
            />
            {errors.latitude && <p className="text-red-600 text-sm mt-1">{errors.latitude}</p>}
          </div>
          <div>
            <label htmlFor="institution-longitude" className="block text-sm font-sans font-medium text-primary mb-1">Longitude</label>
            <input
              id="institution-longitude"
              type="number"
              step="0.000001"
              value={formData.longitude ?? ''}
              onChange={(e) => handleChange('longitude', e.target.value ? parseFloat(e.target.value) : null)}
              className="w-full px-3 py-2 border border-timeline rounded font-mono focus:outline-none focus:ring-2 focus:ring-accent"
              placeholder="-71.1097"
            />
            {errors.longitude && <p className="text-red-600 text-sm mt-1">{errors.longitude}</p>}
          </div>
        </div>

        <div>
          <label htmlFor="institution-founded-year" className="block text-sm font-sans font-medium text-primary mb-1">Founded Year</label>
          <input
            id="institution-founded-year"
            type="number"
            value={formData.founded_year ?? ''}
            onChange={(e) => handleChange('founded_year', e.target.value ? parseInt(e.target.value) : null)}
            className="w-full px-3 py-2 border border-timeline rounded font-mono focus:outline-none focus:ring-2 focus:ring-accent"
            placeholder="1636"
          />
          {errors.founded_year && <p className="text-red-600 text-sm mt-1">{errors.founded_year}</p>}
        </div>

        <div>
          <label htmlFor="institution-notes" className="block text-sm font-sans font-medium text-primary mb-1">Notes</label>
          <textarea
            id="institution-notes"
            value={formData.notes || ''}
            onChange={(e) => handleChange('notes', e.target.value || null)}
            rows={3}
            className="w-full px-3 py-2 border border-timeline rounded font-serif focus:outline-none focus:ring-2 focus:ring-accent"
            placeholder="Additional notes about this institution..."
          />
        </div>

        <ModalError error={mutationError} fallbackMessage={`Failed to ${isEditMode ? 'update' : 'create'} institution. Please try again.`} />

        <ModalFooter>
          <ModalButton onClick={() => { onClose(); resetForm() }}>Cancel</ModalButton>
          <ModalButton type="submit" variant="primary" disabled={isPending}>
            {isPending ? (isEditMode ? 'Updating...' : 'Adding...') : (isEditMode ? 'Update Institution' : 'Add Institution')}
          </ModalButton>
        </ModalFooter>
      </form>
    </Modal>
  )
}
