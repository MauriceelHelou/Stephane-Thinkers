'use client'

import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { criticalTermsApi } from '@/lib/api'
import { Modal, ModalButton, ModalError, ModalFooter } from '@/components/Modal'
import type { CriticalTermCreate } from '@/types'

interface FlagTermDialogProps {
  isOpen: boolean
  onClose: () => void
  initialTerm?: string
}

export function FlagTermDialog({ isOpen, onClose, initialTerm }: FlagTermDialogProps) {
  const queryClient = useQueryClient()
  const [formData, setFormData] = useState<CriticalTermCreate>({
    name: '',
    description: '',
  })
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    setFormData({ name: initialTerm?.trim().toLowerCase() || '', description: '' })
    setSuccessMessage(null)
    setErrorMessage(null)
  }, [initialTerm, isOpen])

  const createMutation = useMutation({
    mutationFn: (data: CriticalTermCreate) => criticalTermsApi.create(data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['critical-terms'] })
      queryClient.invalidateQueries({ queryKey: ['term-thinker-matrix'] })
      setSuccessMessage(
        `Flagged '${result.name}'. Found ${result.occurrence_count} occurrence${
          result.occurrence_count === 1 ? '' : 's'
        } across your notes.`
      )
      setErrorMessage(null)
    },
    onError: (error: Error) => {
      setErrorMessage(error.message)
      setSuccessMessage(null)
    },
  })

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    setErrorMessage(null)

    if (!formData.name.trim()) {
      setErrorMessage('Term name is required')
      return
    }

    createMutation.mutate({
      ...formData,
      name: formData.name.trim(),
    })
  }

  const handleClose = () => {
    setErrorMessage(null)
    setSuccessMessage(null)
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Flag Critical Term" maxWidth="md">
      <div className="p-6">
        {successMessage ? (
          <div className="space-y-4">
            <div className="p-4 bg-green-50 border border-green-200 rounded text-sm text-green-800">
              {successMessage}
            </div>
            <p className="text-sm text-gray-600">
              This term is now highlighted in notes and tracked across your research corpus.
            </p>
            <ModalFooter>
              <ModalButton variant="primary" onClick={handleClose}>
                Done
              </ModalButton>
            </ModalFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-sans font-medium text-primary mb-1">Term</label>
              <input
                type="text"
                value={formData.name}
                onChange={(event) =>
                  setFormData((prev) => ({
                    ...prev,
                    name: event.target.value,
                  }))
                }
                className="w-full px-3 py-2 border border-timeline rounded font-mono text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                placeholder='e.g., "habit", "dasein", "praxis"'
                autoFocus
              />
              <p className="mt-1 text-xs text-gray-400">Will be normalized to lowercase. Matches whole words only.</p>
            </div>

            <div>
              <label className="block text-sm font-sans font-medium text-primary mb-1">
                Description <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <textarea
                value={formData.description || ''}
                onChange={(event) =>
                  setFormData((prev) => ({
                    ...prev,
                    description: event.target.value,
                  }))
                }
                rows={3}
                className="w-full px-3 py-2 border border-timeline rounded font-serif text-sm focus:outline-none focus:ring-2 focus:ring-accent resize-y"
                placeholder="Why this term matters to your research..."
              />
            </div>

            <ModalError message={errorMessage} />

            {createMutation.isPending && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-800">
                Scanning all notes for this term...
              </div>
            )}

            <ModalFooter>
              <ModalButton onClick={handleClose}>Cancel</ModalButton>
              <ModalButton
                type="submit"
                variant="primary"
                disabled={createMutation.isPending || !formData.name.trim()}
              >
                {createMutation.isPending ? 'Scanning...' : 'Flag Term'}
              </ModalButton>
            </ModalFooter>
          </form>
        )}
      </div>
    </Modal>
  )
}
