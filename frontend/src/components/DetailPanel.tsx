'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { thinkersApi, publicationsApi, quotesApi, tagsApi, thinkerInstitutionsApi, timelinesApi } from '@/lib/api'
import type { ThinkerUpdate, PublicationCreate, QuoteCreate, Tag, ThinkerInstitutionWithRelations, PublicationCitations, Timeline } from '@/types'
import { AddAffiliationModal } from './AddAffiliationModal'

interface DetailPanelProps {
  thinkerId: string | null
  onClose: () => void
  onOpenConnectionMap?: (thinkerId: string) => void
  onAddConnection?: (fromThinkerId: string) => void
}

export function DetailPanel({ thinkerId, onClose, onOpenConnectionMap, onAddConnection }: DetailPanelProps) {
  const queryClient = useQueryClient()
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState<ThinkerUpdate>({})
  const [showAddPublication, setShowAddPublication] = useState(false)
  const [showAddQuote, setShowAddQuote] = useState(false)
  const [editingPublicationId, setEditingPublicationId] = useState<string | null>(null)
  const [editingQuoteId, setEditingQuoteId] = useState<string | null>(null)
  const [publicationData, setPublicationData] = useState<Omit<PublicationCreate, 'thinker_id'>>({
    title: '',
    year: null,
    citation: null,
    notes: null,
  })
  const [quoteData, setQuoteData] = useState<Omit<QuoteCreate, 'thinker_id'>>({
    text: '',
    source: null,
    context_notes: null,
  })

  const { data: thinker, isLoading } = useQuery({
    queryKey: ['thinker', thinkerId],
    queryFn: () => thinkersApi.getOne(thinkerId!),
    enabled: !!thinkerId,
  })

  const { data: allTags = [] } = useQuery({
    queryKey: ['tags'],
    queryFn: tagsApi.getAll,
  })

  const { data: timelines = [] } = useQuery({
    queryKey: ['timelines'],
    queryFn: timelinesApi.getAll,
  })

  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])
  const [showTagDropdown, setShowTagDropdown] = useState(false)
  const [showAddAffiliation, setShowAddAffiliation] = useState(false)
  const [editingAffiliation, setEditingAffiliation] = useState<ThinkerInstitutionWithRelations | null>(null)
  const [showCitations, setShowCitations] = useState<string | null>(null)
  const [showAcademicLineage, setShowAcademicLineage] = useState(false)

  const { data: affiliations = [] } = useQuery({
    queryKey: ['affiliations', thinkerId],
    queryFn: () => thinkerInstitutionsApi.getAll(thinkerId!),
    enabled: !!thinkerId,
  })

  const { data: academicLineage = [] } = useQuery({
    queryKey: ['academic-lineage', thinkerId],
    queryFn: () => thinkerInstitutionsApi.getAcademicLineage(thinkerId!),
    enabled: !!thinkerId && showAcademicLineage,
  })

  const { data: citations } = useQuery({
    queryKey: ['citations', showCitations],
    queryFn: () => publicationsApi.getCitations(showCitations!),
    enabled: !!showCitations,
  })

  // Sync selected tags when thinker changes
  useEffect(() => {
    if (thinker?.tags) {
      setSelectedTagIds(thinker.tags.map((t: Tag) => t.id))
    } else {
      setSelectedTagIds([])
    }
  }, [thinker])

  const updateTagsMutation = useMutation({
    mutationFn: (tagIds: string[]) => thinkersApi.update(thinkerId!, { tag_ids: tagIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['thinker', thinkerId] })
      queryClient.invalidateQueries({ queryKey: ['thinkers'] })
    },
  })

  const handleToggleTag = (tagId: string) => {
    const newTagIds = selectedTagIds.includes(tagId)
      ? selectedTagIds.filter(id => id !== tagId)
      : [...selectedTagIds, tagId]
    setSelectedTagIds(newTagIds)
    updateTagsMutation.mutate(newTagIds)
  }

  useEffect(() => {
    if (thinker) {
      setFormData({
        name: thinker.name,
        birth_year: thinker.birth_year,
        death_year: thinker.death_year,
        active_period: thinker.active_period,
        field: thinker.field,
        biography_notes: thinker.biography_notes,
        position_x: thinker.position_x,
        position_y: thinker.position_y,
        timeline_id: thinker.timeline_id,
      })
    }
  }, [thinker])

  const updateMutation = useMutation({
    mutationFn: (data: ThinkerUpdate) => thinkersApi.update(thinkerId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['thinkers'] })
      queryClient.invalidateQueries({ queryKey: ['thinker', thinkerId] })
      setIsEditing(false)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => thinkersApi.delete(thinkerId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['thinkers'] })
      onClose()
    },
  })

  const addPublicationMutation = useMutation({
    mutationFn: (data: PublicationCreate) => publicationsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['thinker', thinkerId] })
      setShowAddPublication(false)
      setPublicationData({ title: '', year: null, citation: null, notes: null })
    },
  })

  const addQuoteMutation = useMutation({
    mutationFn: (data: QuoteCreate) => quotesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['thinker', thinkerId] })
      setShowAddQuote(false)
      setQuoteData({ text: '', source: null, context_notes: null })
    },
  })

  const updatePublicationMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Omit<PublicationCreate, 'thinker_id'> }) =>
      publicationsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['thinker', thinkerId] })
      setEditingPublicationId(null)
      setPublicationData({ title: '', year: null, citation: null, notes: null })
    },
  })

  const deletePublicationMutation = useMutation({
    mutationFn: (id: string) => publicationsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['thinker', thinkerId] })
    },
  })

  const updateQuoteMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Omit<QuoteCreate, 'thinker_id'> }) =>
      quotesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['thinker', thinkerId] })
      setEditingQuoteId(null)
      setQuoteData({ text: '', source: null, context_notes: null })
    },
  })

  const deleteQuoteMutation = useMutation({
    mutationFn: (id: string) => quotesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['thinker', thinkerId] })
    },
  })

  const deleteAffiliationMutation = useMutation({
    mutationFn: (id: string) => thinkerInstitutionsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['affiliations', thinkerId] })
    },
  })

  const handleSave = () => {
    updateMutation.mutate(formData)
  }

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this thinker? This action cannot be undone.')) {
      deleteMutation.mutate()
    }
  }

  const handleAddPublication = () => {
    if (!publicationData.title || !thinkerId) return
    addPublicationMutation.mutate({ ...publicationData, thinker_id: thinkerId })
  }

  const handleAddQuote = () => {
    if (!quoteData.text || !thinkerId) return
    addQuoteMutation.mutate({ ...quoteData, thinker_id: thinkerId })
  }

  const handleEditPublication = (pub: { id: string; title: string; year?: number | null; citation?: string | null; notes?: string | null }) => {
    setEditingPublicationId(pub.id)
    setPublicationData({
      title: pub.title,
      year: pub.year ?? null,
      citation: pub.citation ?? null,
      notes: pub.notes ?? null,
    })
  }

  const handleUpdatePublication = () => {
    if (!editingPublicationId || !publicationData.title) return
    updatePublicationMutation.mutate({ id: editingPublicationId, data: publicationData })
  }

  const handleDeletePublication = (id: string, title: string) => {
    if (confirm(`Are you sure you want to delete "${title}"?`)) {
      deletePublicationMutation.mutate(id)
    }
  }

  const handleEditQuote = (quote: { id: string; text: string; source?: string | null; context_notes?: string | null }) => {
    setEditingQuoteId(quote.id)
    setQuoteData({
      text: quote.text,
      source: quote.source ?? null,
      context_notes: quote.context_notes ?? null,
    })
  }

  const handleUpdateQuote = () => {
    if (!editingQuoteId || !quoteData.text) return
    updateQuoteMutation.mutate({ id: editingQuoteId, data: quoteData })
  }

  const handleDeleteQuote = (id: string) => {
    if (confirm('Are you sure you want to delete this quote?')) {
      deleteQuoteMutation.mutate(id)
    }
  }

  const cancelEditPublication = () => {
    setEditingPublicationId(null)
    setPublicationData({ title: '', year: null, citation: null, notes: null })
  }

  const cancelEditQuote = () => {
    setEditingQuoteId(null)
    setQuoteData({ text: '', source: null, context_notes: null })
  }

  const handleDeleteAffiliation = (id: string, institutionName: string) => {
    if (confirm(`Are you sure you want to remove the affiliation with "${institutionName}"?`)) {
      deleteAffiliationMutation.mutate(id)
    }
  }

  if (!thinkerId) return null

  return (
    <aside
      className={`fixed right-0 top-0 h-full w-full sm:w-96 bg-white shadow-2xl transform transition-transform duration-300 z-40 ${
        thinkerId ? 'translate-x-0' : 'translate-x-full'
      }`}
      role="complementary"
      aria-label="Thinker details panel"
      aria-hidden={!thinkerId}
    >
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-timeline">
          <h2 id="detail-panel-title" className="text-xl font-serif font-semibold text-primary">Thinker Details</h2>
          <div className="flex items-center gap-2">
            {thinkerId && onAddConnection && (
              <button
                onClick={() => onAddConnection(thinkerId)}
                className="px-3 py-1.5 text-xs font-sans bg-accent text-white rounded hover:bg-accent/90"
                title="Add a connection from this thinker"
              >
                + Connection
              </button>
            )}
            {thinkerId && onOpenConnectionMap && (
              <button
                onClick={() => onOpenConnectionMap(thinkerId)}
                className="px-3 py-1.5 text-xs font-sans border border-accent text-accent rounded hover:bg-accent/10"
                title="View connection map for this thinker"
              >
                View Map
              </button>
            )}
            <button
              onClick={onClose}
              className="text-secondary hover:text-primary text-2xl leading-none w-8 h-8 flex items-center justify-center rounded focus:outline-none focus:ring-2 focus:ring-accent"
              aria-label="Close details panel"
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center flex-1">
            <p className="text-secondary">Loading...</p>
          </div>
        ) : thinker ? (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div>
              <label className="block text-xs font-sans font-medium text-secondary mb-1">
                NAME
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-timeline rounded font-serif text-lg focus:outline-none focus:ring-2 focus:ring-accent"
                />
              ) : (
                <p className="font-serif text-lg text-primary">{thinker.name}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-sans font-medium text-secondary mb-1">
                  BIRTH YEAR
                </label>
                {isEditing ? (
                  <input
                    type="number"
                    value={formData.birth_year || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, birth_year: e.target.value ? parseInt(e.target.value) : null })
                    }
                    className="w-full px-3 py-2 border border-timeline rounded font-mono focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                ) : (
                  <p className="font-mono text-primary">{thinker.birth_year || '—'}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-sans font-medium text-secondary mb-1">
                  DEATH YEAR
                </label>
                {isEditing ? (
                  <input
                    type="number"
                    value={formData.death_year || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, death_year: e.target.value ? parseInt(e.target.value) : null })
                    }
                    className="w-full px-3 py-2 border border-timeline rounded font-mono focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                ) : (
                  <p className="font-mono text-primary">{thinker.death_year || '—'}</p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-sans font-medium text-secondary mb-1">
                ACTIVE PERIOD
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={formData.active_period || ''}
                  onChange={(e) => setFormData({ ...formData, active_period: e.target.value || null })}
                  className="w-full px-3 py-2 border border-timeline rounded font-serif focus:outline-none focus:ring-2 focus:ring-accent"
                />
              ) : (
                <p className="font-serif text-primary">{thinker.active_period || '—'}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-sans font-medium text-secondary mb-1">
                FIELD
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={formData.field || ''}
                  onChange={(e) => setFormData({ ...formData, field: e.target.value || null })}
                  className="w-full px-3 py-2 border border-timeline rounded font-serif focus:outline-none focus:ring-2 focus:ring-accent"
                />
              ) : (
                <p className="font-serif text-primary">{thinker.field || '—'}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-sans font-medium text-secondary mb-1">
                TIMELINE
              </label>
              {isEditing ? (
                <select
                  value={formData.timeline_id || ''}
                  onChange={(e) => setFormData({ ...formData, timeline_id: e.target.value || null })}
                  className="w-full px-3 py-2 border border-timeline rounded font-serif focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  <option value="">No timeline assigned</option>
                  {timelines.map((t: Timeline) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              ) : (
                <p className="font-serif text-primary">
                  {thinker.timeline_id
                    ? timelines.find((t: Timeline) => t.id === thinker.timeline_id)?.name || '—'
                    : <span className="text-secondary italic">Not assigned to a timeline</span>
                  }
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-sans font-medium text-secondary mb-1">
                BIOGRAPHY NOTES
              </label>
              {isEditing ? (
                <textarea
                  value={formData.biography_notes || ''}
                  onChange={(e) => setFormData({ ...formData, biography_notes: e.target.value || null })}
                  rows={6}
                  className="w-full px-3 py-2 border border-timeline rounded font-serif focus:outline-none focus:ring-2 focus:ring-accent"
                />
              ) : (
                <p className="font-serif text-primary whitespace-pre-wrap">
                  {thinker.biography_notes || '—'}
                </p>
              )}
            </div>

            <div className="border-t border-timeline pt-4">
              <h3 className="text-sm font-sans font-medium text-secondary mb-3">TAGS</h3>
              <div className="flex flex-wrap gap-2 mb-3">
                {/* Use selectedTagIds for optimistic updates - show tags immediately when added */}
                {selectedTagIds.length > 0 ? (
                  selectedTagIds.map((tagId) => {
                    const tag = allTags.find((t: Tag) => t.id === tagId)
                    if (!tag) return null
                    return (
                      <span
                        key={tag.id}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-sans text-white shadow-sm"
                        style={{ backgroundColor: tag.color || '#64748b' }}
                      >
                        {tag.name}
                        <button
                          onClick={() => handleToggleTag(tag.id)}
                          className="hover:bg-white/20 rounded-full w-4 h-4 flex items-center justify-center transition-colors"
                          title="Remove tag"
                        >
                          ×
                        </button>
                      </span>
                    )
                  })
                ) : (
                  <span className="text-sm text-secondary italic">No tags</span>
                )}
              </div>
              <div className="relative inline-block">
                <button
                  onClick={() => setShowTagDropdown(!showTagDropdown)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-sm font-sans text-accent border border-accent/30 rounded-full hover:bg-accent/5 transition-colors"
                >
                  <span className="text-base leading-none">+</span> Add Tag
                </button>
                {showTagDropdown && (
                  <div className="absolute top-full left-0 mt-2 bg-white border border-timeline rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto min-w-[180px]">
                    {allTags.length === 0 ? (
                      <p className="px-3 py-2 text-xs text-gray-500 italic">No tags available</p>
                    ) : allTags.filter((tag: Tag) => !selectedTagIds.includes(tag.id)).length === 0 ? (
                      <p className="px-3 py-2 text-xs text-gray-500 italic">All tags assigned</p>
                    ) : (
                      allTags
                        .filter((tag: Tag) => !selectedTagIds.includes(tag.id))
                        .map((tag: Tag) => (
                          <button
                            key={tag.id}
                            onClick={() => {
                              handleToggleTag(tag.id)
                              setShowTagDropdown(false)
                            }}
                            className="w-full px-3 py-2 text-left text-sm font-serif hover:bg-gray-50 flex items-center gap-2 first:rounded-t-lg last:rounded-b-lg"
                          >
                            <span
                              className="w-3 h-3 rounded-full flex-shrink-0 shadow-sm"
                              style={{ backgroundColor: tag.color || '#64748b' }}
                            />
                            {tag.name}
                          </button>
                        ))
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-timeline pt-4">
              <h3 className="text-sm font-sans font-medium text-secondary mb-3">INSTITUTIONAL AFFILIATIONS</h3>
              {affiliations.length > 0 ? (
                <ul className="space-y-3">
                  {affiliations.map((aff) => (
                    <li key={aff.id} className="group">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="text-sm font-serif text-primary font-medium">
                            {aff.institution.name}
                          </p>
                          <p className="text-xs text-secondary">
                            {aff.role && <span>{aff.role}</span>}
                            {aff.role && aff.department && <span> • </span>}
                            {aff.department && <span>{aff.department}</span>}
                          </p>
                          <p className="text-xs text-gray-500">
                            {aff.start_year && <span>{aff.start_year}</span>}
                            {aff.start_year && aff.end_year && <span> – </span>}
                            {aff.end_year ? <span>{aff.end_year}</span> : (aff.start_year && <span> – present</span>)}
                          </p>
                          {aff.is_phd_institution && (
                            <span className="inline-block mt-1 px-1.5 py-0.5 bg-accent/10 text-accent text-xs rounded">
                              PhD
                            </span>
                          )}
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2 flex-shrink-0">
                          <button
                            onClick={() => {
                              setEditingAffiliation(aff)
                              setShowAddAffiliation(true)
                            }}
                            className="px-2 py-0.5 text-xs text-accent hover:bg-gray-100 rounded"
                            title="Edit"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteAffiliation(aff.id, aff.institution.name)}
                            disabled={deleteAffiliationMutation.isPending}
                            className="px-2 py-0.5 text-xs text-red-600 hover:bg-red-50 rounded"
                            title="Remove"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-secondary italic">No institutional affiliations</p>
              )}
              <button
                onClick={() => {
                  setEditingAffiliation(null)
                  setShowAddAffiliation(true)
                }}
                className="mt-3 text-sm font-sans text-accent hover:underline"
              >
                + Add Affiliation
              </button>
              {affiliations.some(a => a.is_phd_institution) && (
                <button
                  onClick={() => setShowAcademicLineage(!showAcademicLineage)}
                  className="mt-2 ml-4 text-sm font-sans text-purple-600 hover:underline"
                >
                  {showAcademicLineage ? 'Hide' : 'View'} Academic Lineage
                </button>
              )}
              {showAcademicLineage && academicLineage.length > 0 && (
                <div className="mt-3 p-3 bg-purple-50 rounded">
                  <h4 className="text-xs font-sans font-medium text-purple-800 mb-2">PHD ADVISOR CHAIN</h4>
                  <div className="space-y-2">
                    {academicLineage.map((aff, index) => (
                      <div key={aff.id} className="flex items-center gap-2">
                        <span className="text-xs text-purple-600">{index === 0 ? '→' : '↳'}</span>
                        <div className="text-sm">
                          <span className="font-serif text-primary">{aff.institution.name}</span>
                          {aff.phd_advisor_id && (
                            <span className="text-xs text-purple-600 ml-2">
                              (Advisor: {affiliations.find(a => a.thinker_id === aff.phd_advisor_id)?.institution?.name || 'Unknown'})
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-timeline pt-4">
              <h3 className="text-sm font-sans font-medium text-secondary mb-3">PUBLICATIONS</h3>
              {thinker.publications && thinker.publications.length > 0 ? (
                <ul className="space-y-2">
                  {thinker.publications.map((pub) => (
                    <li key={pub.id} className="group">
                      {editingPublicationId === pub.id ? (
                        <div className="space-y-2 p-3 bg-gray-50 rounded">
                          <input
                            type="text"
                            placeholder="Title *"
                            value={publicationData.title}
                            onChange={(e) => setPublicationData({ ...publicationData, title: e.target.value })}
                            className="w-full px-2 py-1 text-sm border border-timeline rounded font-serif focus:outline-none focus:ring-2 focus:ring-accent"
                          />
                          <input
                            type="number"
                            placeholder="Year"
                            value={publicationData.year || ''}
                            onChange={(e) => setPublicationData({ ...publicationData, year: e.target.value ? parseInt(e.target.value) : null })}
                            className="w-full px-2 py-1 text-sm border border-timeline rounded font-mono focus:outline-none focus:ring-2 focus:ring-accent"
                          />
                          <input
                            type="text"
                            placeholder="Citation"
                            value={publicationData.citation || ''}
                            onChange={(e) => setPublicationData({ ...publicationData, citation: e.target.value || null })}
                            className="w-full px-2 py-1 text-sm border border-timeline rounded font-serif focus:outline-none focus:ring-2 focus:ring-accent"
                          />
                          <textarea
                            placeholder="Notes"
                            value={publicationData.notes || ''}
                            onChange={(e) => setPublicationData({ ...publicationData, notes: e.target.value || null })}
                            rows={2}
                            className="w-full px-2 py-1 text-sm border border-timeline rounded font-serif focus:outline-none focus:ring-2 focus:ring-accent"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={cancelEditPublication}
                              className="px-3 py-1 text-sm border border-timeline rounded font-sans hover:bg-gray-100"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={handleUpdatePublication}
                              disabled={!publicationData.title || updatePublicationMutation.isPending}
                              className="px-3 py-1 text-sm bg-accent text-white rounded font-sans hover:bg-opacity-90 disabled:opacity-50"
                            >
                              {updatePublicationMutation.isPending ? 'Saving...' : 'Save'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between">
                          <span className="text-sm font-serif text-primary">
                            {pub.title} {pub.year && `(${pub.year})`}
                          </span>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => setShowCitations(pub.id)}
                              className="px-2 py-0.5 text-xs text-blue-600 hover:bg-blue-50 rounded"
                              title="View Citations"
                            >
                              Cite
                            </button>
                            <button
                              onClick={() => handleEditPublication(pub)}
                              className="px-2 py-0.5 text-xs text-accent hover:bg-gray-100 rounded"
                              title="Edit"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeletePublication(pub.id, pub.title)}
                              disabled={deletePublicationMutation.isPending}
                              className="px-2 py-0.5 text-xs text-red-600 hover:bg-red-50 rounded"
                              title="Delete"
                            >
                              ×
                            </button>
                          </div>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-secondary italic">No publications added</p>
              )}

              {showAddPublication ? (
                <div className="mt-3 space-y-2 p-3 bg-gray-50 rounded">
                  <input
                    type="text"
                    placeholder="Title *"
                    value={publicationData.title}
                    onChange={(e) => setPublicationData({ ...publicationData, title: e.target.value })}
                    className="w-full px-2 py-1 text-sm border border-timeline rounded font-serif focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                  <input
                    type="number"
                    placeholder="Year"
                    value={publicationData.year || ''}
                    onChange={(e) => setPublicationData({ ...publicationData, year: e.target.value ? parseInt(e.target.value) : null })}
                    className="w-full px-2 py-1 text-sm border border-timeline rounded font-mono focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                  <input
                    type="text"
                    placeholder="Citation"
                    value={publicationData.citation || ''}
                    onChange={(e) => setPublicationData({ ...publicationData, citation: e.target.value || null })}
                    className="w-full px-2 py-1 text-sm border border-timeline rounded font-serif focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                  <textarea
                    placeholder="Notes"
                    value={publicationData.notes || ''}
                    onChange={(e) => setPublicationData({ ...publicationData, notes: e.target.value || null })}
                    rows={2}
                    className="w-full px-2 py-1 text-sm border border-timeline rounded font-serif focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setShowAddPublication(false)
                        setPublicationData({ title: '', year: null, citation: null, notes: null })
                      }}
                      className="px-3 py-1 text-sm border border-timeline rounded font-sans hover:bg-gray-100"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAddPublication}
                      disabled={!publicationData.title || addPublicationMutation.isPending}
                      className="px-3 py-1 text-sm bg-accent text-white rounded font-sans hover:bg-opacity-90 disabled:opacity-50"
                    >
                      {addPublicationMutation.isPending ? 'Adding...' : 'Add'}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowAddPublication(true)}
                  className="mt-3 text-sm font-sans text-accent hover:underline"
                >
                  + Add Publication
                </button>
              )}
            </div>

            <div className="border-t border-timeline pt-4">
              <h3 className="text-sm font-sans font-medium text-secondary mb-3">QUOTES</h3>
              {thinker.quotes && thinker.quotes.length > 0 ? (
                <ul className="space-y-3">
                  {thinker.quotes.map((quote) => (
                    <li key={quote.id} className="group">
                      {editingQuoteId === quote.id ? (
                        <div className="space-y-2 p-3 bg-gray-50 rounded">
                          <textarea
                            placeholder="Quote text *"
                            value={quoteData.text}
                            onChange={(e) => setQuoteData({ ...quoteData, text: e.target.value })}
                            rows={3}
                            className="w-full px-2 py-1 text-sm border border-timeline rounded font-serif focus:outline-none focus:ring-2 focus:ring-accent"
                          />
                          <input
                            type="text"
                            placeholder="Source (e.g., book, page)"
                            value={quoteData.source || ''}
                            onChange={(e) => setQuoteData({ ...quoteData, source: e.target.value || null })}
                            className="w-full px-2 py-1 text-sm border border-timeline rounded font-serif focus:outline-none focus:ring-2 focus:ring-accent"
                          />
                          <textarea
                            placeholder="Context notes (why this matters to you)"
                            value={quoteData.context_notes || ''}
                            onChange={(e) => setQuoteData({ ...quoteData, context_notes: e.target.value || null })}
                            rows={2}
                            className="w-full px-2 py-1 text-sm border border-timeline rounded font-serif focus:outline-none focus:ring-2 focus:ring-accent"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={cancelEditQuote}
                              className="px-3 py-1 text-sm border border-timeline rounded font-sans hover:bg-gray-100"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={handleUpdateQuote}
                              disabled={!quoteData.text || updateQuoteMutation.isPending}
                              className="px-3 py-1 text-sm bg-accent text-white rounded font-sans hover:bg-opacity-90 disabled:opacity-50"
                            >
                              {updateQuoteMutation.isPending ? 'Saving...' : 'Save'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="border-l-2 border-timeline pl-3">
                          <div className="flex items-start justify-between">
                            <span className="text-sm font-serif text-primary">"{quote.text}"</span>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2 flex-shrink-0">
                              <button
                                onClick={() => handleEditQuote(quote)}
                                className="px-2 py-0.5 text-xs text-accent hover:bg-gray-100 rounded"
                                title="Edit"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteQuote(quote.id)}
                                disabled={deleteQuoteMutation.isPending}
                                className="px-2 py-0.5 text-xs text-red-600 hover:bg-red-50 rounded"
                                title="Delete"
                              >
                                ×
                              </button>
                            </div>
                          </div>
                          {quote.source && <p className="text-xs text-secondary mt-1">— {quote.source}</p>}
                          {quote.context_notes && <p className="text-xs text-gray-500 mt-1 italic">{quote.context_notes}</p>}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-secondary italic">No quotes added</p>
              )}

              {showAddQuote ? (
                <div className="mt-3 space-y-2 p-3 bg-gray-50 rounded">
                  <textarea
                    placeholder="Quote text *"
                    value={quoteData.text}
                    onChange={(e) => setQuoteData({ ...quoteData, text: e.target.value })}
                    rows={3}
                    className="w-full px-2 py-1 text-sm border border-timeline rounded font-serif focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                  <input
                    type="text"
                    placeholder="Source (e.g., book, page)"
                    value={quoteData.source || ''}
                    onChange={(e) => setQuoteData({ ...quoteData, source: e.target.value || null })}
                    className="w-full px-2 py-1 text-sm border border-timeline rounded font-serif focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                  <textarea
                    placeholder="Context notes (why this matters to you)"
                    value={quoteData.context_notes || ''}
                    onChange={(e) => setQuoteData({ ...quoteData, context_notes: e.target.value || null })}
                    rows={2}
                    className="w-full px-2 py-1 text-sm border border-timeline rounded font-serif focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setShowAddQuote(false)
                        setQuoteData({ text: '', source: null, context_notes: null })
                      }}
                      className="px-3 py-1 text-sm border border-timeline rounded font-sans hover:bg-gray-100"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAddQuote}
                      disabled={!quoteData.text || addQuoteMutation.isPending}
                      className="px-3 py-1 text-sm bg-accent text-white rounded font-sans hover:bg-opacity-90 disabled:opacity-50"
                    >
                      {addQuoteMutation.isPending ? 'Adding...' : 'Add'}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowAddQuote(true)}
                  className="mt-3 text-sm font-sans text-accent hover:underline"
                >
                  + Add Quote
                </button>
              )}
            </div>
          </div>
        ) : null}

        <div className="border-t border-timeline px-6 py-4 flex justify-between">
          {isEditing ? (
            <>
              <button
                onClick={() => {
                  setIsEditing(false)
                  if (thinker) {
                    setFormData({
                      name: thinker.name,
                      birth_year: thinker.birth_year,
                      death_year: thinker.death_year,
                      active_period: thinker.active_period,
                      field: thinker.field,
                      biography_notes: thinker.biography_notes,
                      position_x: thinker.position_x,
                      position_y: thinker.position_y,
                    })
                  }
                }}
                className="px-4 py-2 border border-timeline rounded font-sans text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={updateMutation.isPending}
                className="px-4 py-2 bg-accent text-white rounded font-sans text-sm hover:bg-opacity-90 disabled:opacity-50"
              >
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 border border-red-600 text-red-600 rounded font-sans text-sm hover:bg-red-50 disabled:opacity-50"
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
              <button
                onClick={() => setIsEditing(true)}
                className="px-4 py-2 bg-accent text-white rounded font-sans text-sm hover:bg-opacity-90"
              >
                Edit
              </button>
            </>
          )}
        </div>
      </div>

      {thinker && (
        <AddAffiliationModal
          isOpen={showAddAffiliation}
          onClose={() => {
            setShowAddAffiliation(false)
            setEditingAffiliation(null)
          }}
          thinkerId={thinkerId!}
          thinkerName={thinker.name}
          editAffiliation={editingAffiliation}
        />
      )}

      {/* Citations Modal */}
      {showCitations && citations && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-timeline">
              <h3 className="text-lg font-serif font-semibold text-primary">Citation Formats</h3>
              <button
                onClick={() => setShowCitations(null)}
                className="text-secondary hover:text-primary text-2xl leading-none"
              >
                &times;
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-sans font-medium text-secondary">CHICAGO</label>
                  <button
                    onClick={() => navigator.clipboard.writeText(citations.chicago)}
                    className="text-xs text-accent hover:underline"
                  >
                    Copy
                  </button>
                </div>
                <p className="text-sm font-serif text-primary bg-gray-50 p-3 rounded">{citations.chicago}</p>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-sans font-medium text-secondary">MLA</label>
                  <button
                    onClick={() => navigator.clipboard.writeText(citations.mla)}
                    className="text-xs text-accent hover:underline"
                  >
                    Copy
                  </button>
                </div>
                <p className="text-sm font-serif text-primary bg-gray-50 p-3 rounded">{citations.mla}</p>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-sans font-medium text-secondary">APA</label>
                  <button
                    onClick={() => navigator.clipboard.writeText(citations.apa)}
                    className="text-xs text-accent hover:underline"
                  >
                    Copy
                  </button>
                </div>
                <p className="text-sm font-serif text-primary bg-gray-50 p-3 rounded">{citations.apa}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}
