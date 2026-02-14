# Plan 3: Notes Page Foundation

## Goal

Create the `/notes` route -- the first separate page in the application -- with a three-panel layout (folder sidebar, notes list + rich text editor, right panel placeholder) and a TipTap-based rich text editor. This transforms the app from a single-page canvas tool into a multi-page research environment.

**Depends on:** Plan 1 (required). Plan 2 is optional for first pass and required for full sidebar integration.

**Enables:** Plan 4 (thinker auto-detection), Plan 5 (critical terms), Plan 7 (constellation visualization)

---

## Audit Notes (2026-02-13)

1. Keep `selectedFolderId === "unfiled"` as frontend-only state; do not send it to backend UUID params.
2. Creating a note from the unfiled view must set `folder_id` to `null`.
3. File summary counts were normalized to match the actual file list.

---

## NPM Dependencies to Install

```bash
cd frontend && npm install @tiptap/react @tiptap/starter-kit @tiptap/extension-placeholder @tiptap/extension-underline @tiptap/pm
```

These are the core TipTap packages:
- `@tiptap/react` -- React bindings for TipTap
- `@tiptap/starter-kit` -- Bold, italic, strike, headings, lists, blockquote, code block, horizontal rule
- `@tiptap/extension-placeholder` -- Placeholder text when editor is empty
- `@tiptap/extension-underline` -- Underline formatting (not in starter kit)
- `@tiptap/pm` -- ProseMirror peer dependencies

---

## File Changes Summary

| Action | File | Description |
|--------|------|-------------|
| MODIFY | `backend/app/schemas/note.py` | Add `folder_id` to NoteCreate and NoteUpdate |
| MODIFY | `backend/app/routes/notes.py` | Add `folder_id` query param filter to GET |
| CREATE | `frontend/src/app/notes/layout.tsx` | Three-panel layout with top nav |
| CREATE | `frontend/src/app/notes/page.tsx` | Main notes page with state management |
| CREATE | `frontend/src/components/notes/RichTextEditor.tsx` | TipTap editor component |
| CREATE | `frontend/src/components/notes/EditorToolbar.tsx` | Formatting toolbar |
| CREATE | `frontend/src/components/notes/NotesList.tsx` | Filterable/sortable notes list |
| MODIFY | `frontend/src/lib/api.ts` | Extend `notesApi.getAll` with `folderId` param |
| MODIFY | `frontend/src/types/index.ts` | Add `folder_id` to note interfaces |
| MODIFY | `frontend/src/app/globals.css` | Add TipTap/ProseMirror editor styles |
| MODIFY | `frontend/src/app/page.tsx` | Add navigation link to `/notes` in header |

---

## Backend Modifications

### File: `backend/app/schemas/note.py`

Add `folder_id` to the create and update schemas. The `Note` model already has `folder_id` from Plan 1's migration.

**In `NoteCreate` (line ~29-30), add `folder_id`:**

```python
class NoteCreate(NoteBase):
    thinker_id: Optional[UUID] = None
    folder_id: Optional[UUID] = None
```

**In `NoteUpdate` (line ~33-41), add `folder_id`:**

```python
class NoteUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    note_type: Optional[NoteTypeStr] = None
    folder_id: Optional[UUID] = None
    # Canvas sticky note fields
    position_x: Optional[float] = None
    position_y: Optional[float] = None
    color: Optional[NoteColorStr] = None
    is_canvas_note: Optional[bool] = None
```

**In the `Note` response schema (line ~52-59), add `folder_id`:**

```python
class Note(NoteBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    thinker_id: Optional[UUID] = None
    folder_id: Optional[UUID] = None
    content_html: Optional[str] = None
    created_at: datetime
    updated_at: datetime
```

### File: `backend/app/routes/notes.py`

Add `folder_id` query parameter to the `GET /api/notes/` endpoint.

**Replace the `get_notes` function (lines 61-80) with:**

```python
@router.get("/", response_model=List[schemas.Note])
def get_notes(
    thinker_id: Optional[UUID] = None,
    note_type: Optional[str] = None,
    is_canvas_note: Optional[bool] = None,
    folder_id: Optional[UUID] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(Note)

    if thinker_id:
        query = query.filter(Note.thinker_id == thinker_id)
    if note_type:
        query = query.filter(Note.note_type == note_type)
    if is_canvas_note is not None:
        query = query.filter(Note.is_canvas_note == is_canvas_note)
    if folder_id:
        query = query.filter(Note.folder_id == folder_id)

    notes = query.order_by(Note.updated_at.desc()).offset(skip).limit(limit).all()
    return notes
```

---

## Frontend: API Client Extension

### File: `frontend/src/lib/api.ts`

Extend `notesApi.getAll` to accept an optional `folderId` parameter.

**Replace the existing `notesApi.getAll` (lines 269-275) with:**

```typescript
getAll: async (thinkerId?: string, noteType?: string, folderId?: string): Promise<Note[]> => {
  const params: Record<string, string> = {}
  if (thinkerId) params.thinker_id = thinkerId
  if (noteType) params.note_type = noteType
  if (folderId) params.folder_id = folderId
  const response = await api.get('/api/notes/', { params })
  return response.data
},
```

