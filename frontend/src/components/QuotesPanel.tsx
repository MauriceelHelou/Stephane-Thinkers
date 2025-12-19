'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { quotesApi, thinkersApi } from '@/lib/api'
import type { Quote, QuoteCreate, QuoteUpdate, Thinker } from '@/types'

interface QuotesPanelProps {
  isOpen: boolean
  onClose: () => void
  onThinkerSelect?: (thinkerId: string) => void
}

export function QuotesPanel({ isOpen, onClose, onThinkerSelect }: QuotesPanelProps) {
  const queryClient = useQueryClient()
  const [filterThinker, setFilterThinker] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'date' | 'thinker' | 'source'>('thinker')
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingQuote, setEditingQuote] = useState<Quote | null>(null)

  // Form state
  const [formData, setFormData] = useState<QuoteCreate>({
    thinker_id: '',
    text: '',
    source: '',
    year: undefined,
    context_notes: '',
  })

  const { data: quotes = [], isLoading: quotesLoading } = useQuery({
    queryKey: ['quotes'],
    queryFn: () => quotesApi.getAll(),
    enabled: isOpen,
  })

  const { data: thinkers = [] } = useQuery({
    queryKey: ['thinkers'],
    queryFn: () => thinkersApi.getAll(),
    enabled: isOpen,
  })

  const thinkerMap = new Map(thinkers.map((t: Thinker) => [t.id, t]))

  const createMutation = useMutation({
    mutationFn: quotesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] })
      setShowAddForm(false)
      resetForm()
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: QuoteUpdate }) => quotesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] })
      setEditingQuote(null)
      resetForm()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: quotesApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] })
    },
  })

  const resetForm = () => {
    setFormData({
      thinker_id: '',
      text: '',
      source: '',
      year: undefined,
      context_notes: '',
    })
  }

  // Filter and sort quotes
  const filteredQuotes = quotes
    .filter((q: Quote) => {
      if (filterThinker && q.thinker_id !== filterThinker) return false
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const thinker = thinkerMap.get(q.thinker_id)
        return (
          q.text.toLowerCase().includes(query) ||
          (q.source && q.source.toLowerCase().includes(query)) ||
          (thinker && thinker.name.toLowerCase().includes(query))
        )
      }
      return true
    })
    .sort((a: Quote, b: Quote) => {
      switch (sortBy) {
        case 'date':
          return (b.year || 0) - (a.year || 0)
        case 'source':
          return (a.source || '').localeCompare(b.source || '')
        case 'thinker':
        default:
          const thinkerA = thinkerMap.get(a.thinker_id)
          const thinkerB = thinkerMap.get(b.thinker_id)
          return (thinkerA?.name || '').localeCompare(thinkerB?.name || '')
      }
    })

  // Group quotes by thinker for visual display
  const quotesByThinker = filteredQuotes.reduce((acc: Record<string, Quote[]>, quote: Quote) => {
    const thinkerId = quote.thinker_id
    if (!acc[thinkerId]) acc[thinkerId] = []
    acc[thinkerId].push(quote)
    return acc
  }, {})

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.thinker_id || !formData.text.trim()) return

    if (editingQuote) {
      updateMutation.mutate({
        id: editingQuote.id,
        data: {
          text: formData.text,
          source: formData.source || undefined,
          year: formData.year || undefined,
          context_notes: formData.context_notes || undefined,
        },
      })
    } else {
      createMutation.mutate(formData)
    }
  }

  const handleEdit = (quote: Quote) => {
    setEditingQuote(quote)
    setFormData({
      thinker_id: quote.thinker_id,
      text: quote.text,
      source: quote.source || '',
      year: quote.year || undefined,
      context_notes: quote.context_notes || '',
    })
    setShowAddForm(true)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">Quote Library</h2>
            <p className="text-sm text-gray-500">{quotes.length} quotes from {Object.keys(quotesByThinker).length} thinkers</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setShowAddForm(true); setEditingQuote(null); resetForm(); }}
              className="px-3 py-1.5 text-sm bg-accent text-white rounded hover:bg-accent/90"
            >
              + Add Quote
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">
              &times;
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="px-4 py-3 border-b bg-gray-50 flex flex-wrap gap-3">
          <input
            type="text"
            placeholder="Search quotes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 min-w-[200px] px-3 py-1.5 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-accent"
          />
          <select
            value={filterThinker}
            onChange={(e) => setFilterThinker(e.target.value)}
            className="px-3 py-1.5 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-accent"
          >
            <option value="">All Thinkers</option>
            {thinkers.map((t: Thinker) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'date' | 'thinker' | 'source')}
            className="px-3 py-1.5 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-accent"
          >
            <option value="thinker">Sort by Thinker</option>
            <option value="date">Sort by Year</option>
            <option value="source">Sort by Source</option>
          </select>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {quotesLoading ? (
            <div className="text-center py-8 text-gray-500">Loading quotes...</div>
          ) : filteredQuotes.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p className="text-lg mb-2">No quotes found</p>
              <p className="text-sm">Add quotes to build your research library</p>
            </div>
          ) : sortBy === 'thinker' ? (
            // Grouped view by thinker
            <div className="space-y-6">
              {Object.entries(quotesByThinker).map(([thinkerId, thinkerQuotes]) => {
                const thinker = thinkerMap.get(thinkerId)
                return (
                  <div key={thinkerId} className="border rounded-lg overflow-hidden">
                    <div
                      className="bg-gray-100 px-4 py-2 flex items-center justify-between cursor-pointer hover:bg-gray-200"
                      onClick={() => thinker && onThinkerSelect?.(thinker.id)}
                    >
                      <div>
                        <span className="font-medium text-gray-800">{thinker?.name || 'Unknown'}</span>
                        {thinker?.birth_year && (
                          <span className="text-sm text-gray-500 ml-2">
                            ({thinker.birth_year}-{thinker.death_year || '?'})
                          </span>
                        )}
                      </div>
                      <span className="text-sm text-gray-500">{thinkerQuotes.length} quotes</span>
                    </div>
                    <div className="divide-y">
                      {thinkerQuotes.map((quote: Quote) => (
                        <QuoteCard
                          key={quote.id}
                          quote={quote}
                          thinker={thinker}
                          onEdit={() => handleEdit(quote)}
                          onDelete={() => {
                            if (confirm('Delete this quote?')) {
                              deleteMutation.mutate(quote.id)
                            }
                          }}
                          showThinker={false}
                        />
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            // Flat list view
            <div className="space-y-3">
              {filteredQuotes.map((quote: Quote) => {
                const thinker = thinkerMap.get(quote.thinker_id)
                return (
                  <QuoteCard
                    key={quote.id}
                    quote={quote}
                    thinker={thinker}
                    onEdit={() => handleEdit(quote)}
                    onDelete={() => {
                      if (confirm('Delete this quote?')) {
                        deleteMutation.mutate(quote.id)
                      }
                    }}
                    showThinker={true}
                    onThinkerClick={() => thinker && onThinkerSelect?.(thinker.id)}
                  />
                )
              })}
            </div>
          )}
        </div>

        {/* Add/Edit Form Modal */}
        {showAddForm && (
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
            <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-xl w-full max-w-lg p-4 m-4">
              <h3 className="text-lg font-semibold mb-4">
                {editingQuote ? 'Edit Quote' : 'Add New Quote'}
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Thinker *</label>
                  <select
                    value={formData.thinker_id}
                    onChange={(e) => setFormData({ ...formData, thinker_id: e.target.value })}
                    required
                    disabled={!!editingQuote}
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-accent disabled:bg-gray-100"
                  >
                    <option value="">Select a thinker...</option>
                    {thinkers.map((t: Thinker) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quote Text *</label>
                  <textarea
                    value={formData.text}
                    onChange={(e) => setFormData({ ...formData, text: e.target.value })}
                    required
                    rows={4}
                    placeholder="Enter the quote..."
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
                    <input
                      type="text"
                      value={formData.source || ''}
                      onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                      placeholder="Book, letter, etc."
                      className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-accent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                    <input
                      type="number"
                      value={formData.year || ''}
                      onChange={(e) => setFormData({ ...formData, year: e.target.value ? parseInt(e.target.value) : undefined })}
                      placeholder="e.g., 1781"
                      className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-accent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Context</label>
                  <textarea
                    value={formData.context_notes || ''}
                    onChange={(e) => setFormData({ ...formData, context_notes: e.target.value })}
                    rows={2}
                    placeholder="Historical context or notes about this quote..."
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <button
                  type="button"
                  onClick={() => { setShowAddForm(false); setEditingQuote(null); resetForm(); }}
                  className="px-4 py-2 text-sm border rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="px-4 py-2 text-sm bg-accent text-white rounded hover:bg-accent/90 disabled:opacity-50"
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? 'Saving...'
                    : editingQuote ? 'Update Quote' : 'Add Quote'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}

function QuoteCard({
  quote,
  thinker,
  onEdit,
  onDelete,
  showThinker,
  onThinkerClick,
}: {
  quote: Quote
  thinker?: Thinker
  onEdit: () => void
  onDelete: () => void
  showThinker: boolean
  onThinkerClick?: () => void
}) {
  return (
    <div className="p-4 hover:bg-gray-50">
      <div className="flex justify-between items-start gap-4">
        <div className="flex-1">
          <blockquote className="text-gray-800 italic mb-2">
            &ldquo;{quote.text}&rdquo;
          </blockquote>
          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500">
            {showThinker && thinker && (
              <button
                onClick={onThinkerClick}
                className="font-medium text-accent hover:underline"
              >
                {thinker.name}
              </button>
            )}
            {quote.year && (
              <span className="px-2 py-0.5 bg-gray-100 rounded text-xs">{quote.year}</span>
            )}
            {quote.source && (
              <span className="text-gray-400">from {quote.source}</span>
            )}
          </div>
          {quote.context_notes && (
            <p className="text-sm text-gray-500 mt-2 italic">{quote.context_notes}</p>
          )}
        </div>
        <div className="flex gap-1">
          <button
            onClick={onEdit}
            className="p-1 text-gray-400 hover:text-gray-600"
            title="Edit"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={onDelete}
            className="p-1 text-gray-400 hover:text-red-600"
            title="Delete"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
