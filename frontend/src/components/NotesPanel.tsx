'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { notesApi, thinkersApi } from '@/lib/api'
import type { Note, NoteWithMentions, NoteVersion, Thinker, NoteType } from '@/types'

interface NotesPanelProps {
  isOpen: boolean
  onClose: () => void
  selectedThinkerId?: string | null
  onThinkerSelect?: (thinkerId: string) => void
}

export function NotesPanel({ isOpen, onClose, selectedThinkerId, onThinkerSelect }: NotesPanelProps) {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<'all' | 'thinker' | 'create'>('all')
  const [editingNote, setEditingNote] = useState<NoteWithMentions | null>(null)
  const [showVersions, setShowVersions] = useState<string | null>(null)
  const [formData, setFormData] = useState<{
    title: string
    content: string
    note_type: NoteType
    thinker_id: string | null
  }>({
    title: '',
    content: '',
    note_type: 'research',
    thinker_id: null,
  })

  const { data: notes = [], isLoading: notesLoading } = useQuery({
    queryKey: ['notes', selectedThinkerId],
    queryFn: () => notesApi.getAll(selectedThinkerId || undefined),
    enabled: isOpen,
  })

  const { data: thinkers = [] } = useQuery({
    queryKey: ['thinkers'],
    queryFn: () => thinkersApi.getAll(),
    enabled: isOpen,
  })

  const { data: versions = [], isLoading: versionsLoading } = useQuery({
    queryKey: ['note-versions', showVersions],
    queryFn: () => notesApi.getVersions(showVersions!),
    enabled: !!showVersions,
  })

  const { data: backlinks = [] } = useQuery({
    queryKey: ['backlinks', selectedThinkerId],
    queryFn: () => notesApi.getBacklinks(selectedThinkerId!),
    enabled: !!selectedThinkerId && activeTab === 'thinker',
  })

  const createMutation = useMutation({
    mutationFn: notesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] })
      setFormData({ title: '', content: '', note_type: 'research', thinker_id: null })
      setActiveTab('all')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof notesApi.update>[1] }) =>
      notesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] })
      setEditingNote(null)
      setFormData({ title: '', content: '', note_type: 'research', thinker_id: null })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: notesApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] })
    },
  })

  const handleSubmit = () => {
    if (!formData.title || !formData.content) return

    if (editingNote) {
      updateMutation.mutate({
        id: editingNote.id,
        data: {
          title: formData.title,
          content: formData.content,
          note_type: formData.note_type,
        },
      })
    } else {
      createMutation.mutate({
        title: formData.title,
        content: formData.content,
        note_type: formData.note_type,
        thinker_id: formData.thinker_id,
      })
    }
  }

  const handleEdit = (note: NoteWithMentions) => {
    setEditingNote(note)
    setFormData({
      title: note.title || '',
      content: note.content,
      note_type: note.note_type || 'research',
      thinker_id: note.thinker_id || null,
    })
    setActiveTab('create')
  }

  const handleDelete = (id: string, title: string) => {
    if (confirm(`Are you sure you want to delete "${title}"?`)) {
      deleteMutation.mutate(id)
    }
  }

  const cancelEdit = () => {
    setEditingNote(null)
    setFormData({ title: '', content: '', note_type: 'research', thinker_id: null })
    setActiveTab('all')
  }

  if (!isOpen) return null

  const selectedThinker = selectedThinkerId
    ? thinkers.find((t: Thinker) => t.id === selectedThinkerId)
    : null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-timeline">
          <h2 className="text-xl font-serif font-semibold text-primary">Research Notes</h2>
          <button
            onClick={onClose}
            className="text-secondary hover:text-primary text-2xl leading-none"
          >
            &times;
          </button>
        </div>

        <div className="flex border-b border-timeline">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 text-sm font-sans ${
              activeTab === 'all'
                ? 'border-b-2 border-accent text-accent'
                : 'text-secondary hover:text-primary'
            }`}
          >
            All Notes
          </button>
          {selectedThinkerId && (
            <button
              onClick={() => setActiveTab('thinker')}
              className={`px-4 py-2 text-sm font-sans ${
                activeTab === 'thinker'
                  ? 'border-b-2 border-accent text-accent'
                  : 'text-secondary hover:text-primary'
              }`}
            >
              {selectedThinker?.name || 'Thinker'} Notes & Backlinks
            </button>
          )}
          <button
            onClick={() => setActiveTab('create')}
            className={`px-4 py-2 text-sm font-sans ${
              activeTab === 'create'
                ? 'border-b-2 border-accent text-accent'
                : 'text-secondary hover:text-primary'
            }`}
          >
            {editingNote ? 'Edit Note' : '+ New Note'}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'all' && (
            <div className="space-y-4">
              {notesLoading ? (
                <p className="text-secondary">Loading notes...</p>
              ) : notes.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-secondary mb-4">No notes yet</p>
                  <button
                    onClick={() => setActiveTab('create')}
                    className="px-4 py-2 bg-accent text-white rounded font-sans text-sm hover:bg-opacity-90"
                  >
                    Create Your First Note
                  </button>
                </div>
              ) : (
                notes.map((note: Note) => (
                  <NoteCard
                    key={note.id}
                    note={note}
                    onEdit={() => notesApi.getOne(note.id).then(handleEdit)}
                    onDelete={() => handleDelete(note.id, note.title || 'Untitled')}
                    onShowVersions={() => setShowVersions(note.id)}
                    onThinkerSelect={onThinkerSelect}
                    thinkers={thinkers}
                  />
                ))
              )}
            </div>
          )}

          {activeTab === 'thinker' && selectedThinkerId && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-sans font-medium text-secondary mb-3">
                  Notes about {selectedThinker?.name}
                </h3>
                <div className="space-y-4">
                  {notes.filter((n: Note) => n.thinker_id === selectedThinkerId).length === 0 ? (
                    <p className="text-sm text-secondary italic">No notes specifically about this thinker</p>
                  ) : (
                    notes
                      .filter((n: Note) => n.thinker_id === selectedThinkerId)
                      .map((note: Note) => (
                        <NoteCard
                          key={note.id}
                          note={note}
                          onEdit={() => notesApi.getOne(note.id).then(handleEdit)}
                          onDelete={() => handleDelete(note.id, note.title || 'Untitled')}
                          onShowVersions={() => setShowVersions(note.id)}
                          onThinkerSelect={onThinkerSelect}
                          thinkers={thinkers}
                        />
                      ))
                  )}
                </div>
              </div>

              <div className="border-t border-timeline pt-4">
                <h3 className="text-sm font-sans font-medium text-secondary mb-3">
                  Notes mentioning {selectedThinker?.name} (Backlinks)
                </h3>
                <div className="space-y-4">
                  {backlinks.length === 0 ? (
                    <p className="text-sm text-secondary italic">
                      No notes mention this thinker. Use [[{selectedThinker?.name}]] in your notes to create links.
                    </p>
                  ) : (
                    backlinks.map((note: Note) => (
                      <NoteCard
                        key={note.id}
                        note={note}
                        onEdit={() => notesApi.getOne(note.id).then(handleEdit)}
                        onDelete={() => handleDelete(note.id, note.title || 'Untitled')}
                        onShowVersions={() => setShowVersions(note.id)}
                        onThinkerSelect={onThinkerSelect}
                        thinkers={thinkers}
                        isBacklink
                      />
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'create' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-sans font-medium text-secondary mb-1">
                  TITLE *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 border border-timeline rounded font-serif focus:outline-none focus:ring-2 focus:ring-accent"
                  placeholder="Note title"
                />
              </div>

              <div>
                <label className="block text-xs font-sans font-medium text-secondary mb-1">
                  CONTENT * (Use [[Thinker Name]] to create links)
                </label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  rows={10}
                  className="w-full px-3 py-2 border border-timeline rounded font-serif focus:outline-none focus:ring-2 focus:ring-accent"
                  placeholder="Write your note here. Use [[Thinker Name]] to link to thinkers..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-sans font-medium text-secondary mb-1">
                    NOTE TYPE
                  </label>
                  <select
                    value={formData.note_type}
                    onChange={(e) => setFormData({ ...formData, note_type: e.target.value as NoteType })}
                    className="w-full px-3 py-2 border border-timeline rounded font-sans focus:outline-none focus:ring-2 focus:ring-accent"
                  >
                    <option value="general">General</option>
                    <option value="research">Research</option>
                    <option value="biography">Biography</option>
                    <option value="connection">Connection</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-sans font-medium text-secondary mb-1">
                    ASSOCIATED THINKER (Optional)
                  </label>
                  <select
                    value={formData.thinker_id || ''}
                    onChange={(e) => setFormData({ ...formData, thinker_id: e.target.value || null })}
                    className="w-full px-3 py-2 border border-timeline rounded font-sans focus:outline-none focus:ring-2 focus:ring-accent"
                  >
                    <option value="">None</option>
                    {thinkers.map((t: Thinker) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                {editingNote && (
                  <button
                    onClick={cancelEdit}
                    className="px-4 py-2 border border-timeline rounded font-sans text-sm hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                )}
                <button
                  onClick={handleSubmit}
                  disabled={!formData.title || !formData.content || createMutation.isPending || updateMutation.isPending}
                  className="px-4 py-2 bg-accent text-white rounded font-sans text-sm hover:bg-opacity-90 disabled:opacity-50"
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? 'Saving...'
                    : editingNote
                    ? 'Update Note'
                    : 'Create Note'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Version History Modal */}
        {showVersions && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-60">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
              <div className="flex items-center justify-between px-6 py-4 border-b border-timeline">
                <h3 className="text-lg font-serif font-semibold text-primary">Version History</h3>
                <button
                  onClick={() => setShowVersions(null)}
                  className="text-secondary hover:text-primary text-2xl leading-none"
                >
                  &times;
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6">
                {versionsLoading ? (
                  <p className="text-secondary">Loading versions...</p>
                ) : versions.length === 0 ? (
                  <p className="text-secondary italic">No previous versions</p>
                ) : (
                  <div className="space-y-4">
                    {versions.map((version: NoteVersion) => (
                      <div key={version.id} className="border border-timeline rounded p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-sans font-medium text-secondary">
                            Version {version.version_number}
                          </span>
                          <span className="text-xs text-gray-500">
                            {new Date(version.created_at).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm font-serif text-primary whitespace-pre-wrap">
                          {version.content}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

interface NoteCardProps {
  note: Note
  onEdit: () => void
  onDelete: () => void
  onShowVersions: () => void
  onThinkerSelect?: (thinkerId: string) => void
  thinkers: Thinker[]
  isBacklink?: boolean
}

function NoteCard({ note, onEdit, onDelete, onShowVersions, onThinkerSelect, thinkers, isBacklink }: NoteCardProps) {
  const associatedThinker = note.thinker_id
    ? thinkers.find((t: Thinker) => t.id === note.thinker_id)
    : null

  const noteTypeColors: Record<string, string> = {
    general: 'bg-gray-100 text-gray-800',
    research: 'bg-blue-100 text-blue-800',
    biography: 'bg-green-100 text-green-800',
    connection: 'bg-orange-100 text-orange-800',
  }

  // Parse wiki links in content for display
  const renderContent = (content: string) => {
    const parts = content.split(/(\[\[[^\]]+\]\])/g)
    return parts.map((part, i) => {
      const match = part.match(/\[\[([^\]]+)\]\]/)
      if (match) {
        const thinkerName = match[1]
        const thinker = thinkers.find((t: Thinker) =>
          t.name.toLowerCase() === thinkerName.toLowerCase()
        )
        if (thinker && onThinkerSelect) {
          return (
            <button
              key={i}
              onClick={() => onThinkerSelect(thinker.id)}
              className="text-accent hover:underline font-medium"
            >
              {thinkerName}
            </button>
          )
        }
        return <span key={i} className="text-accent">{thinkerName}</span>
      }
      return <span key={i}>{part}</span>
    })
  }

  return (
    <div className={`border rounded-lg p-4 ${isBacklink ? 'border-purple-200 bg-purple-50/50' : 'border-timeline'}`}>
      <div className="flex items-start justify-between mb-2">
        <div>
          <h4 className="font-serif font-medium text-primary">{note.title || 'Untitled'}</h4>
          <div className="flex items-center gap-2 mt-1">
            {note.note_type && (
              <span className={`px-2 py-0.5 rounded text-xs font-sans ${noteTypeColors[note.note_type] || 'bg-gray-100 text-gray-800'}`}>
                {note.note_type}
              </span>
            )}
            {associatedThinker && (
              <button
                onClick={() => onThinkerSelect?.(associatedThinker.id)}
                className="text-xs text-accent hover:underline"
              >
                {associatedThinker.name}
              </button>
            )}
            {isBacklink && (
              <span className="px-2 py-0.5 rounded text-xs font-sans bg-purple-200 text-purple-800">
                Backlink
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-1">
          <button
            onClick={onShowVersions}
            className="px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 rounded"
            title="View history"
          >
            History
          </button>
          <button
            onClick={onEdit}
            className="px-2 py-1 text-xs text-accent hover:bg-gray-100 rounded"
          >
            Edit
          </button>
          <button
            onClick={onDelete}
            className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded"
          >
            Delete
          </button>
        </div>
      </div>
      <p className="text-sm font-serif text-primary whitespace-pre-wrap line-clamp-4">
        {renderContent(note.content)}
      </p>
      <p className="text-xs text-gray-500 mt-2">
        Updated {new Date(note.updated_at).toLocaleDateString()}
      </p>
    </div>
  )
}