---

## Frontend: Types Extension

### File: `frontend/src/types/index.ts`

Add `folder_id` to the Note interfaces.

**In the `Note` interface (around line 393), add `folder_id`:**

```typescript
export interface Note {
  id: string
  thinker_id?: string | null
  folder_id?: string | null          // <-- ADD THIS
  title?: string | null
  content: string
  content_html?: string | null
  note_type?: NoteType | null
  // Canvas sticky note fields
  position_x?: number | null
  position_y?: number | null
  color?: NoteColor | null
  is_canvas_note?: boolean | null
  created_at: string
  updated_at: string
}
```

**In `NoteCreate` (around line 413), add `folder_id`:**

```typescript
export interface NoteCreate {
  thinker_id?: string | null
  folder_id?: string | null           // <-- ADD THIS
  title?: string | null
  content: string
  note_type?: NoteType | null
  // Canvas sticky note fields
  position_x?: number | null
  position_y?: number | null
  color?: NoteColor | null
  is_canvas_note?: boolean | null
}
```

**In `NoteUpdate` (around line 425), add `folder_id`:**

```typescript
export interface NoteUpdate {
  title?: string | null
  content?: string
  note_type?: NoteType | null
  folder_id?: string | null           // <-- ADD THIS
  // Canvas sticky note fields
  position_x?: number | null
  position_y?: number | null
  color?: NoteColor | null
  is_canvas_note?: boolean | null
}
```

---

## Frontend: Notes Layout

### File: `frontend/src/app/notes/layout.tsx`

This is the Next.js layout for the `/notes` route. It provides the three-panel flex structure and top navigation bar. The root layout (`app/layout.tsx`) already wraps children in `<Providers>`, so we do not re-wrap here.

```typescript
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Research Notes - Intellectual Genealogy Mapper',
  description: 'PhD research note-taking with rich text editing and folder organization',
}

export default function NotesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      {children}
    </div>
  )
}
```

---

## Frontend: Notes Page

### File: `frontend/src/app/notes/page.tsx`

The main notes page component. This is the `'use client'` page that manages all state: selected folder, selected note, editor content, right panel visibility. It connects the FolderTree (Plan 2), NotesList, and RichTextEditor components.

