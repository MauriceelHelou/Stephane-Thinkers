'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { thinkersApi, tagsApi, timelinesApi } from '@/lib/api'
import type { Tag, Timeline } from '@/types'

interface BulkActionsBarProps {
  selectedIds: string[]
  onClearSelection: () => void
  onClose: () => void
}

export function BulkActionsBar({ selectedIds, onClearSelection, onClose }: BulkActionsBarProps) {
  const queryClient = useQueryClient()
  const [showTagDropdown, setShowTagDropdown] = useState(false)
  const [showTimelineDropdown, setShowTimelineDropdown] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  const { data: tags = [] } = useQuery({
    queryKey: ['tags'],
    queryFn: tagsApi.getAll,
  })

  const { data: timelines = [] } = useQuery({
    queryKey: ['timelines'],
    queryFn: timelinesApi.getAll,
  })

  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      for (const id of ids) {
        await thinkersApi.delete(id)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['thinkers'] })
      queryClient.invalidateQueries({ queryKey: ['connections'] })
      onClearSelection()
      onClose()
    },
  })

  const assignTagMutation = useMutation({
    mutationFn: async ({ ids, tagId }: { ids: string[]; tagId: string }) => {
      for (const id of ids) {
        // Get current thinker to get existing tags
        const thinker = await thinkersApi.getOne(id)
        const currentTagIds = thinker.tags?.map((t: Tag) => t.id) || []
        if (!currentTagIds.includes(tagId)) {
          await thinkersApi.update(id, { tag_ids: [...currentTagIds, tagId] })
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['thinkers'] })
      setShowTagDropdown(false)
    },
  })

  const removeTagMutation = useMutation({
    mutationFn: async ({ ids, tagId }: { ids: string[]; tagId: string }) => {
      for (const id of ids) {
        const thinker = await thinkersApi.getOne(id)
        const currentTagIds = thinker.tags?.map((t: Tag) => t.id) || []
        await thinkersApi.update(id, { tag_ids: currentTagIds.filter((tid: string) => tid !== tagId) })
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['thinkers'] })
      setShowTagDropdown(false)
    },
  })

  const moveToTimelineMutation = useMutation({
    mutationFn: async ({ ids, timelineId }: { ids: string[]; timelineId: string | null }) => {
      for (const id of ids) {
        await thinkersApi.update(id, { timeline_id: timelineId })
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['thinkers'] })
      setShowTimelineDropdown(false)
    },
  })

  const handleDelete = async () => {
    if (confirm(`Are you sure you want to delete ${selectedIds.length} thinker${selectedIds.length > 1 ? 's' : ''}? This action cannot be undone.`)) {
      setIsProcessing(true)
      try {
        await deleteMutation.mutateAsync(selectedIds)
      } finally {
        setIsProcessing(false)
      }
    }
  }

  const handleAssignTag = async (tagId: string) => {
    setIsProcessing(true)
    try {
      await assignTagMutation.mutateAsync({ ids: selectedIds, tagId })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleRemoveTag = async (tagId: string) => {
    setIsProcessing(true)
    try {
      await removeTagMutation.mutateAsync({ ids: selectedIds, tagId })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleMoveToTimeline = async (timelineId: string | null) => {
    setIsProcessing(true)
    try {
      await moveToTimelineMutation.mutateAsync({ ids: selectedIds, timelineId })
    } finally {
      setIsProcessing(false)
    }
  }

  if (selectedIds.length === 0) return null

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-white border border-timeline rounded-lg shadow-lg px-4 py-3 flex items-center gap-4 z-50">
      <div className="flex items-center gap-2">
        <span className="font-sans text-sm font-medium text-primary">
          {selectedIds.length} selected
        </span>
        <button
          onClick={onClearSelection}
          className="text-gray-400 hover:text-gray-600"
          title="Clear selection"
        >
          x
        </button>
      </div>

      <div className="h-6 border-l border-timeline" />

      {/* Tag Actions */}
      <div className="relative">
        <button
          onClick={() => {
            setShowTagDropdown(!showTagDropdown)
            setShowTimelineDropdown(false)
          }}
          disabled={isProcessing}
          className="px-3 py-1.5 font-sans text-xs border border-timeline rounded hover:bg-gray-50 disabled:opacity-50"
        >
          Tags
        </button>
        {showTagDropdown && (
          <div className="absolute bottom-full left-0 mb-1 bg-white border border-timeline rounded shadow-lg min-w-[200px]">
            <div className="px-3 py-2 border-b border-timeline">
              <span className="text-xs font-sans font-medium text-secondary">Add Tag</span>
            </div>
            <div className="max-h-32 overflow-y-auto">
              {tags.length === 0 ? (
                <p className="px-3 py-2 text-xs text-gray-500 italic">No tags available</p>
              ) : (
                tags.map((tag: Tag) => (
                  <button
                    key={tag.id}
                    onClick={() => handleAssignTag(tag.id)}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-left"
                  >
                    <span
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: tag.color || '#64748b' }}
                    />
                    <span className="text-sm font-serif">{tag.name}</span>
                  </button>
                ))
              )}
            </div>
            <div className="px-3 py-2 border-t border-timeline">
              <span className="text-xs font-sans font-medium text-secondary">Remove Tag</span>
            </div>
            <div className="max-h-32 overflow-y-auto">
              {tags.map((tag: Tag) => (
                <button
                  key={`remove-${tag.id}`}
                  onClick={() => handleRemoveTag(tag.id)}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-red-50 text-left"
                >
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: tag.color || '#64748b' }}
                  />
                  <span className="text-sm font-serif text-red-600">Remove {tag.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Timeline Actions */}
      <div className="relative">
        <button
          onClick={() => {
            setShowTimelineDropdown(!showTimelineDropdown)
            setShowTagDropdown(false)
          }}
          disabled={isProcessing}
          className="px-3 py-1.5 font-sans text-xs border border-timeline rounded hover:bg-gray-50 disabled:opacity-50"
        >
          Move to Timeline
        </button>
        {showTimelineDropdown && (
          <div className="absolute bottom-full left-0 mb-1 bg-white border border-timeline rounded shadow-lg min-w-[200px]">
            <div className="px-3 py-2 border-b border-timeline">
              <span className="text-xs font-sans font-medium text-secondary">Select Timeline</span>
            </div>
            <div className="max-h-48 overflow-y-auto">
              <button
                onClick={() => handleMoveToTimeline(null)}
                className="w-full px-3 py-2 hover:bg-gray-50 text-left text-sm font-sans text-gray-500"
              >
                No Timeline (Unassigned)
              </button>
              {timelines.map((timeline: Timeline) => (
                <button
                  key={timeline.id}
                  onClick={() => handleMoveToTimeline(timeline.id)}
                  className="w-full px-3 py-2 hover:bg-gray-50 text-left text-sm font-sans"
                >
                  {timeline.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Delete Action */}
      <button
        onClick={handleDelete}
        disabled={isProcessing}
        className="px-3 py-1.5 font-sans text-xs border border-red-300 text-red-600 rounded hover:bg-red-50 disabled:opacity-50"
      >
        Delete
      </button>

      {isProcessing && (
        <span className="text-xs text-gray-500 font-sans">Processing...</span>
      )}
    </div>
  )
}
