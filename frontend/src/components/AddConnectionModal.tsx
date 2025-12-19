'use client'

import { useState, useEffect, useMemo } from 'react'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { connectionsApi, thinkersApi } from '@/lib/api'
import { Modal, ModalButton, ModalError } from '@/components/Modal'
import { SearchableSelect } from '@/components/SearchableSelect'
import { ConnectionType, type ConnectionCreate, type Thinker } from '@/types'

interface AddConnectionModalProps {
  isOpen: boolean
  onClose: () => void
  fromThinkerId?: string | null
  toThinkerId?: string | null
  editingConnectionId?: string | null
}

export function AddConnectionModal({
  isOpen,
  onClose,
  fromThinkerId,
  toThinkerId,
  editingConnectionId,
}: AddConnectionModalProps) {
  const queryClient = useQueryClient()
  const [validationError, setValidationError] = useState<string | null>(null)
  // BUG #11 FIX: Use null for empty UUIDs instead of empty strings
  const [formData, setFormData] = useState<ConnectionCreate>({
    from_thinker_id: fromThinkerId || null as unknown as string,
    to_thinker_id: toThinkerId || null as unknown as string,
    connection_type: ConnectionType.influenced,
    name: null,
    notes: null,
    bidirectional: false,
    strength: null,
  })

  const { data: thinkers = [] } = useQuery({
    queryKey: ['thinkers'],
    queryFn: () => thinkersApi.getAll(),
    enabled: isOpen,
  })

  const { data: editingConnection } = useQuery({
    queryKey: ['connection', editingConnectionId],
    queryFn: () => connectionsApi.getOne(editingConnectionId!),
    enabled: isOpen && !!editingConnectionId,
  })

  const createMutation = useMutation({
    mutationFn: connectionsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connections'] })
      onClose()
      resetForm()
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ConnectionCreate }) => connectionsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connections'] })
      queryClient.invalidateQueries({ queryKey: ['connection', editingConnectionId] })
      onClose()
      resetForm()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: connectionsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connections'] })
      onClose()
      resetForm()
    },
  })

  const resetForm = () => {
    setValidationError(null)
    setFormData({
      from_thinker_id: null as unknown as string,
      to_thinker_id: null as unknown as string,
      connection_type: ConnectionType.influenced,
      name: null,
      notes: null,
      bidirectional: false,
      strength: null,
    })
  }

  useEffect(() => {
    if (isOpen && fromThinkerId && toThinkerId) {
      setFormData(prev => ({ ...prev, from_thinker_id: fromThinkerId, to_thinker_id: toThinkerId }))
    }
  }, [isOpen, fromThinkerId, toThinkerId])

  useEffect(() => {
    if (isOpen && editingConnection) {
      setFormData({
        from_thinker_id: editingConnection.from_thinker_id,
        to_thinker_id: editingConnection.to_thinker_id,
        connection_type: editingConnection.connection_type,
        name: editingConnection.name,
        notes: editingConnection.notes,
        bidirectional: editingConnection.bidirectional,
        strength: editingConnection.strength,
      })
    }
  }, [isOpen, editingConnection])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setValidationError(null)
    if (!formData.from_thinker_id || !formData.to_thinker_id) {
      setValidationError('Please select both thinkers')
      return
    }
    if (formData.from_thinker_id === formData.to_thinker_id) {
      setValidationError('Cannot create a connection from a thinker to themselves')
      return
    }
    if (editingConnectionId) {
      updateMutation.mutate({ id: editingConnectionId, data: formData })
    } else {
      createMutation.mutate(formData)
    }
  }

  const handleDelete = () => {
    if (editingConnectionId && confirm('Are you sure you want to delete this connection?')) {
      deleteMutation.mutate(editingConnectionId)
    }
  }

  const fromThinker = thinkers.find((t) => t.id === (fromThinkerId || formData.from_thinker_id))
  const toThinker = thinkers.find((t) => t.id === (toThinkerId || formData.to_thinker_id))
  const isError = createMutation.isError || updateMutation.isError || deleteMutation.isError || !!validationError
  const mutationError = createMutation.error || updateMutation.error || deleteMutation.error

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingConnectionId ? 'Edit Connection' : 'Add Connection'}
    >
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        {fromThinkerId && toThinkerId && fromThinker && toThinker ? (
          <div className="bg-accent bg-opacity-10 border border-accent rounded-lg p-4">
            <p className="text-xs font-sans font-medium text-secondary mb-2">Connection</p>
            <div className="flex items-center gap-3 font-serif text-lg">
              <span className="text-primary font-semibold">{fromThinker.name}</span>
              <span className="text-accent">→</span>
              <span className="text-primary font-semibold">{toThinker.name}</span>
            </div>
            {fromThinker.birth_year && fromThinker.death_year && (
              <p className="text-xs font-mono text-secondary mt-1">
                {fromThinker.birth_year}–{fromThinker.death_year}
              </p>
            )}
            {toThinker.birth_year && toThinker.death_year && (
              <p className="text-xs font-mono text-secondary">
                → {toThinker.birth_year}–{toThinker.death_year}
              </p>
            )}
          </div>
        ) : (
          <>
            <div>
              <label className="block text-sm font-sans font-medium text-primary mb-1">From Thinker *</label>
              <SearchableSelect<Thinker>
                options={thinkers}
                value={thinkers.find(t => t.id === formData.from_thinker_id) || null}
                onChange={(thinker) => setFormData({ ...formData, from_thinker_id: thinker?.id || null as unknown as string })}
                getLabel={(t) => `${t.name}${t.birth_year ? ` (${t.birth_year}${t.death_year ? `–${t.death_year}` : ''})` : ''}`}
                getValue={(t) => t.id}
                placeholder="Select thinker..."
                searchPlaceholder="Search by name..."
              />
            </div>
            <div>
              <label className="block text-sm font-sans font-medium text-primary mb-1">To Thinker *</label>
              <SearchableSelect<Thinker>
                options={thinkers}
                value={thinkers.find(t => t.id === formData.to_thinker_id) || null}
                onChange={(thinker) => setFormData({ ...formData, to_thinker_id: thinker?.id || null as unknown as string })}
                getLabel={(t) => `${t.name}${t.birth_year ? ` (${t.birth_year}${t.death_year ? `–${t.death_year}` : ''})` : ''}`}
                getValue={(t) => t.id}
                placeholder="Select thinker..."
                searchPlaceholder="Search by name..."
              />
            </div>
          </>
        )}

        <div>
          <label className="block text-sm font-sans font-medium text-primary mb-1">Connection Name (optional)</label>
          <input
            type="text"
            value={formData.name || ''}
            onChange={(e) => setFormData({ ...formData, name: e.target.value || null })}
            className="w-full px-3 py-2 border border-timeline rounded font-serif focus:outline-none focus:ring-2 focus:ring-accent"
            placeholder="e.g., Direct mentorship, Correspondence, etc."
          />
          <p className="text-xs text-gray-500 mt-1">This name will float above the connection line on the timeline</p>
        </div>

        <div>
          <label className="block text-sm font-sans font-medium text-primary mb-1">Connection Type *</label>
          <select
            value={formData.connection_type}
            onChange={(e) => setFormData({ ...formData, connection_type: e.target.value as ConnectionType })}
            className="w-full px-3 py-2 border border-timeline rounded font-serif focus:outline-none focus:ring-2 focus:ring-accent"
          >
            <option value={ConnectionType.influenced}>Influenced</option>
            <option value={ConnectionType.critiqued}>Critiqued</option>
            <option value={ConnectionType.built_upon}>Built Upon</option>
            <option value={ConnectionType.synthesized}>Synthesized</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-sans font-medium text-primary mb-1">Notes</label>
          <textarea
            value={formData.notes || ''}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value || null })}
            rows={4}
            className="w-full px-3 py-2 border border-timeline rounded font-serif focus:outline-none focus:ring-2 focus:ring-accent"
            placeholder="Explain the nature of this relationship..."
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="bidirectional"
            checked={formData.bidirectional}
            onChange={(e) => setFormData({ ...formData, bidirectional: e.target.checked })}
            className="w-4 h-4 text-accent focus:ring-accent border-timeline rounded"
          />
          <label htmlFor="bidirectional" className="text-sm font-sans text-primary">
            Bidirectional (mutual influence)
          </label>
        </div>

        <div>
          <label className="block text-sm font-sans font-medium text-primary mb-1">Strength (1-5, optional)</label>
          <input
            type="number"
            min="1"
            max="5"
            value={formData.strength || ''}
            onChange={(e) => setFormData({ ...formData, strength: e.target.value ? parseInt(e.target.value) : null })}
            className="w-full px-3 py-2 border border-timeline rounded font-mono focus:outline-none focus:ring-2 focus:ring-accent"
            placeholder="1-5"
          />
        </div>

        {isError && <ModalError error={mutationError as Error | null} message={validationError} />}

        <div className="flex justify-between gap-3 pt-4">
          {editingConnectionId && (
            <ModalButton variant="danger" onClick={handleDelete} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </ModalButton>
          )}
          <div className="flex gap-3 ml-auto">
            <ModalButton onClick={() => { onClose(); resetForm() }}>Cancel</ModalButton>
            <ModalButton
              type="submit"
              variant="primary"
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending
                ? editingConnectionId ? 'Updating...' : 'Adding...'
                : editingConnectionId ? 'Update Connection' : 'Add Connection'}
            </ModalButton>
          </div>
        </div>
      </form>
    </Modal>
  )
}
