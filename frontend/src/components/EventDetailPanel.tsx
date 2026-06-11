'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { timelineEventsApi, timelinesApi } from '@/lib/api'
import type { TimelineEventUpdate, Timeline } from '@/types'

interface EventDetailPanelProps {
  eventId: string | null
  onClose: () => void
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  council: '△ Council',
  publication: '▢ Publication',
  war: '◇ War',
  invention: '★ Invention',
  cultural: '● Cultural',
  political: '● Political',
  other: '● Other',
}

export function EventDetailPanel({ eventId, onClose }: EventDetailPanelProps) {
  const queryClient = useQueryClient()
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState<TimelineEventUpdate>({})

  const { data: event, isLoading, isError } = useQuery({
    queryKey: ['timeline-event', eventId],
    queryFn: () => timelineEventsApi.getOne(eventId!),
    enabled: !!eventId,
  })

  const { data: timelines = [] } = useQuery({
    queryKey: ['timelines'],
    queryFn: timelinesApi.getAll,
  })

  useEffect(() => {
    if (event) {
      setFormData({
        name: event.name,
        year: event.year,
        end_year: event.end_year ?? null,
        event_type: event.event_type,
        description: event.description ?? null,
        timeline_id: event.timeline_id,
      })
    }
  }, [event])

  // Reset edit mode when event changes
  useEffect(() => {
    setIsEditing(false)
  }, [eventId])

  const updateMutation = useMutation({
    mutationFn: (data: TimelineEventUpdate) => timelineEventsApi.update(eventId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeline-events'] })
      queryClient.invalidateQueries({ queryKey: ['timeline-event', eventId] })
      queryClient.invalidateQueries({ queryKey: ['combined-view-events'] })
      setIsEditing(false)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => timelineEventsApi.delete(eventId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeline-events'] })
      queryClient.invalidateQueries({ queryKey: ['combined-view-events'] })
      onClose()
    },
  })

  const handleSave = () => {
    if (!formData.name || formData.year == null) return
    updateMutation.mutate(formData)
  }

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this event? This action cannot be undone.')) {
      deleteMutation.mutate()
    }
  }

  const handleYearInput = (field: 'year' | 'end_year', raw: string, emptyValue: number | null) => {
    if (raw === '' || raw === '-' || /^-?\d+$/.test(raw)) {
      setFormData(prev => ({
        ...prev,
        [field]: raw === '' || raw === '-' ? emptyValue : parseInt(raw),
      }))
    }
  }

  if (!eventId) return null

  const timelineName = event
    ? timelines.find((t: Timeline) => t.id === event.timeline_id)?.name
    : null

  return (
    <aside
      className={`fixed right-0 top-0 h-full w-full sm:w-96 bg-white shadow-2xl transform transition-transform duration-300 z-40 ${
        eventId ? 'translate-x-0' : 'translate-x-full'
      }`}
      role="complementary"
      aria-label="Event details panel"
    >
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-timeline">
          <h2 className="text-xl font-serif font-semibold text-primary">Timeline Event</h2>
          <button
            onClick={onClose}
            className="text-secondary hover:text-primary text-2xl leading-none w-8 h-8 flex items-center justify-center rounded focus:outline-none focus:ring-2 focus:ring-accent"
            aria-label="Close event panel"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center flex-1">
            <p className="text-secondary">Loading...</p>
          </div>
        ) : isError ? (
          <div className="flex items-center justify-center flex-1">
            <p className="text-red-500 text-sm">Failed to load event details.</p>
          </div>
        ) : event ? (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div>
              <label className="block text-xs font-sans font-medium text-secondary mb-1">NAME</label>
              {isEditing ? (
                <input
                  type="text"
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-timeline rounded font-serif text-lg focus:outline-none focus:ring-2 focus:ring-accent"
                />
              ) : (
                <p className="font-serif text-lg text-primary">{event.name}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-sans font-medium text-secondary mb-1">TIMELINE</label>
              {isEditing ? (
                <select
                  value={formData.timeline_id || ''}
                  onChange={(e) => setFormData({ ...formData, timeline_id: e.target.value })}
                  className="w-full px-3 py-2 border border-timeline rounded font-serif focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  {timelines.map((t: Timeline) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              ) : (
                <p className="font-serif text-primary">{timelineName || '—'}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-sans font-medium text-secondary mb-1">YEAR</label>
                {isEditing ? (
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formData.year ?? ''}
                    onChange={(e) => handleYearInput('year', e.target.value, 0)}
                    className="w-full px-3 py-2 border border-timeline rounded font-mono focus:outline-none focus:ring-2 focus:ring-accent"
                    placeholder="-500 or 1545"
                  />
                ) : (
                  <p className="font-mono text-primary">
                    {event.year < 0 ? `${Math.abs(event.year)} BCE` : event.year}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-sans font-medium text-secondary mb-1">END YEAR</label>
                {isEditing ? (
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formData.end_year ?? ''}
                    onChange={(e) => handleYearInput('end_year', e.target.value, null)}
                    className="w-full px-3 py-2 border border-timeline rounded font-mono focus:outline-none focus:ring-2 focus:ring-accent"
                    placeholder="optional"
                  />
                ) : (
                  <p className="font-mono text-primary">
                    {event.end_year != null
                      ? (event.end_year < 0 ? `${Math.abs(event.end_year)} BCE` : event.end_year)
                      : '—'}
                  </p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-sans font-medium text-secondary mb-1">EVENT TYPE</label>
              {isEditing ? (
                <select
                  value={formData.event_type || ''}
                  onChange={(e) => setFormData({ ...formData, event_type: e.target.value })}
                  className="w-full px-3 py-2 border border-timeline rounded font-serif focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  <option value="council">△ Council</option>
                  <option value="publication">▢ Publication</option>
                  <option value="war">◇ War</option>
                  <option value="invention">★ Invention</option>
                  <option value="cultural">● Cultural</option>
                  <option value="political">● Political</option>
                  <option value="other">● Other</option>
                </select>
              ) : (
                <p className="font-serif text-primary">
                  {EVENT_TYPE_LABELS[event.event_type] || event.event_type}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-sans font-medium text-secondary mb-1">DESCRIPTION</label>
              {isEditing ? (
                <textarea
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value || null })}
                  rows={5}
                  className="w-full px-3 py-2 border border-timeline rounded font-serif focus:outline-none focus:ring-2 focus:ring-accent"
                  placeholder="Brief description of this historical event..."
                />
              ) : (
                <p className="font-serif text-primary whitespace-pre-wrap">
                  {event.description || '—'}
                </p>
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
                  if (event) {
                    setFormData({
                      name: event.name,
                      year: event.year,
                      end_year: event.end_year ?? null,
                      event_type: event.event_type,
                      description: event.description ?? null,
                      timeline_id: event.timeline_id,
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
    </aside>
  )
}
