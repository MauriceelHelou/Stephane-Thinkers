'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { institutionsApi } from '@/lib/api'
import type { Institution, InstitutionCreate } from '@/types'

interface InstitutionsManagementModalProps {
  isOpen: boolean
  onClose: () => void
}

export function InstitutionsManagementModal({ isOpen, onClose }: InstitutionsManagementModalProps) {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<'list' | 'create'>('list')
  const [editingInstitution, setEditingInstitution] = useState<Institution | null>(null)
  const [filterCountry, setFilterCountry] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [formData, setFormData] = useState<InstitutionCreate>({
    name: '',
    city: null,
    country: null,
    latitude: null,
    longitude: null,
    founded_year: null,
    notes: null,
  })

  const { data: institutions = [], isLoading } = useQuery({
    queryKey: ['institutions', filterCountry],
    queryFn: () => institutionsApi.getAll(filterCountry || undefined),
    enabled: isOpen,
  })

  const createMutation = useMutation({
    mutationFn: institutionsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['institutions'] })
      resetForm()
      setActiveTab('list')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<InstitutionCreate> }) =>
      institutionsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['institutions'] })
      setEditingInstitution(null)
      resetForm()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: institutionsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['institutions'] })
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
  }

  const handleSubmit = () => {
    if (!formData.name) return

    if (editingInstitution) {
      updateMutation.mutate({
        id: editingInstitution.id,
        data: formData,
      })
    } else {
      createMutation.mutate(formData)
    }
  }

  const handleEdit = (institution: Institution) => {
    setEditingInstitution(institution)
    setFormData({
      name: institution.name,
      city: institution.city,
      country: institution.country,
      latitude: institution.latitude,
      longitude: institution.longitude,
      founded_year: institution.founded_year,
      notes: institution.notes,
    })
    setActiveTab('create')
  }

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete "${name}"? This will also remove all affiliations with this institution.`)) {
      deleteMutation.mutate(id)
    }
  }

  const cancelEdit = () => {
    setEditingInstitution(null)
    resetForm()
    setActiveTab('list')
  }

  if (!isOpen) return null

  // Get unique countries for filter
  const countries = Array.from(
    new Set(institutions.map((i: Institution) => i.country).filter(Boolean))
  ).sort()

  // Filter by search
  const filteredInstitutions = searchQuery
    ? institutions.filter((i: Institution) =>
        i.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        i.city?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : institutions

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-timeline">
          <h2 className="text-xl font-serif font-semibold text-primary">Institutions</h2>
          <button
            onClick={onClose}
            className="text-secondary hover:text-primary text-2xl leading-none"
          >
            &times;
          </button>
        </div>

        <div className="flex border-b border-timeline">
          <button
            onClick={() => setActiveTab('list')}
            className={`px-4 py-2 text-sm font-sans ${
              activeTab === 'list'
                ? 'border-b-2 border-accent text-accent'
                : 'text-secondary hover:text-primary'
            }`}
          >
            All Institutions ({institutions.length})
          </button>
          <button
            onClick={() => setActiveTab('create')}
            className={`px-4 py-2 text-sm font-sans ${
              activeTab === 'create'
                ? 'border-b-2 border-accent text-accent'
                : 'text-secondary hover:text-primary'
            }`}
          >
            {editingInstitution ? 'Edit Institution' : '+ Add Institution'}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'list' && (
            <div className="space-y-4">
              {/* Filters */}
              <div className="flex gap-4 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search institutions..."
                    className="w-full px-3 py-1.5 pl-8 border border-timeline rounded text-sm font-sans focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                  <svg
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </div>
                <select
                  value={filterCountry}
                  onChange={(e) => setFilterCountry(e.target.value)}
                  className="px-3 py-1.5 border border-timeline rounded text-sm font-sans"
                >
                  <option value="">All Countries</option>
                  {countries.map((country) => (
                    <option key={country as string} value={country as string}>{country as string}</option>
                  ))}
                </select>
              </div>

              {isLoading ? (
                <p className="text-secondary">Loading institutions...</p>
              ) : filteredInstitutions.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-secondary mb-4">
                    {searchQuery || filterCountry
                      ? 'No institutions match your filters'
                      : 'No institutions yet'}
                  </p>
                  <button
                    onClick={() => setActiveTab('create')}
                    className="px-4 py-2 bg-accent text-white rounded font-sans text-sm hover:bg-opacity-90"
                  >
                    Add First Institution
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredInstitutions.map((institution: Institution) => (
                    <div
                      key={institution.id}
                      className="border border-timeline rounded-lg p-4 hover:bg-gray-50 group"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-serif font-medium text-primary">{institution.name}</h4>
                          <div className="flex items-center gap-2 text-sm text-secondary mt-1">
                            {institution.city && <span>{institution.city}</span>}
                            {institution.city && institution.country && <span>•</span>}
                            {institution.country && <span>{institution.country}</span>}
                            {institution.founded_year && (
                              <>
                                <span>•</span>
                                <span>Founded {institution.founded_year}</span>
                              </>
                            )}
                          </div>
                          {institution.notes && (
                            <p className="text-sm text-gray-500 mt-2">{institution.notes}</p>
                          )}
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleEdit(institution)}
                            className="px-2 py-1 text-xs text-accent hover:bg-gray-100 rounded"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(institution.id, institution.name)}
                            className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'create' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-sans font-medium text-secondary mb-1">
                  INSTITUTION NAME *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-timeline rounded font-serif focus:outline-none focus:ring-2 focus:ring-accent"
                  placeholder="e.g., Harvard University"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-sans font-medium text-secondary mb-1">
                    CITY
                  </label>
                  <input
                    type="text"
                    value={formData.city || ''}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value || null })}
                    className="w-full px-3 py-2 border border-timeline rounded font-sans focus:outline-none focus:ring-2 focus:ring-accent"
                    placeholder="e.g., Cambridge"
                  />
                </div>
                <div>
                  <label className="block text-xs font-sans font-medium text-secondary mb-1">
                    COUNTRY
                  </label>
                  <input
                    type="text"
                    value={formData.country || ''}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value || null })}
                    className="w-full px-3 py-2 border border-timeline rounded font-sans focus:outline-none focus:ring-2 focus:ring-accent"
                    placeholder="e.g., USA"
                    list="countries"
                  />
                  <datalist id="countries">
                    {countries.map((country) => (
                      <option key={country as string} value={country as string} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-sans font-medium text-secondary mb-1">
                    FOUNDED YEAR
                  </label>
                  <input
                    type="number"
                    value={formData.founded_year || ''}
                    onChange={(e) => setFormData({ ...formData, founded_year: e.target.value ? parseInt(e.target.value) : null })}
                    className="w-full px-3 py-2 border border-timeline rounded font-mono focus:outline-none focus:ring-2 focus:ring-accent"
                    placeholder="e.g., 1636"
                  />
                </div>
                <div>
                  <label className="block text-xs font-sans font-medium text-secondary mb-1">
                    LATITUDE
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={formData.latitude || ''}
                    onChange={(e) => setFormData({ ...formData, latitude: e.target.value ? parseFloat(e.target.value) : null })}
                    className="w-full px-3 py-2 border border-timeline rounded font-mono focus:outline-none focus:ring-2 focus:ring-accent"
                    placeholder="e.g., 42.374"
                  />
                </div>
                <div>
                  <label className="block text-xs font-sans font-medium text-secondary mb-1">
                    LONGITUDE
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={formData.longitude || ''}
                    onChange={(e) => setFormData({ ...formData, longitude: e.target.value ? parseFloat(e.target.value) : null })}
                    className="w-full px-3 py-2 border border-timeline rounded font-mono focus:outline-none focus:ring-2 focus:ring-accent"
                    placeholder="e.g., -71.117"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-sans font-medium text-secondary mb-1">
                  NOTES
                </label>
                <textarea
                  value={formData.notes || ''}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value || null })}
                  rows={3}
                  className="w-full px-3 py-2 border border-timeline rounded font-serif focus:outline-none focus:ring-2 focus:ring-accent"
                  placeholder="Additional information about the institution..."
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                {editingInstitution && (
                  <button
                    onClick={cancelEdit}
                    className="px-4 py-2 border border-timeline rounded font-sans text-sm hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                )}
                <button
                  onClick={handleSubmit}
                  disabled={!formData.name || createMutation.isPending || updateMutation.isPending}
                  className="px-4 py-2 bg-accent text-white rounded font-sans text-sm hover:bg-opacity-90 disabled:opacity-50"
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? 'Saving...'
                    : editingInstitution
                    ? 'Update Institution'
                    : 'Add Institution'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
