'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import type { DragStartEvent, DragEndEvent } from '@dnd-kit/core'

import { Group, Panel, usePanelRef } from 'react-resizable-panels'

import { analysisApi, criticalTermsApi, foldersApi, notesApi } from '@/lib/api'
import { notesAiFlags } from '@/lib/notesAiFlags'
import type { CriticalTermWithCount, FolderWithChildren, NoteCreate, NoteUpdate, Tag, ThinkerDetectionResult } from '@/types'
import { LoginScreen } from '@/components/LoginScreen'

import { NotesList } from '@/components/notes/NotesList'
import { RichTextEditor } from '@/components/notes/RichTextEditor'
import { FolderTree } from '@/components/notes/FolderTree'
import { CriticalTermsList } from '@/components/notes/CriticalTermsList'
import { FlagTermDialog } from '@/components/notes/FlagTermDialog'
import TermDefinitionPanel from '@/components/notes/TermDefinitionPanel'
import ConstellationChart from '@/components/notes/ConstellationChart'
import { ConnectionSuggestionsPanel } from '@/components/notes/ConnectionSuggestionsPanel'
import { ResizeHandle } from '@/components/notes/ResizeHandle'
import { SemanticSearchPanel } from '@/components/notes/SemanticSearchPanel'
import { ResearchSprintPlanner } from '@/components/notes/ResearchSprintPlanner'
import { AdvisorBriefPanel } from '@/components/notes/AdvisorBriefPanel'
import { VivaPracticePanel } from '@/components/notes/VivaPracticePanel'
import { WeeklyDigestPanel } from '@/components/notes/WeeklyDigestPanel'
import { AiIngestionPanel } from '@/components/notes/AiIngestionPanel'
import { AiUsageMeter } from '@/components/notes/AiUsageMeter'
import { NoteTagSelector } from '@/components/notes/NoteTagSelector'

type RightPanelMode =
  | 'none'
  | 'definition'
  | 'constellation'
  | 'connections'
  | 'discovery'
  | 'planning'
  | 'ingestion'

interface ActiveDrag {
  type: 'folder' | 'note'
  id: string
  name: string
}

function isFolderDescendant(
  folders: FolderWithChildren[],
  ancestorId: string,
  candidateDescendantId: string
): boolean {
  const findNode = (nodes: FolderWithChildren[], id: string): FolderWithChildren | null => {
    for (const node of nodes) {
      if (node.id === id) return node
      const childMatch = findNode(node.children, id)
      if (childMatch) return childMatch
    }
    return null
  }

  const containsId = (node: FolderWithChildren, id: string): boolean => {
    for (const child of node.children) {
      if (child.id === id || containsId(child, id)) return true
    }
    return false
  }

  const ancestorNode = findNode(folders, ancestorId)
  if (!ancestorNode) return false
  return containsId(ancestorNode, candidateDescendantId)
}

const LAYOUT_STORAGE_KEY = 'notes-panels-v1'