```typescript
'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { notesApi } from '@/lib/api'
import type { Note, NoteCreate, NoteUpdate } from '@/types'
import { NotesList } from '@/components/notes/NotesList'
import { RichTextEditor } from '@/components/notes/RichTextEditor'
import Link from 'next/link'

// FolderTree will come from Plan 2 -- use placeholder until then
// import { FolderTree } from '@/components/notes/FolderTree'

type RightPanelMode = 'none' | 'definition' | 'constellation' | 'connections'

export default function NotesPage() {
  const queryClient = useQueryClient()

  // --- State ---
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null)
  const [rightPanelMode, setRightPanelMode] = useState<RightPanelMode>('none')
  const [rightPanelOpen, setRightPanelOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved')

  // Debounce timer ref for auto-save
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null)

  // --- Queries ---
  const { data: selectedNote, isLoading: noteLoading } = useQuery({
    queryKey: ['note', selectedNoteId],
    queryFn: () => notesApi.getOne(selectedNoteId!),
    enabled: !!selectedNoteId,
  })

  // --- Mutations ---
  const createNoteMutation = useMutation({
    mutationFn: (data: NoteCreate) => notesApi.create(data),
    onSuccess: (newNote) => {
      queryClient.invalidateQueries({ queryKey: ['notes'] })
      setSelectedNoteId(newNote.id)
    },
  })

  const updateNoteMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: NoteUpdate }) =>
      notesApi.update(id, data),
    onSuccess: () => {
      setSaveStatus('saved')
      queryClient.invalidateQueries({ queryKey: ['notes'] })
      if (selectedNoteId) {
        queryClient.invalidateQueries({ queryKey: ['note', selectedNoteId] })
      }
    },
    onError: () => {
      setSaveStatus('unsaved')
    },
  })

  const deleteNoteMutation = useMutation({
    mutationFn: (id: string) => notesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] })
      setSelectedNoteId(null)
    },
  })

  // --- Handlers ---
  const handleCreateNote = useCallback(() => {
    createNoteMutation.mutate({
      title: '',
      content: '<p></p>',
      content_html: '<p></p>',
      note_type: 'research',
      folder_id: selectedFolderId === 'unfiled' ? null : selectedFolderId,
      is_canvas_note: false,
    })
  }, [createNoteMutation, selectedFolderId])

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

      // Clear existing timer
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current)
      }

      // Set new debounce timer (1 second)
      autoSaveTimerRef.current = setTimeout(() => {
        setSaveStatus('saving')

        // Extract plain text from HTML for the content field
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
      }, 1000)
    },
    [selectedNoteId, updateNoteMutation]
  )

  const handleTitleChange = useCallback(
    (title: string) => {
      if (!selectedNoteId) return

      setSaveStatus('saving')
      updateNoteMutation.mutate({
        id: selectedNoteId,
        data: { title },
      })
    },
    [selectedNoteId, updateNoteMutation]
  )

  const handleSave = useCallback(() => {
    // Force save immediately (clears any pending auto-save)
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
  }, [selectedNoteId, selectedNote, updateNoteMutation])

  const handleSelectFolder = useCallback((folderId: string | null) => {
    setSelectedFolderId(folderId)
    setSelectedNoteId(null) // Reset note selection when folder changes
  }, [])

  // --- Keyboard shortcuts ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + S to save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
      // Ctrl/Cmd + N to create new note
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault()
        handleCreateNote()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleSave, handleCreateNote])

  // Cleanup auto-save timer on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current)
      }
    }
  }, [])

  return (
    <>
      {/* Top Navigation Bar */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-timeline flex-shrink-0 bg-background z-20">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-secondary hover:text-primary transition-colors font-sans text-xs"
            title="Back to Timeline"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            <span className="hidden sm:inline">Timeline</span>
          </Link>

          <div className="w-px h-4 bg-timeline" />

          <h1 className="font-serif text-base sm:text-lg font-semibold text-primary">
            Research Notes
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {/* Save status indicator */}
          <span
            className={`font-sans text-[10px] px-2 py-0.5 rounded ${
              saveStatus === 'saved'
                ? 'text-green-600 bg-green-50'
                : saveStatus === 'saving'
                ? 'text-yellow-600 bg-yellow-50'
                : 'text-orange-600 bg-orange-50'
            }`}
          >
            {saveStatus === 'saved'
              ? 'Saved'
              : saveStatus === 'saving'
              ? 'Saving...'
              : 'Unsaved'}
          </span>

          {/* Toggle sidebar button (mobile) */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="sm:hidden p-1.5 hover:bg-gray-100 rounded text-secondary"
            title="Toggle sidebar"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* Right panel toggle (placeholder for Plans 6/7/8) */}
          <button
            onClick={() => {
              if (rightPanelOpen) {
                setRightPanelOpen(false)
                setRightPanelMode('none')
              } else {
                setRightPanelOpen(true)
                setRightPanelMode('definition')
              }
            }}
            className={`hidden sm:flex items-center gap-1 px-2 py-1 rounded text-xs font-sans transition-colors ${
              rightPanelOpen
                ? 'bg-accent/10 text-accent'
                : 'text-secondary hover:text-primary hover:bg-gray-100'
            }`}
            title="Toggle analysis panel"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            Panel
          </button>
        </div>
      </header>

      {/* Three-Panel Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar: Folder Tree + Critical Terms (Plan 5) */}
        <aside
          className={`${
            sidebarOpen ? 'w-[260px]' : 'w-0'
          } flex-shrink-0 border-r border-timeline bg-white overflow-hidden transition-all duration-200 flex flex-col`}
        >
          {/* Folder Tree (Plan 2) -- placeholder until implemented */}
          <div className="flex-1 overflow-y-auto p-3">
            <div className="mb-3">
              <h2 className="font-sans text-xs font-semibold text-secondary uppercase tracking-wider mb-2">
                Folders
              </h2>
              {/*
                Plan 2 will provide FolderTree component here:
                <FolderTree
                  selectedFolderId={selectedFolderId}
                  onSelectFolder={handleSelectFolder}
                />
              */}
              <div className="space-y-1">
                <button
                  onClick={() => handleSelectFolder(null)}
                  className={`w-full text-left px-2 py-1.5 rounded text-xs font-sans transition-colors ${
                    selectedFolderId === null
                      ? 'bg-accent/10 text-accent font-medium'
                      : 'text-secondary hover:bg-gray-50 hover:text-primary'
                  }`}
                >
                  All Notes
                </button>
              </div>
            </div>

            {/* Critical Terms List placeholder (Plan 5) */}
            <div className="mt-4 pt-4 border-t border-gray-100">
              <h2 className="font-sans text-xs font-semibold text-secondary uppercase tracking-wider mb-2">
                Critical Terms
              </h2>
              <p className="text-[10px] text-gray-400 font-sans italic">
                Term tracking will appear here (Plan 5)
              </p>
            </div>
          </div>
        </aside>

        {/* Center: Notes List + Editor */}
        <main className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* Notes List (top portion) */}
          <div className="border-b border-timeline flex-shrink-0">
            <NotesList
              folderId={selectedFolderId}
              selectedNoteId={selectedNoteId}
              onSelectNote={setSelectedNoteId}
              onCreateNote={handleCreateNote}
            />
          </div>

          {/* Editor (bottom portion -- takes remaining space) */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {selectedNoteId && selectedNote ? (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Note Title */}
                <div className="px-6 pt-4 pb-2 flex items-center justify-between flex-shrink-0">
                  <input
                    type="text"
                    value={selectedNote.title || ''}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    placeholder="Untitled Note"
                    className="flex-1 font-serif text-xl font-semibold text-primary bg-transparent border-none outline-none placeholder:text-gray-300"
                  />
                  <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                    {/* Note type badge */}
                    <span className="font-sans text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-secondary capitalize">
                      {selectedNote.note_type || 'general'}
                    </span>
                    {/* Delete button */}
                    <button
                      onClick={handleDeleteNote}
                      className="p-1 text-gray-300 hover:text-red-500 transition-colors"
                      title="Delete note"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Rich Text Editor */}
                <div className="flex-1 overflow-y-auto">
                  <RichTextEditor
                    content={selectedNote.content_html || selectedNote.content || ''}
                    onChange={handleEditorChange}
                    onSave={handleSave}
                    placeholder="Start writing your research notes..."
                  />
                </div>
              </div>
            ) : (
              /* Empty state */
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-4xl mb-3 opacity-20">
                    <svg className="w-16 h-16 mx-auto text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </div>
                  <p className="font-sans text-sm text-secondary mb-1">
                    No note selected
                  </p>
                  <p className="font-sans text-xs text-gray-400 mb-4">
                    Select a note from the list or create a new one
                  </p>
                  <button
                    onClick={handleCreateNote}
                    className="font-sans text-xs px-4 py-2 bg-accent text-white rounded hover:bg-accent/90 transition-colors"
                  >
                    Create Note
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>

        {/* Right Panel: Placeholder for Plans 6/7/8 */}
        {rightPanelOpen && (
          <aside className="w-[360px] flex-shrink-0 border-l border-timeline bg-white overflow-y-auto hidden sm:block">
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-sans text-xs font-semibold text-secondary uppercase tracking-wider">
                  Analysis
                </h2>
                <button
                  onClick={() => {
                    setRightPanelOpen(false)
                    setRightPanelMode('none')
                  }}
                  className="p-1 text-gray-400 hover:text-primary"
                  title="Close panel"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Panel mode tabs */}
              <div className="flex gap-1 mb-4">
                {(['definition', 'constellation', 'connections'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setRightPanelMode(mode)}
                    className={`font-sans text-[10px] px-2 py-1 rounded capitalize transition-colors ${
                      rightPanelMode === mode
                        ? 'bg-accent/10 text-accent font-medium'
                        : 'text-secondary hover:bg-gray-50'
                    }`}
                  >
                    {mode === 'definition'
                      ? 'Definitions'
                      : mode === 'constellation'
                      ? 'Constellation'
                      : 'Connections'}
                  </button>
                ))}
              </div>

              {/* Placeholder content per mode */}
              <div className="rounded-lg border border-dashed border-gray-200 p-6 text-center">
                {rightPanelMode === 'definition' && (
                  <>
                    <p className="font-sans text-xs text-gray-400 mb-1">
                      Term Definitions & Filtered Analysis
                    </p>
                    <p className="font-sans text-[10px] text-gray-300">
                      Plan 6 will show filtered excerpts and AI synthesis here
                    </p>
                  </>
                )}
                {rightPanelMode === 'constellation' && (
                  <>
                    <p className="font-sans text-xs text-gray-400 mb-1">
                      Constellation Visualization
                    </p>
                    <p className="font-sans text-[10px] text-gray-300">
                      Plan 7 will render an SVG bubble chart here
                    </p>
                  </>
                )}
                {rightPanelMode === 'connections' && (
                  <>
                    <p className="font-sans text-xs text-gray-400 mb-1">
                      Auto-Connection Suggestions
                    </p>
                    <p className="font-sans text-[10px] text-gray-300">
                      Plan 8 will show co-occurrence based suggestions here
                    </p>
                  </>
                )}
              </div>
            </div>
          </aside>
        )}
      </div>
    </>
  )
}
```

