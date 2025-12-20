'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { thinkersApi, connectionsApi, timelineEventsApi, timelinesApi, publicationsApi } from '@/lib/api'
import type { Thinker, Connection, TimelineEvent, Timeline, ConnectionType, Publication } from '@/types'

type TabType = 'thinkers' | 'connections' | 'events' | 'publications'

interface OverviewPanelProps {
  isOpen: boolean
  onClose: () => void
  onSelectThinker: (id: string) => void
  onEditConnection: (id: string) => void
  onEditEvent: (id: string) => void
}

const CONNECTION_TYPE_LABELS: Record<ConnectionType, string> = {
  influenced: 'Influenced',
  critiqued: 'Critiqued',
  built_upon: 'Built Upon',
  synthesized: 'Synthesized',
}

export function OverviewPanel({
  isOpen,
  onClose,
  onSelectThinker,
  onEditConnection,
  onEditEvent,
}: OverviewPanelProps) {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<TabType>('thinkers')
  const [filterTimelineId, setFilterTimelineId] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<{ type: TabType; id: string } | null>(null)

  // Fetch data
  const { data: thinkers = [] } = useQuery({
    queryKey: ['thinkers'],
    queryFn: () => thinkersApi.getAll(),
  })

  const { data: connections = [] } = useQuery({
    queryKey: ['connections'],
    queryFn: connectionsApi.getAll,
  })

  const { data: events = [] } = useQuery({
    queryKey: ['timeline-events'],
    queryFn: () => timelineEventsApi.getAll(),
  })

  const { data: timelines = [] } = useQuery({
    queryKey: ['timelines'],
    queryFn: timelinesApi.getAll,
  })

  const { data: publications = [] } = useQuery({
    queryKey: ['publications'],
    queryFn: () => publicationsApi.getAll(),
  })

  // Delete mutations
  const deleteThinkerMutation = useMutation({
    mutationFn: thinkersApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['thinkers'] })
      queryClient.invalidateQueries({ queryKey: ['connections'] })
      setConfirmDelete(null)
    },
  })

  const deleteConnectionMutation = useMutation({
    mutationFn: connectionsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connections'] })
      setConfirmDelete(null)
    },
  })

  const deleteEventMutation = useMutation({
    mutationFn: timelineEventsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeline-events'] })
      setConfirmDelete(null)
    },
  })

  const deletePublicationMutation = useMutation({
    mutationFn: publicationsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['publications'] })
      setConfirmDelete(null)
    },
  })

  // Create thinker lookup for connections
  const thinkerMap = useMemo(() => {
    const map = new Map<string, Thinker>()
    thinkers.forEach(t => map.set(t.id, t))
    return map
  }, [thinkers])

  // Create timeline lookup
  const timelineMap = useMemo(() => {
    const map = new Map<string, Timeline>()
    timelines.forEach(t => map.set(t.id, t))
    return map
  }, [timelines])

  // Filter data
  const filteredThinkers = useMemo(() => {
    let result = thinkers
    if (filterTimelineId) {
      result = result.filter(t => t.timeline_id === filterTimelineId)
    }
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      result = result.filter(t =>
        t.name.toLowerCase().includes(query) ||
        t.field?.toLowerCase().includes(query)
      )
    }
    return result.sort((a, b) => a.name.localeCompare(b.name))
  }, [thinkers, filterTimelineId, searchQuery])

  const filteredConnections = useMemo(() => {
    let result = connections
    if (filterTimelineId) {
      // Filter connections where either thinker is in the selected timeline
      result = result.filter(c => {
        const fromThinker = thinkerMap.get(c.from_thinker_id)
        const toThinker = thinkerMap.get(c.to_thinker_id)
        return fromThinker?.timeline_id === filterTimelineId || toThinker?.timeline_id === filterTimelineId
      })
    }
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      result = result.filter(c => {
        const fromThinker = thinkerMap.get(c.from_thinker_id)
        const toThinker = thinkerMap.get(c.to_thinker_id)
        return (
          fromThinker?.name.toLowerCase().includes(query) ||
          toThinker?.name.toLowerCase().includes(query) ||
          c.name?.toLowerCase().includes(query) ||
          c.notes?.toLowerCase().includes(query)
        )
      })
    }
    return result
  }, [connections, filterTimelineId, searchQuery, thinkerMap])

  const filteredEvents = useMemo(() => {
    let result = events
    if (filterTimelineId) {
      result = result.filter(e => e.timeline_id === filterTimelineId)
    }
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      result = result.filter(e =>
        e.name.toLowerCase().includes(query) ||
        e.description?.toLowerCase().includes(query)
      )
    }
    return result.sort((a, b) => a.year - b.year)
  }, [events, filterTimelineId, searchQuery])

  const filteredPublications = useMemo(() => {
    let result = publications
    if (filterTimelineId) {
      // Filter publications by thinker's timeline
      result = result.filter(p => {
        const thinker = thinkerMap.get(p.thinker_id)
        return thinker?.timeline_id === filterTimelineId
      })
    }
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      result = result.filter(p => {
        const thinker = thinkerMap.get(p.thinker_id)
        return (
          p.title.toLowerCase().includes(query) ||
          thinker?.name.toLowerCase().includes(query) ||
          p.journal?.toLowerCase().includes(query) ||
          p.publisher?.toLowerCase().includes(query)
        )
      })
    }
    return result.sort((a, b) => (b.year || 0) - (a.year || 0))
  }, [publications, filterTimelineId, searchQuery, thinkerMap])

  const handleDelete = (type: TabType, id: string) => {
    if (type === 'thinkers') {
      deleteThinkerMutation.mutate(id)
    } else if (type === 'connections') {
      deleteConnectionMutation.mutate(id)
    } else if (type === 'events') {
      deleteEventMutation.mutate(id)
    } else if (type === 'publications') {
      deletePublicationMutation.mutate(id)
    }
  }

  const formatYear = (year: number | null | undefined) => {
    if (year === null || year === undefined) return '—'
    if (year < 0) return `${Math.abs(year)} BCE`
    return `${year}`
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative bg-white rounded-lg shadow-2xl w-[90vw] max-w-5xl h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-serif font-semibold text-primary">Overview</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition"
            title="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          {(['thinkers', 'connections', 'events', 'publications'] as TabType[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 text-sm font-medium transition ${
                activeTab === tab
                  ? 'text-accent border-b-2 border-accent bg-amber-50'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              <span className="ml-2 px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                {tab === 'thinkers' ? filteredThinkers.length :
                 tab === 'connections' ? filteredConnections.length :
                 tab === 'events' ? filteredEvents.length :
                 filteredPublications.length}
              </span>
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4 px-6 py-3 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Timeline:</label>
            <select
              value={filterTimelineId}
              onChange={(e) => setFilterTimelineId(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="">All Timelines</option>
              {timelines.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 max-w-xs">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          {(filterTimelineId || searchQuery) && (
            <button
              onClick={() => {
                setFilterTimelineId('')
                setSearchQuery('')
              }}
              className="text-sm text-accent hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {/* Thinkers Table */}
          {activeTab === 'thinkers' && (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr className="text-left text-gray-600">
                  <th className="px-6 py-3 font-medium">Name</th>
                  <th className="px-6 py-3 font-medium">Birth</th>
                  <th className="px-6 py-3 font-medium">Death</th>
                  <th className="px-6 py-3 font-medium">Field</th>
                  <th className="px-6 py-3 font-medium">Timeline</th>
                  <th className="px-6 py-3 font-medium w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredThinkers.map((thinker) => (
                  <tr key={thinker.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3 font-medium text-primary">{thinker.name}</td>
                    <td className="px-6 py-3 text-gray-600">{formatYear(thinker.birth_year)}</td>
                    <td className="px-6 py-3 text-gray-600">{formatYear(thinker.death_year)}</td>
                    <td className="px-6 py-3 text-gray-600">{thinker.field || '—'}</td>
                    <td className="px-6 py-3 text-gray-600">
                      {thinker.timeline_id ? timelineMap.get(thinker.timeline_id)?.name || '—' : '—'}
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            onSelectThinker(thinker.id)
                            onClose()
                          }}
                          className="p-1.5 text-gray-500 hover:text-accent hover:bg-amber-50 rounded transition"
                          title="Edit"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setConfirmDelete({ type: 'thinkers', id: thinker.id })}
                          className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition"
                          title="Delete"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredThinkers.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      No thinkers found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          {/* Connections Table */}
          {activeTab === 'connections' && (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr className="text-left text-gray-600">
                  <th className="px-6 py-3 font-medium">From</th>
                  <th className="px-6 py-3 font-medium">Type</th>
                  <th className="px-6 py-3 font-medium">To</th>
                  <th className="px-6 py-3 font-medium">Name</th>
                  <th className="px-6 py-3 font-medium">Bidirectional</th>
                  <th className="px-6 py-3 font-medium w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredConnections.map((connection) => {
                  const fromThinker = thinkerMap.get(connection.from_thinker_id)
                  const toThinker = thinkerMap.get(connection.to_thinker_id)
                  return (
                    <tr key={connection.id} className="hover:bg-gray-50">
                      <td className="px-6 py-3">
                        <button
                          onClick={() => {
                            if (fromThinker) {
                              onSelectThinker(fromThinker.id)
                              onClose()
                            }
                          }}
                          className="text-primary hover:text-accent hover:underline"
                        >
                          {fromThinker?.name || 'Unknown'}
                        </button>
                      </td>
                      <td className="px-6 py-3">
                        <span className={`px-2 py-1 text-xs rounded ${
                          connection.connection_type === 'influenced' ? 'bg-blue-100 text-blue-700' :
                          connection.connection_type === 'critiqued' ? 'bg-red-100 text-red-700' :
                          connection.connection_type === 'built_upon' ? 'bg-green-100 text-green-700' :
                          'bg-purple-100 text-purple-700'
                        }`}>
                          {CONNECTION_TYPE_LABELS[connection.connection_type]}
                        </span>
                      </td>
                      <td className="px-6 py-3">
                        <button
                          onClick={() => {
                            if (toThinker) {
                              onSelectThinker(toThinker.id)
                              onClose()
                            }
                          }}
                          className="text-primary hover:text-accent hover:underline"
                        >
                          {toThinker?.name || 'Unknown'}
                        </button>
                      </td>
                      <td className="px-6 py-3 text-gray-600">{connection.name || '—'}</td>
                      <td className="px-6 py-3 text-gray-600">
                        {connection.bidirectional ? 'Yes' : 'No'}
                      </td>
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              onEditConnection(connection.id)
                              onClose()
                            }}
                            className="p-1.5 text-gray-500 hover:text-accent hover:bg-amber-50 rounded transition"
                            title="Edit"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => setConfirmDelete({ type: 'connections', id: connection.id })}
                            className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition"
                            title="Delete"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {filteredConnections.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      No connections found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          {/* Events Table */}
          {activeTab === 'events' && (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr className="text-left text-gray-600">
                  <th className="px-6 py-3 font-medium">Year</th>
                  <th className="px-6 py-3 font-medium">Name</th>
                  <th className="px-6 py-3 font-medium">Type</th>
                  <th className="px-6 py-3 font-medium">Timeline</th>
                  <th className="px-6 py-3 font-medium">Description</th>
                  <th className="px-6 py-3 font-medium w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredEvents.map((event) => (
                  <tr key={event.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3 font-mono text-gray-600">{formatYear(event.year)}</td>
                    <td className="px-6 py-3 font-medium text-primary">{event.name}</td>
                    <td className="px-6 py-3">
                      <span className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded capitalize">
                        {event.event_type}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-gray-600">
                      {timelineMap.get(event.timeline_id)?.name || '—'}
                    </td>
                    <td className="px-6 py-3 text-gray-600 max-w-xs truncate">
                      {event.description || '—'}
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            onEditEvent(event.id)
                            onClose()
                          }}
                          className="p-1.5 text-gray-500 hover:text-accent hover:bg-amber-50 rounded transition"
                          title="Edit"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setConfirmDelete({ type: 'events', id: event.id })}
                          className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition"
                          title="Delete"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredEvents.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      No events found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          {/* Publications Table */}
          {activeTab === 'publications' && (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr className="text-left text-gray-600">
                  <th className="px-6 py-3 font-medium">Year</th>
                  <th className="px-6 py-3 font-medium">Title</th>
                  <th className="px-6 py-3 font-medium">Author</th>
                  <th className="px-6 py-3 font-medium">Type</th>
                  <th className="px-6 py-3 font-medium">Publisher/Journal</th>
                  <th className="px-6 py-3 font-medium w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredPublications.map((publication) => {
                  const thinker = thinkerMap.get(publication.thinker_id)
                  return (
                    <tr key={publication.id} className="hover:bg-gray-50">
                      <td className="px-6 py-3 font-mono text-gray-600">{formatYear(publication.year)}</td>
                      <td className="px-6 py-3 font-medium text-primary max-w-xs truncate" title={publication.title}>
                        {publication.title}
                      </td>
                      <td className="px-6 py-3">
                        <button
                          onClick={() => {
                            if (thinker) {
                              onSelectThinker(thinker.id)
                              onClose()
                            }
                          }}
                          className="text-primary hover:text-accent hover:underline"
                        >
                          {thinker?.name || 'Unknown'}
                        </button>
                      </td>
                      <td className="px-6 py-3">
                        {publication.publication_type && (
                          <span className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded capitalize">
                            {publication.publication_type}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-3 text-gray-600 max-w-xs truncate">
                        {publication.journal || publication.publisher || '—'}
                      </td>
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              if (thinker) {
                                onSelectThinker(thinker.id)
                                onClose()
                              }
                            }}
                            className="p-1.5 text-gray-500 hover:text-accent hover:bg-amber-50 rounded transition"
                            title="View in thinker panel"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => setConfirmDelete({ type: 'publications', id: publication.id })}
                            className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition"
                            title="Delete"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {filteredPublications.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      No publications found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Delete Confirmation Modal */}
        {confirmDelete && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm mx-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Confirm Delete</h3>
              <p className="text-gray-600 mb-4">
                Are you sure you want to delete this {confirmDelete.type.slice(0, -1)}? This action cannot be undone.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setConfirmDelete(null)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded transition"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(confirmDelete.type, confirmDelete.id)}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