export default function NotesPage() {
  const queryClient = useQueryClient()

  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null)
  const [rightPanelMode, setRightPanelMode] = useState<RightPanelMode>('none')
  const [rightPanelOpen, setRightPanelOpen] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [focusModeEnabled, setFocusModeEnabled] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved')
  const [selectedTermId, setSelectedTermId] = useState<string | null>(null)
  const [selectedDefinitionThinkerId, setSelectedDefinitionThinkerId] = useState<string | null>(null)
  const [isFlagTermDialogOpen, setIsFlagTermDialogOpen] = useState(false)
  const [flagTermInitialText, setFlagTermInitialText] = useState('')
  const [lastDetection, setLastDetection] = useState<ThinkerDetectionResult | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [activeDrag, setActiveDrag] = useState<ActiveDrag | null>(null)
  const [selectedTagFilterIds, setSelectedTagFilterIds] = useState<string[]>([])
  const [selectedNoteTags, setSelectedNoteTags] = useState<Tag[]>([])
  const [definitionTermSearch, setDefinitionTermSearch] = useState('')
  const [showDefinitionTermSuggestions, setShowDefinitionTermSuggestions] = useState(false)
  const [definitionTermActiveIndex, setDefinitionTermActiveIndex] = useState<number>(-1)

  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null)
  const pendingTagUpdateRequestRef = useRef<number | null>(null)
  const tagUpdateSequenceRef = useRef(0)
  const isDataQueriesEnabled = isAuthenticated === true

  // Resizable panel refs
  const sidebarPanelRef = usePanelRef()
  const analysisPanelRef = usePanelRef()

  // Persist panel layout to localStorage
  const layoutTimerRef = useRef<NodeJS.Timeout | null>(null)
  const handleLayoutChange = useCallback((layout: Record<string, number>) => {
    if (layoutTimerRef.current) clearTimeout(layoutTimerRef.current)
    layoutTimerRef.current = setTimeout(() => {
      try { localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layout)) } catch { /* ignore */ }
    }, 200)
  }, [])

  // DnD sensors with distance constraint to prevent accidental drags
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor)
  )

  useEffect(() => {
    const token = sessionStorage.getItem('auth_token')
    const isAuth = sessionStorage.getItem('authenticated') === 'true' && !!token
    setIsAuthenticated(isAuth)
  }, [])

  useEffect(() => {
    const handleUnauthorized = () => setIsAuthenticated(false)
    window.addEventListener('auth:unauthorized', handleUnauthorized)
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized)
  }, [])

  const { data: selectedNote } = useQuery({
    queryKey: ['note', selectedNoteId],
    queryFn: () => notesApi.getOne(selectedNoteId!),
    enabled: isDataQueriesEnabled && !!selectedNoteId,
  })

  useEffect(() => {
    pendingTagUpdateRequestRef.current = null
    setSelectedNoteTags(selectedNote?.tags || [])
  }, [selectedNoteId])

  useEffect(() => {
    if (pendingTagUpdateRequestRef.current === null) {
      setSelectedNoteTags(selectedNote?.tags || [])
    }
  }, [selectedNote?.tags])

  const { data: allFolders = [] } = useQuery({
    queryKey: ['folder-tree', { includeArchived: showArchived }],
    queryFn: () => foldersApi.getTree(showArchived || undefined),
    enabled: isDataQueriesEnabled,
  })

  const { data: connectionSuggestions = [] } = useQuery({
    queryKey: ['connection-suggestions', selectedFolderId],
    queryFn: () =>
      analysisApi.getConnectionSuggestions({
        limit: 20,
        folder_id: selectedFolderId && selectedFolderId !== 'unfiled' ? selectedFolderId : undefined,
      }),
    enabled: isDataQueriesEnabled,
    staleTime: 30_000,
    refetchOnMount: 'always',
  })

  const { data: criticalTerms = [] } = useQuery({
    queryKey: ['critical-terms'],
    queryFn: () => criticalTermsApi.getAll(),
    enabled: isDataQueriesEnabled,
    staleTime: 60_000,
  })

  const filteredDefinitionTerms = useMemo(() => {
    const activeTerms = criticalTerms.filter((term) => term.is_active)
    const query = definitionTermSearch.trim().toLowerCase()
    const sorted = [...activeTerms].sort((a, b) => {
      const countDelta = b.occurrence_count - a.occurrence_count
      if (countDelta !== 0) return countDelta
      return a.name.localeCompare(b.name)
    })
    if (!query) return sorted.slice(0, 8)

    const startsWith = sorted.filter((term) => term.name.toLowerCase().startsWith(query))
    const contains = sorted.filter(
      (term) => !term.name.toLowerCase().startsWith(query) && term.name.toLowerCase().includes(query)
    )
    return [...startsWith, ...contains].slice(0, 8)
  }, [criticalTerms, definitionTermSearch])

  const createNoteMutation = useMutation({
    mutationFn: (data: NoteCreate) => notesApi.create(data),
    onSuccess: (newNote) => {
      queryClient.invalidateQueries({ queryKey: ['notes'] })
      queryClient.invalidateQueries({ queryKey: ['folder-tree'] })
      queryClient.invalidateQueries({ queryKey: ['notes-unfiled-count'] })
      setSelectedNoteId(newNote.id)
    },
  })

  const updateNoteMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: NoteUpdate }) => notesApi.update(id, data),
    onSuccess: () => {
      setSaveStatus('saved')
      queryClient.invalidateQueries({ queryKey: ['notes'] })
      if (selectedNoteId) {
        queryClient.invalidateQueries({ queryKey: ['note', selectedNoteId] })
      }
      queryClient.invalidateQueries({ queryKey: ['folder-tree'] })
      queryClient.invalidateQueries({ queryKey: ['notes-unfiled-count'] })
      queryClient.invalidateQueries({ queryKey: ['critical-terms'] })
      queryClient.invalidateQueries({ queryKey: ['term-thinker-matrix'] })
    },
    onError: () => {
      setSaveStatus('unsaved')
    },
  })

  const deleteNoteMutation = useMutation({
    mutationFn: (id: string) => notesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] })
      queryClient.invalidateQueries({ queryKey: ['folder-tree'] })
      queryClient.invalidateQueries({ queryKey: ['notes-unfiled-count'] })
      setSelectedNoteId(null)
    },
  })

  // DnD mutation for moving folders
  const moveFolderMutation = useMutation({
    mutationFn: ({ id, parent_id }: { id: string; parent_id: string | null }) =>
      foldersApi.update(id, { parent_id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folder-tree'] })
      queryClient.invalidateQueries({ queryKey: ['notes'] })
      queryClient.invalidateQueries({ queryKey: ['notes-unfiled-count'] })
    },
  })

  // DnD mutation for moving notes to folders
  const moveNoteMutation = useMutation({
    mutationFn: ({ id, folder_id }: { id: string; folder_id: string | null }) =>
      notesApi.update(id, { folder_id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] })
      queryClient.invalidateQueries({ queryKey: ['folder-tree'] })
      queryClient.invalidateQueries({ queryKey: ['notes-unfiled-count'] })
      if (selectedNoteId) {
        queryClient.invalidateQueries({ queryKey: ['note', selectedNoteId] })
      }
    },
  })

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current
    if (data) {
      setActiveDrag({
        type: data.type as 'folder' | 'note',
        id: data.id as string,
        name: (data.name || data.title || 'Item') as string,
      })
    }
  }, [])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveDrag(null)

      const { active, over } = event
      if (!over || !active.data.current || !over.data.current) return

      const dragData = active.data.current
      const dropData = over.data.current

      const dragType = dragData.type as string
      const dragId = dragData.id as string
      const dropType = dropData.type as string

      // Prevent dropping folder on itself
      if (dragType === 'folder' && dropType === 'folder' && dragId === dropData.id) return

      // Prevent dropping a folder into its own descendant
      if (
        dragType === 'folder' &&
        dropType === 'folder' &&
        isFolderDescendant(allFolders, dragId, dropData.id as string)
      ) {
        return
      }

      // Prevent dropping on archived folders
      if (dropType === 'folder' && dropData.isArchived) return

      if (dragType === 'folder') {
        if (dropType === 'folder') {
          // Folder -> Folder: nest inside target
          moveFolderMutation.mutate({ id: dragId, parent_id: dropData.id as string })
        } else if (dropType === 'root') {
          // Folder -> Root: move to root level
          moveFolderMutation.mutate({ id: dragId, parent_id: null })
        }
      } else if (dragType === 'note') {
        if (dropType === 'folder') {
          // Note -> Folder: move to target folder
          moveNoteMutation.mutate({ id: dragId, folder_id: dropData.id as string })
        } else if (dropType === 'unfiled') {
          // Note -> Unfiled: remove from folder
          moveNoteMutation.mutate({ id: dragId, folder_id: null })
        }
      }
    },
    [allFolders, moveFolderMutation, moveNoteMutation]
  )

  const handleCreateNote = useCallback(
    (folderOverride?: string | null) => {
      const folderTarget = folderOverride !== undefined ? folderOverride : selectedFolderId
      createNoteMutation.mutate({
        title: '',
        content: '<p></p>',
        content_html: '<p></p>',
        note_type: 'research',
        folder_id: folderTarget === 'unfiled' ? null : folderTarget,
        is_canvas_note: false,
      })
    },
    [createNoteMutation, selectedFolderId]
  )

  const handleDeleteNote = useCallback(() => {
    if (!selectedNoteId) return
    if (window.confirm('Delete this note? This cannot be undone.')) {
      deleteNoteMutation.mutate(selectedNoteId)
    }
  }, [deleteNoteMutation, selectedNoteId])

  const handleEditorChange = useCallback(
    (html: string) => {
      if (!selectedNoteId) return

      setSaveStatus('unsaved')

      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current)
      }

      autoSaveTimerRef.current = setTimeout(() => {
        setSaveStatus('saving')

        const tempDiv = document.createElement('div')
        tempDiv.innerHTML = html
        const plainText = tempDiv.textContent || tempDiv.innerText || ''

        updateNoteMutation.mutate({
          id: selectedNoteId,
          data: {
            content: plainText,
            content_html: html,
          },
        })
      }, 900)
    },
    [selectedNoteId, updateNoteMutation]
  )

  const handleTitleChange = useCallback(
    (title: string) => {
      if (!selectedNoteId) return
      setSaveStatus('saving')
      updateNoteMutation.mutate({ id: selectedNoteId, data: { title } })
    },
    [selectedNoteId, updateNoteMutation]
  )

  const handleFolderChange = useCallback(
    (folderId: string) => {
      if (!selectedNoteId) return
      setSaveStatus('saving')
      const folder_id = folderId === 'unfiled' ? null : folderId
      updateNoteMutation.mutate({ id: selectedNoteId, data: { folder_id } })
    },
    [selectedNoteId, updateNoteMutation]
  )

  const handleNoteTagsChange = useCallback(
    (tags: Tag[]) => {
      if (!selectedNoteId) return

      const previousTags = selectedNoteTags
      const requestId = tagUpdateSequenceRef.current + 1
      tagUpdateSequenceRef.current = requestId
      pendingTagUpdateRequestRef.current = requestId

      setSaveStatus('saving')
      setSelectedNoteTags(tags)
      updateNoteMutation.mutate({
        id: selectedNoteId,
        data: { tag_ids: tags.map((tag) => tag.id) },
      }, {
        onSuccess: (updatedNote) => {
          if (pendingTagUpdateRequestRef.current !== requestId) return
          pendingTagUpdateRequestRef.current = null
          setSelectedNoteTags(updatedNote.tags || [])
        },
        onError: () => {
          if (pendingTagUpdateRequestRef.current !== requestId) return
          pendingTagUpdateRequestRef.current = null
          setSelectedNoteTags(previousTags)
        },
      })
    },
    [selectedNoteId, selectedNoteTags, updateNoteMutation]
  )

  const flattenFolders = (folders: FolderWithChildren[], level = 0): Array<{ id: string; name: string; level: number; isArchived: boolean }> => {
    const result: Array<{ id: string; name: string; level: number; isArchived: boolean }> = []
    for (const folder of folders) {
      result.push({ id: folder.id, name: folder.name, level, isArchived: folder.is_archived ?? false })
      if (folder.children.length > 0) {
        result.push(...flattenFolders(folder.children, level + 1))
      }
    }
    return result
  }

  const handleSave = useCallback(() => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current)
      autoSaveTimerRef.current = null
    }

    if (!selectedNoteId || !selectedNote) return

    setSaveStatus('saving')
    updateNoteMutation.mutate({
      id: selectedNoteId,
      data: {
        content: selectedNote.content,
        content_html: selectedNote.content_html || undefined,
        title: selectedNote.title || undefined,
      },
    })
  }, [selectedNote, selectedNoteId, updateNoteMutation])

  const handleSelectFolder = useCallback((folderId: string | null) => {
    setSelectedFolderId(folderId)
    setSelectedNoteId(null)
  }, [])

  const handleSelectTerm = (termId: string, termName?: string) => {
    setSelectedTermId(termId)
    setSelectedDefinitionThinkerId(null)
    setRightPanelMode('definition')
    analysisPanelRef.current?.expand()
    if (termName) setDefinitionTermSearch(termName)
  }

  const selectDefinitionSearchTerm = (term: CriticalTermWithCount) => {
    handleSelectTerm(term.id, term.name)
    setShowDefinitionTermSuggestions(false)
    setDefinitionTermActiveIndex(-1)
  }

  const runDefinitionTermSearch = (preferredIndex?: number) => {
    if (
      preferredIndex !== undefined &&
      preferredIndex >= 0 &&
      preferredIndex < filteredDefinitionTerms.length
    ) {
      selectDefinitionSearchTerm(filteredDefinitionTerms[preferredIndex])
      return
    }

    const query = definitionTermSearch.trim().toLowerCase()
    if (!query) return
    const exactMatch = criticalTerms.find((term) => term.is_active && term.name.toLowerCase() === query)
    if (exactMatch) {
      selectDefinitionSearchTerm(exactMatch)
      return
    }
    if (filteredDefinitionTerms.length > 0) {
      selectDefinitionSearchTerm(filteredDefinitionTerms[0])
    }
  }

  const handleFlagTerm = (term: string) => {
    setFlagTermInitialText(term)
    setIsFlagTermDialogOpen(true)
  }

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault()
        handleSave()
      }
      if ((event.ctrlKey || event.metaKey) && event.key === 'n') {
        event.preventDefault()
        handleCreateNote()
      }
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'f') {
        event.preventDefault()
        setFocusModeEnabled((current) => !current)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleCreateNote, handleSave])

  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (rightPanelMode === 'discovery' && !notesAiFlags.phaseD) {
      setRightPanelMode('definition')
    }
    if (rightPanelMode === 'planning' && !notesAiFlags.phaseE) {
      setRightPanelMode('definition')
    }
    if (rightPanelMode === 'ingestion' && !notesAiFlags.phaseF) {
      setRightPanelMode('definition')
    }
  }, [rightPanelMode])

  useEffect(() => {
    if (!selectedTermId) return
    const term = criticalTerms.find((item) => item.id === selectedTermId)
    if (term) {
      setDefinitionTermSearch(term.name)
    }
  }, [criticalTerms, selectedTermId])

  useEffect(() => {
    if (!showDefinitionTermSuggestions) {
      setDefinitionTermActiveIndex(-1)
      return
    }
    if (filteredDefinitionTerms.length === 0) {
      setDefinitionTermActiveIndex(-1)
      return
    }
    setDefinitionTermActiveIndex((current) => {
      if (current < 0 || current >= filteredDefinitionTerms.length) return 0
      return current
    })
  }, [filteredDefinitionTerms, showDefinitionTermSuggestions])

  const showCenterNotesSection = !focusModeEnabled || !selectedNoteId || !selectedNote

  const centerEditorContent = (
    <div className="h-full min-h-0 overflow-hidden flex flex-col">
      {selectedNoteId && selectedNote ? (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {!focusModeEnabled && (
            <div className="px-6 pt-4 pb-2 flex-shrink-0">
              <div className="flex items-center justify-between mb-2">
                <input
                  type="text"
                  value={selectedNote.title || ''}
                  onChange={(event) => handleTitleChange(event.target.value)}
                  placeholder="Untitled Note"
                  className="flex-1 font-serif text-xl font-semibold text-primary bg-transparent border-none outline-none placeholder:text-gray-300"
                />
                <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                  <span className="font-sans text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-secondary capitalize">
                    {selectedNote.note_type || 'general'}
                  </span>
                  <button
                    type="button"
                    onClick={handleDeleteNote}
                    className="p-1 text-gray-300 hover:text-red-500 transition-colors"
                    title="Delete note"
                  >
                    Del
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-sans text-[10px] text-secondary">Folder:</span>
                <select
                  value={selectedNote.folder_id || 'unfiled'}
                  onChange={(e) => handleFolderChange(e.target.value)}
                  className="font-sans text-xs px-2 py-1 border border-timeline rounded bg-white text-secondary hover:border-accent focus:border-accent focus:outline-none"
                >
                  <option value="unfiled">Unfiled</option>
                  {flattenFolders(allFolders)
                    .filter((f) => !f.isArchived)
                    .map((folder) => (
                      <option key={folder.id} value={folder.id}>
                        {'  '.repeat(folder.level)}
                        {folder.name}
                      </option>
                    ))}
                </select>
              </div>
              <div className="mt-2">
                <span className="font-sans text-[10px] text-secondary block mb-1">Tags:</span>
                <NoteTagSelector
                  value={selectedNoteTags}
                  onChange={handleNoteTagsChange}
                  placeholder="Add exam/dissertation tags..."
                />
              </div>
            </div>
          )}

          <div className="flex-1 min-h-0 overflow-hidden">
            <RichTextEditor
              noteId={selectedNoteId}
              content={selectedNote.content_html || selectedNote.content || ''}
              onChange={handleEditorChange}
              onSave={handleSave}
              onFlagTerm={handleFlagTerm}
              onDetectionResult={(result) => {
                setLastDetection(result)
                queryClient.invalidateQueries({ queryKey: ['connection-suggestions'] })
                queryClient.invalidateQueries({ queryKey: ['term-thinker-matrix'] })
              }}
              placeholder="Start writing your research notes..."
            />
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="font-sans text-sm text-secondary mb-1">No note selected</p>
            <p className="font-sans text-xs text-gray-400 mb-4">
              Select a note from the list or create a new one
            </p>
            <button
              type="button"
              onClick={() => handleCreateNote()}
              className="font-sans text-xs px-4 py-2 bg-accent text-white rounded hover:bg-accent/90 transition-colors"
            >
              Create Note
            </button>
          </div>
        </div>
      )}

      {!focusModeEnabled && lastDetection && lastDetection.known_thinkers.length > 0 && (
        <div className="border-t border-timeline px-4 py-2 bg-blue-50 text-xs font-sans text-blue-800">
          Detected thinkers: {lastDetection.known_thinkers.map((thinker) => thinker.name).join(', ')}
        </div>
      )}
    </div>
  )

  if (isAuthenticated === null) {
    return <div className="h-screen flex items-center justify-center text-secondary font-sans">Checking authentication...</div>
  }

  if (!isAuthenticated) {
    return <LoginScreen onSuccess={() => setIsAuthenticated(true)} />
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <header className="flex items-center justify-between px-4 py-2 border-b border-timeline flex-shrink-0 bg-background z-20">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-secondary hover:text-primary transition-colors font-sans text-xs"
            title="Back to Timeline"
          >
            ← <span className="hidden sm:inline">Timeline</span>
          </Link>

          <div className="w-px h-4 bg-timeline" />

          <h1 className="font-serif text-base sm:text-lg font-semibold text-primary">Research Notes</h1>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`font-sans text-[10px] px-2 py-0.5 rounded ${
              saveStatus === 'saved'
                ? 'text-green-600 bg-green-50'
                : saveStatus === 'saving'
                ? 'text-yellow-600 bg-yellow-50'
                : 'text-orange-600 bg-orange-50'
            }`}
          >
            {saveStatus === 'saved' ? 'Saved' : saveStatus === 'saving' ? 'Saving...' : 'Unsaved'}
          </span>

          <button
            type="button"
            onClick={() => {
              if (sidebarPanelRef.current?.isCollapsed()) {
                sidebarPanelRef.current.expand()
              } else {
                sidebarPanelRef.current?.collapse()
              }
            }}
            className="sm:hidden p-1.5 hover:bg-gray-100 rounded text-secondary"
            title="Toggle sidebar"
          >
            ☰
          </button>

          <button
            type="button"
            onClick={() => {
              if (sidebarPanelRef.current?.isCollapsed()) {
                sidebarPanelRef.current.expand()
              } else {
                sidebarPanelRef.current?.collapse()
              }
            }}
            className={`hidden sm:flex items-center gap-1 px-2 py-1 rounded text-xs font-sans transition-colors ${
              sidebarOpen ? 'bg-accent/10 text-accent' : 'text-secondary hover:text-primary hover:bg-gray-100'
            }`}
            title="Toggle sidebar"
          >
            Sidebar
          </button>

          <button
            type="button"
            onClick={() => {
              if (analysisPanelRef.current?.isCollapsed()) {
                analysisPanelRef.current.expand()
              } else {
                analysisPanelRef.current?.collapse()
              }
            }}
            className={`hidden sm:flex items-center gap-1 px-2 py-1 rounded text-xs font-sans transition-colors ${
              rightPanelOpen ? 'bg-accent/10 text-accent' : 'text-secondary hover:text-primary hover:bg-gray-100'
            }`}
            title="Toggle analysis panel"
          >
            Panel
          </button>

          <button
            type="button"
            onClick={() => setFocusModeEnabled((current) => !current)}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-sans transition-colors ${
              focusModeEnabled ? 'bg-accent/10 text-accent' : 'text-secondary hover:text-primary hover:bg-gray-100'
            }`}
            title="Toggle focus mode (Ctrl/Cmd+Shift+F)"
          >
            {focusModeEnabled ? 'Exit Focus' : 'Focus'}
          </button>
        </div>
      </header>

      <Group
        orientation="horizontal"
        id="notes-panels-v1"
        onLayoutChange={handleLayoutChange}
        className="flex-1"
      >
        {/* LEFT SIDEBAR */}
        <Panel
          id="sidebar"
          defaultSize="18%"
          minSize="12%"
          maxSize="25%"
          collapsible
          collapsedSize={0}
          panelRef={sidebarPanelRef}
          onResize={(panelSize, _id, prevSize) => {
            const collapsed = panelSize.asPercentage === 0
            const wasCollapsed = prevSize ? prevSize.asPercentage === 0 : false
            if (collapsed !== wasCollapsed) setSidebarOpen(!collapsed)
          }}
        >
          <div className="h-full border-r border-timeline bg-white overflow-hidden">
            <Group orientation="vertical" id="notes-sidebar-sections-v1" className="h-full">
              <Panel id="sidebar-folders" defaultSize="62%" minSize="25%">
                <div className="h-full min-h-0 p-3 flex flex-col">
                  <h2 className="font-sans text-xs font-semibold text-secondary uppercase tracking-wider mb-2">Folders</h2>
                  <div className="flex-1 min-h-0 overflow-y-auto pr-1">
                    <FolderTree
                      selectedFolderId={selectedFolderId}
                      onSelectFolder={handleSelectFolder}
                      onCreateNote={handleCreateNote}
                      showArchived={showArchived}
                      onToggleShowArchived={setShowArchived}
                    />
                  </div>
                </div>
              </Panel>

              <ResizeHandle id="sidebar-sections-handle" orientation="horizontal" />

              <Panel id="sidebar-critical-terms" defaultSize="38%" minSize="20%">
                <div className="h-full min-h-0 overflow-hidden">
                  <CriticalTermsList
                    onSelectTerm={handleSelectTerm}
                    selectedTermId={selectedTermId}
                    onFlagNewTerm={() => {
                      setFlagTermInitialText('')
                      setIsFlagTermDialogOpen(true)
                    }}
                  />
                </div>
              </Panel>
            </Group>
          </div>
        </Panel>

        <ResizeHandle id="sidebar-handle" />

        {/* CENTER EDITOR */}
        <Panel id="editor" minSize="35%">
          <main className="h-full flex flex-col overflow-hidden min-w-0">
            {showCenterNotesSection ? (
              <Group orientation="vertical" id="notes-center-sections-v1" className="h-full">
                <Panel id="center-notes-list" defaultSize="34%" minSize="18%" maxSize="60%">
                  <div className="h-full min-h-0 border-b border-timeline">
                    <NotesList
                      folderId={selectedFolderId}
                      includeArchived={showArchived}
                      selectedNoteId={selectedNoteId}
                      selectedTagFilterIds={selectedTagFilterIds}
                      onTagFilterIdsChange={setSelectedTagFilterIds}
                      onSelectNote={setSelectedNoteId}
                      onCreateNote={() => handleCreateNote()}
                    />
                  </div>
                </Panel>

                <ResizeHandle id="center-notes-editor-handle" orientation="horizontal" />

                <Panel id="center-editor-content" minSize="40%">
                  {centerEditorContent}
                </Panel>
              </Group>
            ) : (
              centerEditorContent
            )}
          </main>
        </Panel>

        <ResizeHandle id="analysis-handle" />

        {/* RIGHT ANALYSIS PANEL */}
        <Panel
          id="analysis"
          defaultSize="25%"
          minSize="18%"
          maxSize="35%"
          collapsible
          collapsedSize={0}
          panelRef={analysisPanelRef}
          onResize={(panelSize, _id, prevSize) => {
            const collapsed = panelSize.asPercentage === 0
            const wasCollapsed = prevSize ? prevSize.asPercentage === 0 : false
            if (collapsed && !wasCollapsed) {
              setRightPanelOpen(false)
              setRightPanelMode('none')
            } else if (!collapsed && wasCollapsed) {
              setRightPanelOpen(true)
              setRightPanelMode((prev) => (prev === 'none' ? 'definition' : prev))
            }
          }}
        >
          <aside className="h-full border-l border-timeline bg-white overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-3 py-2 border-b border-timeline">
              <h2 className="font-sans text-xs font-semibold text-secondary uppercase tracking-wider">Analysis</h2>
              <button
                type="button"
                onClick={() => analysisPanelRef.current?.collapse()}
                className="p-1 text-gray-400 hover:text-primary"
                title="Close panel"
              >
                X
              </button>
            </div>

            <div
              className="grid border-b border-timeline"
              style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(96px, 1fr))' }}
            >
              <button
                type="button"
                onClick={() => {
                  setRightPanelMode('definition')
                }}
                className={`min-w-0 px-2 py-2 text-xs leading-tight text-center whitespace-normal break-words font-sans transition-colors ${
                  rightPanelMode === 'definition'
                    ? 'text-accent border-b-2 border-accent font-medium'
                    : 'text-secondary hover:text-primary'
                }`}
              >
                Definition
              </button>
              <button
                type="button"
                onClick={() => {
                  setRightPanelMode('constellation')
                  queryClient.invalidateQueries({ queryKey: ['term-thinker-matrix'] })
                }}
                className={`min-w-0 px-2 py-2 text-xs leading-tight text-center whitespace-normal break-words font-sans transition-colors ${
                  rightPanelMode === 'constellation'
                    ? 'text-accent border-b-2 border-accent font-medium'
                    : 'text-secondary hover:text-primary'
                }`}
              >
                Constellation
              </button>
              <button
                type="button"
                onClick={() => {
                  setRightPanelMode('connections')
                  queryClient.invalidateQueries({ queryKey: ['connection-suggestions'] })
                }}
                className={`min-w-0 px-2 py-2 text-xs leading-tight text-center whitespace-normal break-words font-sans transition-colors ${
                  rightPanelMode === 'connections'
                    ? 'text-accent border-b-2 border-accent font-medium'
                    : 'text-secondary hover:text-primary'
                }`}
              >
                <span className="inline-flex items-center justify-center gap-1 flex-wrap">
                  <span>Connections</span>
                  {connectionSuggestions.length > 0 && (
                    <span className="inline-flex items-center justify-center min-w-4 h-4 px-1 text-[10px] font-mono font-medium text-white bg-accent rounded-full">
                      {connectionSuggestions.length}
                    </span>
                  )}
                </span>
              </button>
              {notesAiFlags.phaseD && (
                <button
                  type="button"
                  onClick={() => setRightPanelMode('discovery')}
                  className={`min-w-0 px-2 py-2 text-xs leading-tight text-center whitespace-normal break-words font-sans transition-colors ${
                    rightPanelMode === 'discovery'
                      ? 'text-accent border-b-2 border-accent font-medium'
                      : 'text-secondary hover:text-primary'
                  }`}
                >
                  Discovery
                </button>
              )}
              {notesAiFlags.phaseE && (
                <button
                  type="button"
                  onClick={() => setRightPanelMode('planning')}
                  className={`min-w-0 px-2 py-2 text-xs leading-tight text-center whitespace-normal break-words font-sans transition-colors ${
                    rightPanelMode === 'planning'
                      ? 'text-accent border-b-2 border-accent font-medium'
                      : 'text-secondary hover:text-primary'
                  }`}
                >
                  Planning
                </button>
              )}
              {notesAiFlags.phaseF && (
                <button
                  type="button"
                  onClick={() => setRightPanelMode('ingestion')}
                  className={`min-w-0 px-2 py-2 text-xs leading-tight text-center whitespace-normal break-words font-sans transition-colors ${
                    rightPanelMode === 'ingestion'
                      ? 'text-accent border-b-2 border-accent font-medium'
                      : 'text-secondary hover:text-primary'
                  }`}
                >
                  Ingest
                </button>
              )}
            </div>

            <div className="flex-1 overflow-hidden">
              {rightPanelMode === 'definition' ? (
                <div className="h-full flex flex-col">
                  <div className="px-3 py-2 border-b border-timeline">
                    <p className="text-[10px] font-sans text-secondary uppercase tracking-wide mb-1">Find Critical Term</p>
                    <div
                      className="relative"
                      onBlur={() => {
                        window.setTimeout(() => setShowDefinitionTermSuggestions(false), 120)
                      }}
                    >
                      <input
                        type="text"
                        value={definitionTermSearch}
                        onChange={(event) => {
                          setDefinitionTermSearch(event.target.value)
                          setShowDefinitionTermSuggestions(true)
                          setDefinitionTermActiveIndex(0)
                        }}
                        onFocus={() => {
                          setShowDefinitionTermSuggestions(true)
                          if (filteredDefinitionTerms.length > 0) setDefinitionTermActiveIndex(0)
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'ArrowDown') {
                            event.preventDefault()
                            setShowDefinitionTermSuggestions(true)
                            if (filteredDefinitionTerms.length > 0) {
                              setDefinitionTermActiveIndex((current) =>
                                current < filteredDefinitionTerms.length - 1 ? current + 1 : 0
                              )
                            }
                            return
                          }
                          if (event.key === 'ArrowUp') {
                            event.preventDefault()
                            setShowDefinitionTermSuggestions(true)
                            if (filteredDefinitionTerms.length > 0) {
                              setDefinitionTermActiveIndex((current) =>
                                current > 0 ? current - 1 : filteredDefinitionTerms.length - 1
                              )
                            }
                            return
                          }
                          if (event.key === 'Enter') {
                            event.preventDefault()
                            runDefinitionTermSearch(definitionTermActiveIndex)
                          }
                          if (event.key === 'Escape') {
                            setShowDefinitionTermSuggestions(false)
                            setDefinitionTermActiveIndex(-1)
                          }
                        }}
                        placeholder="Search critical terms..."
                        className="w-full px-2 py-1.5 text-xs font-sans border border-timeline rounded bg-white text-primary focus:outline-none focus:border-accent"
                      />
                      {showDefinitionTermSuggestions && (
                        <div className="absolute z-20 mt-1 w-full max-h-44 overflow-y-auto rounded border border-timeline bg-white shadow-sm">
                          {filteredDefinitionTerms.length > 0 ? (
                            filteredDefinitionTerms.map((term, index) => (
                              <button
                                key={term.id}
                                type="button"
                                onClick={() => selectDefinitionSearchTerm(term)}
                                onMouseEnter={() => setDefinitionTermActiveIndex(index)}
                                className={`w-full text-left px-2 py-1.5 text-xs font-sans text-primary transition-colors flex items-center justify-between ${
                                  definitionTermActiveIndex === index ? 'bg-accent/15' : 'hover:bg-accent/10'
                                }`}
                              >
                                <span className="truncate mr-2">{term.name}</span>
                                <span className="text-[10px] text-secondary">{term.occurrence_count}</span>
                              </button>
                            ))
                          ) : (
                            <div className="px-2 py-1.5 text-xs font-sans text-secondary">No matching critical terms</div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex-1 overflow-hidden">
                    {selectedTermId ? (
                      <TermDefinitionPanel
                        termId={selectedTermId}
                        folderId={selectedFolderId && selectedFolderId !== 'unfiled' ? selectedFolderId : undefined}
                        selectedThinkerId={selectedDefinitionThinkerId}
                        onClose={() => {
                          analysisPanelRef.current?.collapse()
                          setSelectedTermId(null)
                          setSelectedDefinitionThinkerId(null)
                        }}
                        onNavigateToNote={(noteId) => setSelectedNoteId(noteId)}
                      />
                    ) : (
                      <div className="p-4 text-xs text-secondary font-sans">
                        Search and select a critical term to view its definition.
                      </div>
                    )}
                  </div>
                </div>
              ) : rightPanelMode === 'constellation' ? (
                <ConstellationChart
                  selectedTermId={selectedTermId}
                  folderId={selectedFolderId && selectedFolderId !== 'unfiled' ? selectedFolderId : undefined}
                  onBubbleClick={(termId, thinkerId) => {
                    setRightPanelMode('definition')
                    setSelectedTermId(termId)
                    setSelectedDefinitionThinkerId(thinkerId)
                  }}
                />
              ) : rightPanelMode === 'connections' ? (
                <ConnectionSuggestionsPanel
                  folderId={selectedFolderId && selectedFolderId !== 'unfiled' ? selectedFolderId : undefined}
                />
              ) : rightPanelMode === 'discovery' ? (
                <div className="h-full overflow-y-auto p-3">
                  <SemanticSearchPanel
                    folderId={selectedFolderId && selectedFolderId !== 'unfiled' ? selectedFolderId : undefined}
                    onNavigateToNote={(noteId) => setSelectedNoteId(noteId)}
                  />
                </div>
              ) : rightPanelMode === 'planning' ? (
                <div className="h-full overflow-y-auto p-3 space-y-3">
                  <AiUsageMeter />
                  <ResearchSprintPlanner onNavigateToNote={(noteId) => setSelectedNoteId(noteId)} />
                  <AdvisorBriefPanel onNavigateToNote={(noteId) => setSelectedNoteId(noteId)} />
                  <VivaPracticePanel onNavigateToNote={(noteId) => setSelectedNoteId(noteId)} />
                  <WeeklyDigestPanel onNavigateToNote={(noteId) => setSelectedNoteId(noteId)} />
                </div>
              ) : rightPanelMode === 'ingestion' ? (
                <div className="h-full overflow-y-auto p-3">
                  <AiIngestionPanel />
                </div>
              ) : (
                <div className="p-4 text-xs text-secondary font-sans">Select a panel mode to begin analysis.</div>
              )}
            </div>
          </aside>
        </Panel>
      </Group>

      {/* Drag overlay - floating preview of dragged item */}
      <DragOverlay>
        {activeDrag && (
          <div className="px-3 py-1.5 bg-white border border-accent rounded shadow-lg text-xs font-sans text-primary max-w-48 truncate">
            {activeDrag.type === 'folder' ? 'F ' : 'N '}
            {activeDrag.name}
          </div>
        )}
      </DragOverlay>

      <FlagTermDialog
        isOpen={isFlagTermDialogOpen}
        onClose={() => setIsFlagTermDialogOpen(false)}
        initialTerm={flagTermInitialText}
      />
    </DndContext>
  )
}