---

## Frontend: RichTextEditor

### File: `frontend/src/components/notes/RichTextEditor.tsx`

The TipTap editor component. Wraps `EditorContent` with the toolbar, handles initialization, and delegates change events to the parent.

```typescript
'use client'

import { useEffect } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import { EditorToolbar } from './EditorToolbar'

interface RichTextEditorProps {
  content: string
  onChange: (html: string) => void
  onSave: () => void
  placeholder?: string
}

export function RichTextEditor({
  content,
  onChange,
  onSave,
  placeholder = 'Start writing...',
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
        bulletList: {
          keepMarks: true,
          keepAttributes: false,
        },
        orderedList: {
          keepMarks: true,
          keepAttributes: false,
        },
      }),
      Placeholder.configure({
        placeholder,
        emptyEditorClass: 'is-editor-empty',
      }),
      Underline,
    ],
    content,
    editorProps: {
      attributes: {
        class: 'tiptap-editor-content',
        spellcheck: 'true',
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
  })

  // Update editor content when the selected note changes (external content change)
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      // Only update if content is actually different to avoid cursor jumping
      editor.commands.setContent(content, false)
    }
  }, [content]) // eslint-disable-line react-hooks/exhaustive-deps
  // Note: we intentionally exclude `editor` from deps to prevent loops

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      editor?.destroy()
    }
  }, [editor])

  if (!editor) {
    return (
      <div className="px-6 py-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-100 rounded w-3/4 mb-3" />
          <div className="h-4 bg-gray-100 rounded w-1/2 mb-3" />
          <div className="h-4 bg-gray-100 rounded w-5/6" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <EditorToolbar editor={editor} />

      {/* Editor area */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
```

