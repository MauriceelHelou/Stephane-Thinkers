'use client'

import { useState, useEffect } from 'react'
import { Modal, ModalFooter, ModalButton } from './Modal'

export interface SavedView {
  id: string
  name: string
  scale: number
  offsetX: number
  offsetY: number
  filterByTimelineId?: string | null
  filterByTagIds?: string[]
  filterByField?: string
  filterByYearStart?: number | null
  filterByYearEnd?: number | null
  createdAt: string
}

interface SavedViewsProps {
  currentView: {
    scale: number
    offsetX: number
    offsetY: number
    filterByTimelineId?: string | null
    filterByTagIds?: string[]
    filterByField?: string
    filterByYearStart?: number | null
    filterByYearEnd?: number | null
  }
  onLoadView: (view: SavedView) => void
}

const STORAGE_KEY = 'intellectual-genealogy-saved-views'

export function SavedViews({ currentView, onLoadView }: SavedViewsProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [views, setViews] = useState<SavedView[]>([])
  const [newViewName, setNewViewName] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  // Load views from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        setViews(JSON.parse(stored))
      } catch (e) {
        console.error('Failed to load saved views:', e)
      }
    }
  }, [])

  // Save views to localStorage
  const saveViews = (newViews: SavedView[]) => {
    setViews(newViews)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newViews))
  }

  const handleSaveView = () => {
    if (!newViewName.trim()) return

    const newView: SavedView = {
      id: Date.now().toString(),
      name: newViewName.trim(),
      scale: currentView.scale,
      offsetX: currentView.offsetX,
      offsetY: currentView.offsetY,
      filterByTimelineId: currentView.filterByTimelineId,
      filterByTagIds: currentView.filterByTagIds,
      filterByField: currentView.filterByField,
      filterByYearStart: currentView.filterByYearStart,
      filterByYearEnd: currentView.filterByYearEnd,
      createdAt: new Date().toISOString(),
    }

    saveViews([...views, newView])
    setNewViewName('')
    setIsSaving(false)
  }

  const handleDeleteView = (id: string) => {
    if (confirm('Delete this saved view?')) {
      saveViews(views.filter(v => v.id !== id))
    }
  }

  const handleLoadView = (view: SavedView) => {
    onLoadView(view)
    setIsOpen(false)
  }

  // Generate shareable URL for a view
  const getShareableUrl = (view: SavedView) => {
    const params = new URLSearchParams()
    params.set('scale', view.scale.toString())
    params.set('offsetX', view.offsetX.toString())
    params.set('offsetY', view.offsetY.toString())
    if (view.filterByTimelineId) params.set('timeline', view.filterByTimelineId)
    if (view.filterByField) params.set('field', view.filterByField)
    if (view.filterByYearStart) params.set('yearStart', view.filterByYearStart.toString())
    if (view.filterByYearEnd) params.set('yearEnd', view.filterByYearEnd.toString())
    if (view.filterByTagIds?.length) params.set('tags', view.filterByTagIds.join(','))

    return `${window.location.origin}${window.location.pathname}?${params.toString()}`
  }

  const copyShareableUrl = (view: SavedView) => {
    const url = getShareableUrl(view)
    navigator.clipboard.writeText(url)
    alert('URL copied to clipboard!')
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="px-3 py-2 bg-white border border-timeline rounded shadow-sm hover:bg-gray-50 font-sans text-sm flex items-center gap-1"
        title="Saved Views"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
        </svg>
        Views
      </button>

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Saved Views" maxWidth="md">
        <div className="p-4 space-y-4">
          {/* Save current view */}
          {!isSaving ? (
            <button
              onClick={() => setIsSaving(true)}
              className="w-full px-3 py-2 border border-dashed border-gray-300 rounded-lg text-sm text-gray-600 hover:border-accent hover:text-accent transition-colors"
            >
              + Save Current View
            </button>
          ) : (
            <div className="flex gap-2">
              <input
                type="text"
                value={newViewName}
                onChange={(e) => setNewViewName(e.target.value)}
                placeholder="View name (e.g., Medieval Philosophers)"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveView()
                  if (e.key === 'Escape') {
                    setIsSaving(false)
                    setNewViewName('')
                  }
                }}
              />
              <button
                onClick={handleSaveView}
                disabled={!newViewName.trim()}
                className="px-3 py-2 bg-accent text-white rounded-lg text-sm hover:bg-opacity-90 disabled:opacity-50"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setIsSaving(false)
                  setNewViewName('')
                }}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          )}

          {/* Saved views list */}
          {views.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <svg className="w-12 h-12 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
              <p className="text-sm">No saved views yet</p>
              <p className="text-xs text-gray-400">Save your current view to quickly return to it later</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {views.map((view) => (
                <div
                  key={view.id}
                  className="flex items-center gap-2 p-3 border border-gray-200 rounded-lg hover:border-accent transition-colors"
                >
                  <button
                    onClick={() => handleLoadView(view)}
                    className="flex-1 text-left"
                  >
                    <div className="font-medium text-sm text-gray-900">{view.name}</div>
                    <div className="text-xs text-gray-500">
                      Zoom: {Math.round(view.scale * 100)}%
                      {view.filterByField && ` • Field: ${view.filterByField}`}
                      {view.filterByYearStart && ` • From: ${view.filterByYearStart}`}
                      {view.filterByYearEnd && ` • To: ${view.filterByYearEnd}`}
                    </div>
                  </button>

                  <button
                    onClick={() => copyShareableUrl(view)}
                    className="p-1 text-gray-400 hover:text-accent"
                    title="Copy shareable URL"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
                    </svg>
                  </button>

                  <button
                    onClick={() => handleDeleteView(view.id)}
                    className="p-1 text-gray-400 hover:text-red-500"
                    title="Delete view"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </>
  )
}

// Hook to load view from URL parameters
export function useViewFromUrl() {
  const [initialView, setInitialView] = useState<Partial<SavedView> | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)

    const scale = params.get('scale')
    const offsetX = params.get('offsetX')
    const offsetY = params.get('offsetY')

    if (scale || offsetX || offsetY) {
      setInitialView({
        scale: scale ? parseFloat(scale) : 1,
        offsetX: offsetX ? parseFloat(offsetX) : 0,
        offsetY: offsetY ? parseFloat(offsetY) : 0,
        filterByTimelineId: params.get('timeline') || undefined,
        filterByField: params.get('field') || undefined,
        filterByYearStart: params.get('yearStart') ? parseInt(params.get('yearStart')!) : undefined,
        filterByYearEnd: params.get('yearEnd') ? parseInt(params.get('yearEnd')!) : undefined,
        filterByTagIds: params.get('tags')?.split(',').filter(Boolean) || undefined,
      })

      // Clear URL parameters after loading
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  return initialView
}
