'use client'

import { useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { institutionsApi, thinkerInstitutionsApi, thinkersApi } from '@/lib/api'
import { Modal, ModalFooter, ModalButton, ModalError } from '@/components/Modal'
import { z } from 'zod'
import type { ThinkerInstitutionCreate, ThinkerInstitutionWithRelations } from '@/types'

const affiliationSchema = z.object({
  thinker_id: z.string().uuid('Thinker is required'),
  institution_id: z.string().uuid('Institution is required'),
  role: z.string().optional().nullable(),
  department: z.string().optional().nullable(),
  start_year: z.number().int().min(-5000).max(2200).optional().nullable(),
  end_year: z.number().int().min(-5000).max(2200).optional().nullable(),
  is_phd_institution: z.boolean().optional(),
  phd_advisor_id: z.string().uuid().optional().nullable(),
  notes: z.string().optional().nullable(),
}).refine(
  (data) => {
    if (data.start_year != null && data.end_year != null) {
      return data.start_year <= data.end_year
    }
    return true
  },
  { message: 'Start year must be before or equal to end year', path: ['end_year'] }
)

interface AddAffiliationModalProps {
  isOpen: boolean
  onClose: () => void
  thinkerId: string
  thinkerName: string
  editAffiliation?: ThinkerInstitutionWithRelations | null
}

export function AddAffiliationModal({
  isOpen,
  onClose,
  thinkerId,
  thinkerName,
  editAffiliation,
}: AddAffiliationModalProps) {
  const queryClient = useQueryClient()
  const isEditMode = !!editAffiliation

  const { data: institutions = [] } = useQuery({
    queryKey: ['institutions'],
    queryFn: () => institutionsApi.getAll(),
  })

  const { data: thinkers = [] } = useQuery({
    queryKey: ['thinkers'],
    queryFn: () => thinkersApi.getAll(),
  })

  const [formData, setFormData] = useState<ThinkerInstitutionCreate>({
    thinker_id: thinkerId,
    institution_id: '',
    role: null,
    department: null,
    start_year: null,
    end_year: null,
    is_phd_institution: false,
    phd_advisor_id: null,
    notes: null,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (isOpen && editAffiliation) {
      setFormData({
        thinker_id: thinkerId,
        institution_id: editAffiliation.institution_id,
        role: editAffiliation.role || null,
        department: editAffiliation.department || null,
        start_year: editAffiliation.start_year || null,
        end_year: editAffiliation.end_year || null,
        is_phd_institution: editAffiliation.is_phd_institution || false,
        phd_advisor_id: editAffiliation.phd_advisor_id || null,
        notes: editAffiliation.notes || null,
      })
    } else if (isOpen) {
      setFormData((prev) => ({ ...prev, thinker_id: thinkerId }))
    } else {
      resetForm()
    }
  }, [isOpen, editAffiliation, thinkerId])

  const createMutation = useMutation({
    mutationFn: thinkerInstitutionsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['affiliations', thinkerId] })
      queryClient.invalidateQueries({ queryKey: ['thinker', thinkerId] })
      onClose()
      resetForm()
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ThinkerInstitutionCreate> }) =>
      thinkerInstitutionsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['affiliations', thinkerId] })
      queryClient.invalidateQueries({ queryKey: ['thinker', thinkerId] })
      onClose()
      resetForm()
    },
  })

  const resetForm = () => {
    setFormData({
      thinker_id: thinkerId,
      institution_id: '',
      role: null,
      department: null,
      start_year: null,
      end_year: null,
      is_phd_institution: false,
      phd_advisor_id: null,
      notes: null,
    })
    setErrors({})
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})

    try {
      const validated = affiliationSchema.parse(formData)
      if (isEditMode && editAffiliation) {
        updateMutation.mutate({ id: editAffiliation.id, data: validated })
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

  const handleChange = (field: keyof ThinkerInstitutionCreate, value: string | number | boolean | null) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const isPending = createMutation.isPending || updateMutation.isPending
  const mutationError = (createMutation.error || updateMutation.error) as Error | null

  // Filter out current thinker from advisor options
  const advisorOptions = thinkers.filter((t) => t.id !== thinkerId)

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditMode ? 'Edit Affiliation' : `Add Affiliation for ${thinkerName}`}
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <div>
          <label htmlFor="affiliation-institution" className="block text-sm font-sans font-medium text-primary mb-1">Institution *</label>
          <select
            id="affiliation-institution"
            value={formData.institution_id}
            onChange={(e) => handleChange('institution_id', e.target.value)}
            className="w-full px-3 py-2 border border-timeline rounded font-serif focus:outline-none focus:ring-2 focus:ring-accent"
          >
            <option value="">Select an institution...</option>
            {institutions.map((inst) => (
              <option key={inst.id} value={inst.id}>
                {inst.name}
                {inst.city && `, ${inst.city}`}
                {inst.country && ` (${inst.country})`}
              </option>
            ))}
          </select>
          {errors.institution_id && <p className="text-red-600 text-sm mt-1">{errors.institution_id}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="affiliation-role" className="block text-sm font-sans font-medium text-primary mb-1">Role</label>
            <input
              id="affiliation-role"
              type="text"
              value={formData.role || ''}
              onChange={(e) => handleChange('role', e.target.value || null)}
              className="w-full px-3 py-2 border border-timeline rounded font-serif focus:outline-none focus:ring-2 focus:ring-accent"
              placeholder="e.g., Professor, PhD Student"
            />
          </div>
          <div>
            <label htmlFor="affiliation-department" className="block text-sm font-sans font-medium text-primary mb-1">Department</label>
            <input
              id="affiliation-department"
              type="text"
              value={formData.department || ''}
              onChange={(e) => handleChange('department', e.target.value || null)}
              className="w-full px-3 py-2 border border-timeline rounded font-serif focus:outline-none focus:ring-2 focus:ring-accent"
              placeholder="e.g., Philosophy, History"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="affiliation-start-year" className="block text-sm font-sans font-medium text-primary mb-1">Start Year</label>
            <input
              id="affiliation-start-year"
              type="number"
              value={formData.start_year ?? ''}
              onChange={(e) => handleChange('start_year', e.target.value ? parseInt(e.target.value) : null)}
              className="w-full px-3 py-2 border border-timeline rounded font-mono focus:outline-none focus:ring-2 focus:ring-accent"
              placeholder="1950"
            />
            {errors.start_year && <p className="text-red-600 text-sm mt-1">{errors.start_year}</p>}
          </div>
          <div>
            <label htmlFor="affiliation-end-year" className="block text-sm font-sans font-medium text-primary mb-1">End Year</label>
            <input
              id="affiliation-end-year"
              type="number"
              value={formData.end_year ?? ''}
              onChange={(e) => handleChange('end_year', e.target.value ? parseInt(e.target.value) : null)}
              className="w-full px-3 py-2 border border-timeline rounded font-mono focus:outline-none focus:ring-2 focus:ring-accent"
              placeholder="Leave empty if ongoing"
            />
            {errors.end_year && <p className="text-red-600 text-sm mt-1">{errors.end_year}</p>}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="is_phd_institution"
            checked={formData.is_phd_institution || false}
            onChange={(e) => handleChange('is_phd_institution', e.target.checked)}
            className="w-4 h-4 accent-accent"
          />
          <label htmlFor="is_phd_institution" className="text-sm font-sans text-primary">
            PhD Institution (earned doctorate here)
          </label>
        </div>

        {formData.is_phd_institution && (
          <div>
            <label htmlFor="affiliation-phd-advisor" className="block text-sm font-sans font-medium text-primary mb-1">PhD Advisor</label>
            <select
              id="affiliation-phd-advisor"
              value={formData.phd_advisor_id || ''}
              onChange={(e) => handleChange('phd_advisor_id', e.target.value || null)}
              className="w-full px-3 py-2 border border-timeline rounded font-serif focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="">Select advisor (optional)...</option>
              {advisorOptions.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.field && ` (${t.field})`}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Link to the advisor&apos;s record to build academic genealogy
            </p>
          </div>
        )}

        <div>
          <label htmlFor="affiliation-notes" className="block text-sm font-sans font-medium text-primary mb-1">Notes</label>
          <textarea
            id="affiliation-notes"
            value={formData.notes || ''}
            onChange={(e) => handleChange('notes', e.target.value || null)}
            rows={3}
            className="w-full px-3 py-2 border border-timeline rounded font-serif focus:outline-none focus:ring-2 focus:ring-accent"
            placeholder="Additional notes about this affiliation..."
          />
        </div>

        <ModalError
          error={mutationError}
          fallbackMessage={`Failed to ${isEditMode ? 'update' : 'create'} affiliation. Please try again.`}
        />

        <ModalFooter>
          <ModalButton onClick={() => { onClose(); resetForm() }}>Cancel</ModalButton>
          <ModalButton type="submit" variant="primary" disabled={isPending}>
            {isPending ? (isEditMode ? 'Updating...' : 'Adding...') : isEditMode ? 'Update Affiliation' : 'Add Affiliation'}
          </ModalButton>
        </ModalFooter>
      </form>
    </Modal>
  )
}