---

## Frontend: EditorToolbar

### File: `frontend/src/components/notes/EditorToolbar.tsx`

The formatting toolbar rendered above the editor. Each button toggles a TipTap command and reflects active state.

```typescript
'use client'

import type { Editor } from '@tiptap/react'

interface EditorToolbarProps {
  editor: Editor
}

interface ToolbarButtonProps {
  onClick: () => void
  isActive?: boolean
  title: string
  children: React.ReactNode
}

function ToolbarButton({ onClick, isActive, title, children }: ToolbarButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`p-1.5 rounded text-xs transition-colors ${
        isActive
          ? 'bg-accent/10 text-accent'
          : 'text-secondary hover:bg-gray-100 hover:text-primary'
      }`}
      title={title}
      type="button"
    >
      {children}
    </button>
  )
}

function Divider() {
  return <div className="w-px h-5 bg-gray-200 mx-1" />
}

export function EditorToolbar({ editor }: EditorToolbarProps) {
  return (
    <div className="flex items-center gap-0.5 px-6 py-1.5 border-b border-gray-100 flex-shrink-0 flex-wrap">
      {/* Text formatting */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive('bold')}
        title="Bold (Ctrl+B)"
      >
        <span className="font-bold font-sans text-[11px]">B</span>
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive('italic')}
        title="Italic (Ctrl+I)"
      >
        <span className="italic font-serif text-[11px]">I</span>
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        isActive={editor.isActive('underline')}
        title="Underline (Ctrl+U)"
      >
        <span className="underline font-sans text-[11px]">U</span>
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleStrike().run()}
        isActive={editor.isActive('strike')}
        title="Strikethrough"
      >
        <span className="line-through font-sans text-[11px]">S</span>
      </ToolbarButton>

      <Divider />

      {/* Headings */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        isActive={editor.isActive('heading', { level: 1 })}
        title="Heading 1"
      >
        <span className="font-sans text-[11px] font-semibold">H1</span>
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        isActive={editor.isActive('heading', { level: 2 })}
        title="Heading 2"
      >
        <span className="font-sans text-[11px] font-semibold">H2</span>
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        isActive={editor.isActive('heading', { level: 3 })}
        title="Heading 3"
      >
        <span className="font-sans text-[11px] font-semibold">H3</span>
      </ToolbarButton>

      <Divider />

      {/* Lists */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        isActive={editor.isActive('bulletList')}
        title="Bullet List"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        isActive={editor.isActive('orderedList')}
        title="Numbered List"
      >
        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
          <text x="1" y="7" fontSize="6" fontFamily="sans-serif">1.</text>
          <line x1="7" y1="5" x2="19" y2="5" stroke="currentColor" strokeWidth="1.5" />
          <text x="1" y="13" fontSize="6" fontFamily="sans-serif">2.</text>
          <line x1="7" y1="11" x2="19" y2="11" stroke="currentColor" strokeWidth="1.5" />
          <text x="1" y="19" fontSize="6" fontFamily="sans-serif">3.</text>
          <line x1="7" y1="17" x2="19" y2="17" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </ToolbarButton>

      <Divider />

      {/* Block elements */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        isActive={editor.isActive('blockquote')}
        title="Blockquote"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        isActive={editor.isActive('codeBlock')}
        title="Code Block"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
        </svg>
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        title="Horizontal Rule"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
        </svg>
      </ToolbarButton>

      <Divider />

      {/* Undo/Redo */}
      <ToolbarButton
        onClick={() => editor.chain().focus().undo().run()}
        title="Undo (Ctrl+Z)"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a5 5 0 015 5v2M3 10l4-4M3 10l4 4" />
        </svg>
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().redo().run()}
        title="Redo (Ctrl+Shift+Z)"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10H11a5 5 0 00-5 5v2M21 10l-4-4M21 10l-4 4" />
        </svg>
      </ToolbarButton>
    </div>
  )
}
```

---

## Frontend: NotesList

### File: `frontend/src/components/notes/NotesList.tsx`

The note list displayed in the center panel above the editor. Supports search, sort, and folder filtering.

```typescript
'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { notesApi } from '@/lib/api'
import type { Note } from '@/types'
import { format } from 'date-fns'

type SortField = 'updated_at' | 'created_at' | 'title'

interface NotesListProps {
  folderId: string | null
  selectedNoteId: string | null
  onSelectNote: (noteId: string) => void
  onCreateNote: () => void
}

export function NotesList({
  folderId,
  selectedNoteId,
  onSelectNote,
  onCreateNote,
}: NotesListProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [sortField, setSortField] = useState<SortField>('updated_at')
  const [isExpanded, setIsExpanded] = useState(true)

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ['notes', folderId],
    queryFn: () =>
      notesApi.getAll(
        undefined,           // thinkerId
        undefined,           // noteType
        folderId && folderId !== 'unfiled' ? folderId : undefined // folderId
      ),
  })

  // Filter canvas notes out -- this page shows only non-canvas notes
  const nonCanvasNotes = useMemo(
    () => notes.filter((n) => !n.is_canvas_note),
    [notes]
  )

  // Client-side search filter
  const filteredNotes = useMemo(() => {
    if (!searchQuery.trim()) return nonCanvasNotes

    const q = searchQuery.toLowerCase()
    return nonCanvasNotes.filter(
      (note) =>
        (note.title && note.title.toLowerCase().includes(q)) ||
        note.content.toLowerCase().includes(q)
    )
  }, [nonCanvasNotes, searchQuery])

  // Sort
  const sortedNotes = useMemo(() => {
    return [...filteredNotes].sort((a, b) => {
      if (sortField === 'title') {
        const aTitle = a.title || 'Untitled'
        const bTitle = b.title || 'Untitled'
        return aTitle.localeCompare(bTitle)
      }
      // Date fields: most recent first
      return new Date(b[sortField]).getTime() - new Date(a[sortField]).getTime()
    })
  }, [filteredNotes, sortField])

  // Derive display title from note
  const getNoteDisplayTitle = (note: Note): string => {
    if (note.title && note.title.trim()) return note.title
    // Fall back to first line of content (strip HTML)
    const text = note.content.replace(/<[^>]*>/g, '').trim()
    if (text.length > 50) return text.substring(0, 50) + '...'
    return text || 'Untitled Note'
  }

  // Format relative date
  const formatDate = (dateStr: string): string => {
    try {
      return format(new Date(dateStr), 'MMM d, yyyy')
    } catch {
      return dateStr
    }
  }

  // Note type badge color
  const noteTypeBadgeClass = (type: string | null | undefined): string => {
    switch (type) {
      case 'research':
        return 'bg-blue-50 text-blue-600'
      case 'biography':
        return 'bg-purple-50 text-purple-600'
      case 'connection':
        return 'bg-green-50 text-green-600'
      default:
        return 'bg-gray-50 text-gray-500'
    }
  }

  return (
    <div className={`${isExpanded ? 'max-h-[280px]' : 'max-h-[40px]'} transition-all duration-200 overflow-hidden`}>
      {/* Header row */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50/50">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1.5 text-xs font-sans font-semibold text-secondary hover:text-primary"
        >
          <svg
            className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          Notes
          {!isLoading && (
            <span className="text-[10px] font-normal text-gray-400">
              ({sortedNotes.length})
            </span>
          )}
        </button>

        <div className="flex items-center gap-2">
          {/* Sort dropdown */}
          <select
            value={sortField}
            onChange={(e) => setSortField(e.target.value as SortField)}
            className="text-[10px] font-sans text-secondary bg-transparent border-none outline-none cursor-pointer"
          >
            <option value="updated_at">Last edited</option>
            <option value="created_at">Created</option>
            <option value="title">Title</option>
          </select>

          {/* New note button */}
          <button
            onClick={onCreateNote}
            className="flex items-center gap-1 px-2 py-1 bg-accent text-white rounded text-[10px] font-sans hover:bg-accent/90 transition-colors"
            title="New note (Ctrl+N)"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New
          </button>
        </div>
      </div>

      {/* Search */}
      {isExpanded && (
        <>
          <div className="px-4 py-1.5">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search notes..."
                className="w-full pl-7 pr-3 py-1.5 text-xs font-sans border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-accent/50 focus:border-accent/50 bg-white"
              />
              <svg
                className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400"
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
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
                >
                  x
                </button>
              )}
            </div>
          </div>

          {/* Notes list */}
          <div className="overflow-y-auto max-h-[180px] scrollbar-hide">
            {isLoading ? (
              <div className="px-4 py-3 text-xs font-sans text-gray-400">
                Loading notes...
              </div>
            ) : sortedNotes.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <p className="font-sans text-xs text-gray-400 mb-2">
                  {searchQuery
                    ? 'No notes match your search'
                    : 'No notes in this folder. Create one!'}
                </p>
                {!searchQuery && (
                  <button
                    onClick={onCreateNote}
                    className="font-sans text-[10px] text-accent hover:underline"
                  >
                    + Create your first note
                  </button>
                )}
              </div>
            ) : (
              <div>
                {sortedNotes.map((note) => (
                  <button
                    key={note.id}
                    onClick={() => onSelectNote(note.id)}
                    className={`w-full text-left px-4 py-2 border-b border-gray-50 transition-colors ${
                      selectedNoteId === note.id
                        ? 'bg-accent/5 border-l-2 border-l-accent'
                        : 'hover:bg-gray-50 border-l-2 border-l-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`font-sans text-xs truncate ${
                          selectedNoteId === note.id
                            ? 'text-primary font-medium'
                            : 'text-primary'
                        }`}
                      >
                        {getNoteDisplayTitle(note)}
                      </span>
                      <span
                        className={`font-sans text-[9px] px-1 py-0.5 rounded flex-shrink-0 ml-2 capitalize ${noteTypeBadgeClass(
                          note.note_type
                        )}`}
                      >
                        {note.note_type || 'general'}
                      </span>
                    </div>
                    <div className="font-sans text-[10px] text-gray-400 mt-0.5">
                      {formatDate(note.updated_at)}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
```

---

## Frontend: Navigation Link from Timeline

### File: `frontend/src/app/page.tsx`

Add a link to `/notes` in the desktop toolbar area of the header. This goes in the `<div className="hidden sm:flex gap-2 items-center">` section, alongside the existing buttons.

**Find the header's desktop toolbar (around line 720), and add this `Link` element after the search input's closing `</div>` (around line 794) and before the first action button:**

At the top of the file, add the import:

```typescript
import Link from 'next/link'
```

Then insert this element in the desktop toolbar, after the search input container:

```typescript
<Link
  href="/notes"
  className="flex items-center gap-1 px-2.5 py-1.5 font-sans text-xs text-secondary hover:text-primary hover:bg-gray-50 rounded border border-timeline transition-colors"
  title="Open Research Notes"
>
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
  Notes
</Link>
```

**Important:** Also add the link to the mobile menu so it is accessible on small screens. Find the mobile menu section and add a similar link there.

---

## Frontend: TipTap Editor Styles

### File: `frontend/src/app/globals.css`

Add these styles at the end of the file, after the existing `.scrollbar-hide` rules. These style the TipTap ProseMirror editor to match the design system fonts and spacing.

```css
/* ============================
   TipTap / ProseMirror Editor Styles
   ============================ */

.tiptap-editor-content {
  outline: none;
  min-height: 200px;
  font-family: 'Crimson Text', serif;
  font-size: 16px;
  line-height: 1.75;
  color: #1A1A1A;
}

/* Paragraph spacing */
.tiptap-editor-content p {
  margin-bottom: 0.75em;
}

/* Headings */
.tiptap-editor-content h1 {
  font-family: 'Crimson Text', serif;
  font-size: 1.75em;
  font-weight: 600;
  margin-top: 1.5em;
  margin-bottom: 0.5em;
  line-height: 1.3;
  color: #1A1A1A;
}

.tiptap-editor-content h2 {
  font-family: 'Crimson Text', serif;
  font-size: 1.375em;
  font-weight: 600;
  margin-top: 1.25em;
  margin-bottom: 0.5em;
  line-height: 1.35;
  color: #1A1A1A;
}

.tiptap-editor-content h3 {
  font-family: 'Crimson Text', serif;
  font-size: 1.125em;
  font-weight: 600;
  margin-top: 1em;
  margin-bottom: 0.4em;
  line-height: 1.4;
  color: #1A1A1A;
}

/* First heading has no top margin */
.tiptap-editor-content > h1:first-child,
.tiptap-editor-content > h2:first-child,
.tiptap-editor-content > h3:first-child {
  margin-top: 0;
}

/* Lists */
.tiptap-editor-content ul {
  list-style-type: disc;
  padding-left: 1.5em;
  margin-bottom: 0.75em;
}

.tiptap-editor-content ol {
  list-style-type: decimal;
  padding-left: 1.5em;
  margin-bottom: 0.75em;
}

.tiptap-editor-content li {
  margin-bottom: 0.25em;
}

.tiptap-editor-content li p {
  margin-bottom: 0.25em;
}

/* Nested lists */
.tiptap-editor-content ul ul,
.tiptap-editor-content ol ol,
.tiptap-editor-content ul ol,
.tiptap-editor-content ol ul {
  margin-top: 0.25em;
  margin-bottom: 0;
}

/* Blockquote */
.tiptap-editor-content blockquote {
  border-left: 3px solid #8B4513;
  padding-left: 1em;
  margin-left: 0;
  margin-bottom: 0.75em;
  color: #666666;
  font-style: italic;
}

/* Code block */
.tiptap-editor-content pre {
  background-color: #F5F5F0;
  border: 1px solid #E0E0E0;
  border-radius: 4px;
  padding: 0.75em 1em;
  margin-bottom: 0.75em;
  overflow-x: auto;
}

.tiptap-editor-content pre code {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.85em;
  line-height: 1.6;
  color: #1A1A1A;
  background: none;
  padding: 0;
}

/* Inline code */
.tiptap-editor-content code {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.85em;
  background-color: #F5F5F0;
  padding: 0.15em 0.3em;
  border-radius: 3px;
  color: #8B4513;
}

/* Horizontal rule */
.tiptap-editor-content hr {
  border: none;
  border-top: 1px solid #E0E0E0;
  margin: 1.5em 0;
}

/* Bold, italic, underline, strike */
.tiptap-editor-content strong {
  font-weight: 600;
}

.tiptap-editor-content em {
  font-style: italic;
}

.tiptap-editor-content u {
  text-decoration: underline;
}

.tiptap-editor-content s {
  text-decoration: line-through;
}

/* Placeholder styling */
.tiptap-editor-content.is-editor-empty::before {
  content: attr(data-placeholder);
  float: left;
  color: #C0C0C0;
  font-style: italic;
  pointer-events: none;
  height: 0;
}

/* ProseMirror selection */
.tiptap-editor-content .ProseMirror-selectednode {
  outline: 2px solid #8B4513;
  outline-offset: 2px;
}

/* Gapcursor (shows blinking cursor between block nodes) */
.tiptap-editor-content .ProseMirror-gapcursor {
  position: relative;
}

.tiptap-editor-content .ProseMirror-gapcursor::after {
  content: '';
  display: block;
  position: absolute;
  top: -2px;
  width: 20px;
  border-top: 1px solid #1A1A1A;
  animation: ProseMirror-cursor-blink 1.1s steps(2, start) infinite;
}

@keyframes ProseMirror-cursor-blink {
  to {
    visibility: hidden;
  }
}
```

---

## Verification Steps

After implementing all files above, verify the following:

1. **Install dependencies:**
   ```bash
   cd frontend && npm install
   ```
   Confirm no errors and that `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-placeholder`, `@tiptap/extension-underline`, and `@tiptap/pm` appear in `node_modules/`.

2. **Navigate to `/notes`:**
   Open `http://localhost:3010/notes` in the browser. Confirm you see the three-panel layout: left sidebar (260px), center area, and the right panel toggle button in the header.

3. **Back link works:**
   Click the left-arrow "Timeline" link in the top-left corner. Confirm it navigates back to `http://localhost:3010/` (the main canvas page).

4. **Timeline page has Notes link:**
   On the main canvas page, confirm there is a "Notes" link/button in the header toolbar that navigates to `/notes`.

5. **Folder sidebar displays:**
   The left sidebar should show "All Notes" button (placeholder until Plan 2 provides FolderTree). Click it to confirm it sets `selectedFolderId` to `null`.

6. **Create a note:**
   Click the "New" button in the notes list or the "Create Note" button in the empty state. A new note should appear in the notes list and the editor should activate.

7. **Rich text editing:**
   - Type text in the editor. Confirm the Crimson Text serif font is used.
   - Select text and click Bold (or press Ctrl+B). Confirm bold formatting.
   - Test Italic, Underline, Strikethrough.
   - Click H1, H2, H3 buttons. Confirm heading sizes.
   - Click Bullet List and Numbered List. Confirm list formatting.
   - Click Blockquote. Confirm the left-border accent style.
   - Click Code Block. Confirm monospace JetBrains Mono font and gray background.
   - Click Horizontal Rule. Confirm a horizontal line appears.
   - Test Undo/Redo buttons.

8. **Auto-save (debounced 1s):**
   Type in the editor and observe the save status indicator in the header. It should show "Unsaved" immediately, then "Saving..." after 1 second, then "Saved" once the API call completes.

9. **Manual save (Ctrl+S):**
   Press Ctrl+S (or Cmd+S on Mac). Confirm the note saves immediately (bypasses the 1-second debounce).

10. **Switch between notes:**
    Create a second note. Click between the two notes in the list. Confirm the editor content updates to reflect the selected note, and the title field updates.

11. **Search in notes list:**
    Type in the search input above the notes list. Confirm notes are filtered client-side by title and content.

12. **Sort notes:**
    Change the sort dropdown between "Last edited", "Created", and "Title". Confirm the list order changes.

13. **Delete a note:**
    Click the trash icon next to the note title. Confirm a confirmation dialog appears. Click OK. Confirm the note is removed from the list and the editor returns to the empty state.

14. **Navigate away and back:**
    Navigate to the timeline page, then back to `/notes`. Confirm the page loads correctly (note: state will reset since it is component state, not persisted -- this is expected).

15. **Mobile responsive:**
    Resize the browser to a narrow width. Confirm:
    - The sidebar collapses (toggle with hamburger button).
    - The right panel is hidden on mobile.
    - The layout remains usable.

16. **Backend filter works:**
    If Plan 1 and Plan 2 are implemented, create a folder, assign a note to it, and select that folder. Confirm only notes in that folder appear in the list.

---

## Dependencies

| Dependency | What it provides | Status |
|-----------|-----------------|--------|
| Plan 1 | `folder_id` column on `notes` table, migration applied | Must be done first |
| Plan 2 | `FolderTree` component for final left sidebar UX | Optional for first pass; required for final integration |

---

## Files Created / Modified Summary

### New Files (5)
- `frontend/src/app/notes/layout.tsx`
- `frontend/src/app/notes/page.tsx`
- `frontend/src/components/notes/RichTextEditor.tsx`
- `frontend/src/components/notes/EditorToolbar.tsx`
- `frontend/src/components/notes/NotesList.tsx`

### Modified Files (6)
- `backend/app/schemas/note.py` -- add `folder_id` to NoteCreate, NoteUpdate, Note
- `backend/app/routes/notes.py` -- add `folder_id` filter to GET endpoint
- `frontend/src/lib/api.ts` -- extend `notesApi.getAll` with `folderId` param
- `frontend/src/types/index.ts` -- add `folder_id` to Note, NoteCreate, NoteUpdate
- `frontend/src/app/globals.css` -- add TipTap/ProseMirror editor styles
- `frontend/src/app/page.tsx` -- add "Notes" navigation link in header
