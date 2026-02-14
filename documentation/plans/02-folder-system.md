# Plan 2: Folder System (Backend CRUD + Frontend Tree)

## Goal

Implement full folder CRUD on the backend and a nested folder tree component on the frontend so Stephanie can organize her research notes into hierarchical folders (e.g., Semester 1 > Pragmatism > James, Semester 1 > Augustine > Confessions).

**Depends on:** Plan 1 (Folder model and Alembic migration must already exist in the database)

**Integration note:** Backend CRUD work depends only on Plan 1. Full `/notes` page integration depends on Plan 3.

**Produces:** 2 new backend files, 2 modified backend files, 2 new frontend files, 2 modified frontend files

---

## Audit Notes (2026-02-13)

1. Define static routes like `/reorder` and `/tree` before `/{folder_id}` routes to avoid UUID parsing conflicts.
2. `unfiled` note counts must use `note.folder_id == null`, not `note.thinker_id == null`.
3. Use `Field(default_factory=list)` for Pydantic list fields to avoid mutable default pitfalls.

---

## 1. Backend: Pydantic Schemas

**File:** `backend/app/schemas/folder.py` (NEW)

```python
from pydantic import BaseModel, ConfigDict, Field, field_validator
from typing import Optional, List
from datetime import datetime
from uuid import UUID


class FolderBase(BaseModel):
    name: str
    parent_id: Optional[UUID] = None
    sort_order: Optional[int] = 0
    color: Optional[str] = None

    @field_validator('name')
    @classmethod
    def validate_name(cls, v):
        if not v or not v.strip():
            raise ValueError('Folder name cannot be empty')
        if len(v.strip()) < 1:
            raise ValueError('Folder name must be at least 1 character')
        return v.strip()


class FolderCreate(FolderBase):
    pass


class FolderUpdate(BaseModel):
    name: Optional[str] = None
    parent_id: Optional[UUID] = None
    sort_order: Optional[int] = None
    color: Optional[str] = None

    @field_validator('name')
    @classmethod
    def validate_name(cls, v):
        if v is not None:
            if not v or not v.strip():
                raise ValueError('Folder name cannot be empty')
            return v.strip()
        return v


class Folder(FolderBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    created_at: datetime
    updated_at: datetime


class FolderWithChildren(Folder):
    """Folder with nested children and note count for tree rendering."""
    model_config = ConfigDict(from_attributes=True)

    children: List['FolderWithChildren'] = Field(default_factory=list)
    note_count: int = 0


class FolderWithNotes(Folder):
    """Folder with its notes list for detail views."""
    model_config = ConfigDict(from_attributes=True)

    notes: List[dict] = Field(default_factory=list)  # Simplified note objects (id, title, updated_at)


class ReorderItem(BaseModel):
    """Single item in a batch reorder request."""
    id: UUID
    sort_order: int
    parent_id: Optional[UUID] = None


class ReorderRequest(BaseModel):
    """Batch reorder request body."""
    items: List[ReorderItem]


# Required for self-referencing model
FolderWithChildren.model_rebuild()
```

---

## 2. Backend: Routes

**File:** `backend/app/routes/folders.py` (NEW)

```python
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from uuid import UUID

from app.database import get_db
from app.models.folder import Folder
from app.models.note import Note
from app.schemas import folder as schemas

router = APIRouter(prefix="/api/folders", tags=["folders"])

# IMPORTANT ROUTING ORDER NOTE:
# Register static paths (/tree, /reorder) before dynamic /{folder_id} routes.
# Otherwise a request to /reorder can be parsed as folder_id="reorder" and fail with 422.


# ---------------------------------------------------------------------------
# Helper: build nested tree from flat folder list
# ---------------------------------------------------------------------------

def build_tree(
    folders: List[Folder],
    note_counts: dict[str, int],
) -> List[dict]:
    """
    Takes a flat list of SQLAlchemy Folder objects and a dict mapping
    folder_id -> note_count.  Returns a nested list of dicts suitable
    for serialisation to FolderWithChildren.
    """
    # Convert ORM objects to dicts
    folder_map: dict[str, dict] = {}
    for f in folders:
        fid = str(f.id)
        folder_map[fid] = {
            "id": f.id,
            "name": f.name,
            "parent_id": f.parent_id,
            "sort_order": f.sort_order or 0,
            "color": f.color,
            "created_at": f.created_at,
            "updated_at": f.updated_at,
            "children": [],
            "note_count": note_counts.get(fid, 0),
        }

    # Build parent -> children relationships
    roots: List[dict] = []
    for fid, node in folder_map.items():
        pid = str(node["parent_id"]) if node["parent_id"] else None
        if pid and pid in folder_map:
            folder_map[pid]["children"].append(node)
        else:
            roots.append(node)

    # Sort children at every level by sort_order, then name
    def sort_recursive(nodes: List[dict]):
        nodes.sort(key=lambda n: (n["sort_order"], n["name"]))
        for n in nodes:
            sort_recursive(n["children"])

    sort_recursive(roots)
    return roots


# ---------------------------------------------------------------------------
# Helper: validate no circular parent reference
# ---------------------------------------------------------------------------

def validate_no_circular_parent(
    db: Session,
    folder_id: UUID,
    new_parent_id: UUID,
) -> None:
    """
    Walk up the ancestor chain from new_parent_id.
    If we encounter folder_id, that would create a cycle.
    """
    current_id = new_parent_id
    visited = set()
    while current_id is not None:
        if current_id == folder_id:
            raise HTTPException(
                status_code=400,
                detail="Cannot move folder into its own descendant (circular reference)",
            )
        if current_id in visited:
            break  # Already-existing cycle in data; stop walking
        visited.add(current_id)
        parent = db.query(Folder).filter(Folder.id == current_id).first()
        if parent is None:
            break
        current_id = parent.parent_id


# ---------------------------------------------------------------------------
# POST /api/folders/  — Create folder
# ---------------------------------------------------------------------------

@router.post("/", response_model=schemas.Folder, status_code=201)
def create_folder(
    folder_data: schemas.FolderCreate,
    db: Session = Depends(get_db),
):
    # Validate parent exists if provided
    if folder_data.parent_id:
        parent = db.query(Folder).filter(Folder.id == folder_data.parent_id).first()
        if not parent:
            raise HTTPException(
                status_code=404,
                detail=f"Parent folder with id {folder_data.parent_id} not found",
            )

    db_folder = Folder(**folder_data.model_dump())
    db.add(db_folder)
    db.commit()
    db.refresh(db_folder)
    return db_folder


# ---------------------------------------------------------------------------
# GET /api/folders/  — List folders (flat), optional parent_id filter
# ---------------------------------------------------------------------------

@router.get("/", response_model=List[schemas.Folder])
def get_folders(
    parent_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
):
    query = db.query(Folder)

    if parent_id is not None:
        query = query.filter(Folder.parent_id == parent_id)

    folders = query.order_by(Folder.sort_order, Folder.name).all()
    return folders


# ---------------------------------------------------------------------------
# GET /api/folders/tree  — Full nested tree
# ---------------------------------------------------------------------------

@router.get("/tree", response_model=List[schemas.FolderWithChildren])
def get_folder_tree(db: Session = Depends(get_db)):
    # Fetch all folders in one query
    all_folders = db.query(Folder).all()

    # Compute note counts per folder in one query
    note_counts_raw = (
        db.query(Note.folder_id, func.count(Note.id))
        .filter(Note.folder_id.isnot(None))
        .group_by(Note.folder_id)
        .all()
    )
    note_counts = {str(fid): count for fid, count in note_counts_raw}

    return build_tree(all_folders, note_counts)


# ---------------------------------------------------------------------------
# GET /api/folders/{folder_id}  — Single folder with children + note_count
# ---------------------------------------------------------------------------

@router.get("/{folder_id}", response_model=schemas.FolderWithChildren)
def get_folder(folder_id: UUID, db: Session = Depends(get_db)):
    db_folder = db.query(Folder).filter(Folder.id == folder_id).first()
    if not db_folder:
        raise HTTPException(status_code=404, detail="Folder not found")

    # Get direct children
    children = (
        db.query(Folder)
        .filter(Folder.parent_id == folder_id)
        .order_by(Folder.sort_order, Folder.name)
        .all()
    )

    # Get note counts for this folder and its children
    folder_ids = [folder_id] + [c.id for c in children]
    note_counts_raw = (
        db.query(Note.folder_id, func.count(Note.id))
        .filter(Note.folder_id.in_(folder_ids))
        .group_by(Note.folder_id)
        .all()
    )
    note_counts = {str(fid): count for fid, count in note_counts_raw}

    return {
        "id": db_folder.id,
        "name": db_folder.name,
        "parent_id": db_folder.parent_id,
        "sort_order": db_folder.sort_order,
        "color": db_folder.color,
        "created_at": db_folder.created_at,
        "updated_at": db_folder.updated_at,
        "note_count": note_counts.get(str(folder_id), 0),
        "children": [
            {
                "id": c.id,
                "name": c.name,
                "parent_id": c.parent_id,
                "sort_order": c.sort_order,
                "color": c.color,
                "created_at": c.created_at,
                "updated_at": c.updated_at,
                "children": [],
                "note_count": note_counts.get(str(c.id), 0),
            }
            for c in children
        ],
    }


# ---------------------------------------------------------------------------
# PUT /api/folders/{folder_id}  — Update folder
# ---------------------------------------------------------------------------

@router.put("/{folder_id}", response_model=schemas.Folder)
def update_folder(
    folder_id: UUID,
    folder_update: schemas.FolderUpdate,
    db: Session = Depends(get_db),
):
    db_folder = db.query(Folder).filter(Folder.id == folder_id).first()
    if not db_folder:
        raise HTTPException(status_code=404, detail="Folder not found")

    update_data = folder_update.model_dump(exclude_unset=True)

    # If moving to a new parent, validate it exists and no circular ref
    if "parent_id" in update_data and update_data["parent_id"] is not None:
        new_parent_id = update_data["parent_id"]
        parent = db.query(Folder).filter(Folder.id == new_parent_id).first()
        if not parent:
            raise HTTPException(
                status_code=404,
                detail=f"Parent folder with id {new_parent_id} not found",
            )
        validate_no_circular_parent(db, folder_id, new_parent_id)

    for field, value in update_data.items():
        setattr(db_folder, field, value)

    db.commit()
    db.refresh(db_folder)
    return db_folder


# ---------------------------------------------------------------------------
# DELETE /api/folders/{folder_id}  — Delete folder
# ---------------------------------------------------------------------------

@router.delete("/{folder_id}", status_code=204)
def delete_folder(
    folder_id: UUID,
    move_notes_to: Optional[UUID] = Query(
        None,
        description="Folder ID to reassign notes to before deletion. "
                    "If omitted, notes become unfiled (folder_id=NULL).",
    ),
    db: Session = Depends(get_db),
):
    db_folder = db.query(Folder).filter(Folder.id == folder_id).first()
    if not db_folder:
        raise HTTPException(status_code=404, detail="Folder not found")

    # Validate destination folder exists if specified
    if move_notes_to is not None:
        dest = db.query(Folder).filter(Folder.id == move_notes_to).first()
        if not dest:
            raise HTTPException(
                status_code=404,
                detail=f"Destination folder with id {move_notes_to} not found",
            )

    # Reassign notes
    target_folder_id = move_notes_to  # None means unfiled
    db.query(Note).filter(Note.folder_id == folder_id).update(
        {"folder_id": target_folder_id},
        synchronize_session="fetch",
    )

    # Reparent child folders to this folder's parent (promote one level)
    db.query(Folder).filter(Folder.parent_id == folder_id).update(
        {"parent_id": db_folder.parent_id},
        synchronize_session="fetch",
    )

    db.delete(db_folder)
    db.commit()
    return None


# ---------------------------------------------------------------------------
# PUT /api/folders/reorder  — Batch update sort_order (and optionally parent_id)
# ---------------------------------------------------------------------------

@router.put("/reorder", response_model=List[schemas.Folder])
def reorder_folders(
    reorder: schemas.ReorderRequest,
    db: Session = Depends(get_db),
):
    updated = []
    for item in reorder.items:
        db_folder = db.query(Folder).filter(Folder.id == item.id).first()
        if not db_folder:
            raise HTTPException(
                status_code=404,
                detail=f"Folder with id {item.id} not found",
            )
        db_folder.sort_order = item.sort_order
        if item.parent_id is not None:
            # Validate no circular reference
            validate_no_circular_parent(db, item.id, item.parent_id)
            db_folder.parent_id = item.parent_id
        updated.append(db_folder)

    db.commit()
    for f in updated:
        db.refresh(f)
    return updated
```

---

## 3. Backend: Registration

### 3a. Add to `backend/app/schemas/__init__.py`

Add the following import block after the existing `note` imports:

```python
from app.schemas.folder import (
    FolderBase,
    FolderCreate,
    FolderUpdate,
    Folder,
    FolderWithChildren,
    FolderWithNotes,
    ReorderItem,
    ReorderRequest,
)
```

Add to the `__all__` list:

```python
    # Folder
    "FolderBase",
    "FolderCreate",
    "FolderUpdate",
    "Folder",
    "FolderWithChildren",
    "FolderWithNotes",
    "ReorderItem",
    "ReorderRequest",
```

### 3b. Add router to `backend/app/main.py`

In the import line, add `folders`:

```python
from app.routes import thinkers, connections, publications, quotes, tags, timelines, timeline_events, combined_timeline_views, institutions, notes, research_questions, ai, quiz, auth, folders
```

Below the existing `app.include_router(notes.router)` line, add:

```python
app.include_router(folders.router)
```

---

## 4. Frontend: Types

**File:** `frontend/src/types/index.ts` (MODIFY -- add after the Note-related types section)

Add the following interfaces at the end of the file, before the Quiz Types section:

```typescript
// Folder types for hierarchical note organization

export interface Folder {
  id: string
  name: string
  parent_id?: string | null
  sort_order?: number | null
  color?: string | null
  created_at: string
  updated_at: string
}

export interface FolderWithChildren extends Folder {
  children: FolderWithChildren[]
  note_count: number
}

export interface FolderCreate {
  name: string
  parent_id?: string | null
  sort_order?: number | null
  color?: string | null
}

export interface FolderUpdate {
  name?: string
  parent_id?: string | null
  sort_order?: number | null
  color?: string | null
}

export interface ReorderItem {
  id: string
  sort_order: number
  parent_id?: string | null
}
```

---

## 5. Frontend: API Client

**File:** `frontend/src/lib/api.ts` (MODIFY)

### 5a. Add imports

In the type import block at the top of the file, add:

```typescript
import type {
  // ... existing imports ...
  Folder,
  FolderWithChildren,
  FolderCreate,
  FolderUpdate,
  ReorderItem,
} from '@/types'
```

### 5b. Add foldersApi

Add after the `notesApi` definition and before the `researchQuestionsApi` definition:

```typescript
// Folders API (hierarchical note organization)
export const foldersApi = {
  getAll: async (parentId?: string): Promise<Folder[]> => {
    const params: Record<string, string> = {}
    if (parentId) params.parent_id = parentId
    const response = await api.get('/api/folders/', { params })
    return response.data
  },
  getOne: async (id: string): Promise<FolderWithChildren> => {
    const response = await api.get(`/api/folders/${id}`)
    return response.data
  },
  getTree: async (): Promise<FolderWithChildren[]> => {
    const response = await api.get('/api/folders/tree')
    return response.data
  },
  create: async (data: FolderCreate): Promise<Folder> => {
    const response = await api.post('/api/folders/', data)
    return response.data
  },
  update: async (id: string, data: FolderUpdate): Promise<Folder> => {
    const response = await api.put(`/api/folders/${id}`, data)
    return response.data
  },
  delete: async (id: string, moveNotesTo?: string): Promise<void> => {
    const params: Record<string, string> = {}
    if (moveNotesTo) params.move_notes_to = moveNotesTo
    await api.delete(`/api/folders/${id}`, { params })
  },
  reorder: async (items: ReorderItem[]): Promise<Folder[]> => {
    const response = await api.put('/api/folders/reorder', { items })
    return response.data
  },
}
```

---

## 6. Frontend: FolderTree Component

**File:** `frontend/src/components/notes/FolderTree.tsx` (NEW)

```tsx
'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { foldersApi, notesApi } from '@/lib/api'
import type { FolderWithChildren } from '@/types'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface FolderTreeProps {
  selectedFolderId: string | null  // null = "All Notes", "unfiled" = unfiled
  onSelectFolder: (folderId: string | null) => void
  onCreateNote?: (folderId: string | null) => void
}

// ---------------------------------------------------------------------------
// Context Menu
// ---------------------------------------------------------------------------

interface ContextMenuState {
  x: number
  y: number
  folderId: string
  folderName: string
}

// ---------------------------------------------------------------------------
// Folder colors
// ---------------------------------------------------------------------------

const FOLDER_COLORS = [
  { name: 'None', value: null },
  { name: 'Red', value: '#DC2626' },
  { name: 'Orange', value: '#EA580C' },
  { name: 'Amber', value: '#D97706' },
  { name: 'Green', value: '#16A34A' },
  { name: 'Blue', value: '#2563EB' },
  { name: 'Purple', value: '#9333EA' },
  { name: 'Pink', value: '#DB2777' },
]

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function FolderTree({ selectedFolderId, onSelectFolder, onCreateNote }: FolderTreeProps) {
  const queryClient = useQueryClient()
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [isCreatingRoot, setIsCreatingRoot] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [creatingSubfolderId, setCreatingSubfolderId] = useState<string | null>(null)
  const [subfolderName, setSubfolderName] = useState('')
  const [isCollapsed, setIsCollapsed] = useState(false)

  const contextMenuRef = useRef<HTMLDivElement>(null)
  const renameInputRef = useRef<HTMLInputElement>(null)
  const newFolderInputRef = useRef<HTMLInputElement>(null)
  const subfolderInputRef = useRef<HTMLInputElement>(null)

  // ---- Data fetching ----

  const { data: tree = [], isLoading } = useQuery({
    queryKey: ['folders-tree'],
    queryFn: foldersApi.getTree,
  })

  const { data: unfiledNotes = [] } = useQuery({
    queryKey: ['notes', { unfiled: true }],
    queryFn: () => notesApi.getAll(undefined, undefined),
    select: (notes) => notes.filter((n) => !n.folder_id),
    // This is a rough count; Plan 3 will refine this with folder_id filtering
  })

  // ---- Mutations ----

  const createMutation = useMutation({
    mutationFn: foldersApi.create,
    onSuccess: (newFolder) => {
      queryClient.invalidateQueries({ queryKey: ['folders-tree'] })
      // Auto-expand parent so the new folder is visible
      if (newFolder.parent_id) {
        setExpandedIds((prev) => new Set([...prev, String(newFolder.parent_id)]))
      }
      setIsCreatingRoot(false)
      setNewFolderName('')
      setCreatingSubfolderId(null)
      setSubfolderName('')
    },
  })

  const renameMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      foldersApi.update(id, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders-tree'] })
      setRenamingId(null)
      setRenameValue('')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => foldersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders-tree'] })
      queryClient.invalidateQueries({ queryKey: ['notes'] })
      // If deleted folder was selected, go to All Notes
      if (selectedFolderId && !tree.some((f) => findInTree(f, selectedFolderId))) {
        onSelectFolder(null)
      }
    },
  })

  const colorMutation = useMutation({
    mutationFn: ({ id, color }: { id: string; color: string | null }) =>
      foldersApi.update(id, { color }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders-tree'] })
    },
  })

  // ---- Helpers ----

  function findInTree(node: FolderWithChildren, id: string): boolean {
    if (String(node.id) === id) return true
    return node.children.some((c) => findInTree(c, id))
  }

  const toggleExpand = useCallback((folderId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(folderId)) {
        next.delete(folderId)
      } else {
        next.add(folderId)
      }
      return next
    })
  }, [])

  // ---- Close context menu on outside click ----

  useEffect(() => {
    if (!contextMenu) return
    const handler = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [contextMenu])

  // ---- Auto-focus rename / new-folder inputs ----

  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus()
      renameInputRef.current.select()
    }
  }, [renamingId])

  useEffect(() => {
    if (isCreatingRoot && newFolderInputRef.current) {
      newFolderInputRef.current.focus()
    }
  }, [isCreatingRoot])

  useEffect(() => {
    if (creatingSubfolderId && subfolderInputRef.current) {
      subfolderInputRef.current.focus()
    }
  }, [creatingSubfolderId])

  // ---- Context menu actions ----

  const handleContextMenu = (e: React.MouseEvent, folderId: string, folderName: string) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, folderId, folderName })
  }

  const handleRenameStart = () => {
    if (!contextMenu) return
    setRenamingId(contextMenu.folderId)
    setRenameValue(contextMenu.folderName)
    setContextMenu(null)
  }

  const handleRenameSubmit = () => {
    if (renamingId && renameValue.trim()) {
      renameMutation.mutate({ id: renamingId, name: renameValue.trim() })
    } else {
      setRenamingId(null)
    }
  }

  const handleNewSubfolder = () => {
    if (!contextMenu) return
    const parentId = contextMenu.folderId
    setCreatingSubfolderId(parentId)
    setSubfolderName('')
    // Make sure parent is expanded
    setExpandedIds((prev) => new Set([...prev, parentId]))
    setContextMenu(null)
  }

  const handleSubfolderSubmit = () => {
    if (creatingSubfolderId && subfolderName.trim()) {
      createMutation.mutate({
        name: subfolderName.trim(),
        parent_id: creatingSubfolderId,
      })
    } else {
      setCreatingSubfolderId(null)
      setSubfolderName('')
    }
  }

  const handleDelete = () => {
    if (!contextMenu) return
    const confirmed = window.confirm(
      `Delete folder "${contextMenu.folderName}"? Notes inside will become unfiled.`
    )
    if (confirmed) {
      deleteMutation.mutate(contextMenu.folderId)
    }
    setContextMenu(null)
  }

  const handleColorChange = (color: string | null) => {
    if (!contextMenu) return
    colorMutation.mutate({ id: contextMenu.folderId, color })
    setContextMenu(null)
  }

  const handleNewRootFolder = () => {
    if (newFolderName.trim()) {
      createMutation.mutate({ name: newFolderName.trim() })
    } else {
      setIsCreatingRoot(false)
      setNewFolderName('')
    }
  }

  // ---- Collapsed sidebar ----

  if (isCollapsed) {
    return (
      <div className="w-10 border-r border-timeline bg-background flex flex-col items-center py-3">
        <button
          onClick={() => setIsCollapsed(false)}
          className="text-gray-400 hover:text-primary transition-colors"
          aria-label="Expand folder sidebar"
          title="Expand folders"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
    )
  }

  // ---- Render ----

  return (
    <div className="w-60 border-r border-timeline bg-background flex flex-col h-full select-none">
      {/* Header */}
      <div className="px-3 py-3 border-b border-timeline flex items-center justify-between">
        <h3 className="text-sm font-sans font-semibold text-primary uppercase tracking-wide">
          Folders
        </h3>
        <button
          onClick={() => setIsCollapsed(true)}
          className="text-gray-400 hover:text-primary transition-colors"
          aria-label="Collapse folder sidebar"
          title="Collapse folders"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      {/* Scrollable tree area */}
      <div className="flex-1 overflow-y-auto py-2">
        {/* Virtual folders */}
        <button
          onClick={() => onSelectFolder(null)}
          className={`w-full text-left px-3 py-1.5 text-sm font-sans flex items-center gap-2 transition-colors ${
            selectedFolderId === null
              ? 'bg-accent bg-opacity-10 text-accent font-medium'
              : 'text-primary hover:bg-gray-100'
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
          </svg>
          <span className="truncate">All Notes</span>
        </button>

        <button
          onClick={() => onSelectFolder('unfiled')}
          className={`w-full text-left px-3 py-1.5 text-sm font-sans flex items-center gap-2 transition-colors ${
            selectedFolderId === 'unfiled'
              ? 'bg-accent bg-opacity-10 text-accent font-medium'
              : 'text-gray-500 hover:bg-gray-100'
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
          </svg>
          <span className="truncate">Unfiled Notes</span>
          {unfiledNotes.length > 0 && (
            <span className="ml-auto text-xs text-gray-400 font-mono">
              {unfiledNotes.length}
            </span>
          )}
        </button>

        {/* Divider */}
        <div className="mx-3 my-2 border-t border-timeline" />

        {/* Loading state */}
        {isLoading && (
          <div className="px-3 py-2 text-sm text-gray-400 font-sans">Loading folders...</div>
        )}

        {/* Folder tree */}
        {tree.map((folder) => (
          <FolderNode
            key={String(folder.id)}
            folder={folder}
            depth={0}
            selectedFolderId={selectedFolderId}
            expandedIds={expandedIds}
            renamingId={renamingId}
            renameValue={renameValue}
            renameInputRef={renameInputRef}
            creatingSubfolderId={creatingSubfolderId}
            subfolderName={subfolderName}
            subfolderInputRef={subfolderInputRef}
            onSelect={onSelectFolder}
            onToggleExpand={toggleExpand}
            onContextMenu={handleContextMenu}
            onRenameChange={setRenameValue}
            onRenameSubmit={handleRenameSubmit}
            onRenameCancel={() => setRenamingId(null)}
            onSubfolderNameChange={setSubfolderName}
            onSubfolderSubmit={handleSubfolderSubmit}
            onSubfolderCancel={() => {
              setCreatingSubfolderId(null)
              setSubfolderName('')
            }}
          />
        ))}

        {/* Inline new root folder input */}
        {isCreatingRoot && (
          <div className="px-3 py-1">
            <input
              ref={newFolderInputRef}
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleNewRootFolder()
                if (e.key === 'Escape') {
                  setIsCreatingRoot(false)
                  setNewFolderName('')
                }
              }}
              onBlur={handleNewRootFolder}
              placeholder="Folder name..."
              className="w-full px-2 py-1 text-sm border border-accent rounded font-sans focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
        )}
      </div>

      {/* Footer: New Folder button */}
      <div className="px-3 py-2 border-t border-timeline">
        <button
          onClick={() => setIsCreatingRoot(true)}
          className="w-full text-left text-sm font-sans text-gray-500 hover:text-accent flex items-center gap-2 py-1 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          New Folder
        </button>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed z-50 bg-white border border-timeline rounded shadow-lg py-1 min-w-[180px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            onClick={handleNewSubfolder}
            className="w-full text-left px-4 py-1.5 text-sm font-sans hover:bg-gray-100 transition-colors"
          >
            New Subfolder
          </button>
          <button
            onClick={handleRenameStart}
            className="w-full text-left px-4 py-1.5 text-sm font-sans hover:bg-gray-100 transition-colors"
          >
            Rename
          </button>
          <div className="mx-2 my-1 border-t border-timeline" />
          <div className="px-4 py-1.5">
            <span className="text-xs font-sans text-gray-400 uppercase tracking-wide">Color</span>
            <div className="flex gap-1.5 mt-1.5">
              {FOLDER_COLORS.map((c) => (
                <button
                  key={c.name}
                  onClick={() => handleColorChange(c.value)}
                  title={c.name}
                  className={`w-5 h-5 rounded-full border transition-transform hover:scale-110 ${
                    c.value === null
                      ? 'bg-gray-200 border-gray-300'
                      : 'border-transparent'
                  }`}
                  style={c.value ? { backgroundColor: c.value } : undefined}
                />
              ))}
            </div>
          </div>
          <div className="mx-2 my-1 border-t border-timeline" />
          <button
            onClick={handleDelete}
            className="w-full text-left px-4 py-1.5 text-sm font-sans text-red-600 hover:bg-red-50 transition-colors"
          >
            Delete Folder
          </button>
        </div>
      )}
    </div>
  )
}


// ---------------------------------------------------------------------------
// FolderNode — Recursive sub-component
// ---------------------------------------------------------------------------

interface FolderNodeProps {
  folder: FolderWithChildren
  depth: number
  selectedFolderId: string | null
  expandedIds: Set<string>
  renamingId: string | null
  renameValue: string
  renameInputRef: React.RefObject<HTMLInputElement | null>
  creatingSubfolderId: string | null
  subfolderName: string
  subfolderInputRef: React.RefObject<HTMLInputElement | null>
  onSelect: (folderId: string) => void
  onToggleExpand: (folderId: string) => void
  onContextMenu: (e: React.MouseEvent, folderId: string, folderName: string) => void
  onRenameChange: (value: string) => void
  onRenameSubmit: () => void
  onRenameCancel: () => void
  onSubfolderNameChange: (value: string) => void
  onSubfolderSubmit: () => void
  onSubfolderCancel: () => void
}

function FolderNode({
  folder,
  depth,
  selectedFolderId,
  expandedIds,
  renamingId,
  renameValue,
  renameInputRef,
  creatingSubfolderId,
  subfolderName,
  subfolderInputRef,
  onSelect,
  onToggleExpand,
  onContextMenu,
  onRenameChange,
  onRenameSubmit,
  onRenameCancel,
  onSubfolderNameChange,
  onSubfolderSubmit,
  onSubfolderCancel,
}: FolderNodeProps) {
  const folderId = String(folder.id)
  const isExpanded = expandedIds.has(folderId)
  const isSelected = selectedFolderId === folderId
  const isRenaming = renamingId === folderId
  const hasChildren = folder.children.length > 0
  const isCreatingSubfolder = creatingSubfolderId === folderId

  const paddingLeft = 12 + depth * 16  // 12px base + 16px per level

  return (
    <div>
      {/* Folder row */}
      <div
        className={`flex items-center gap-1 py-1.5 pr-2 cursor-pointer transition-colors ${
          isSelected
            ? 'bg-accent bg-opacity-10 text-accent'
            : 'text-primary hover:bg-gray-100'
        }`}
        style={{ paddingLeft }}
        onClick={() => onSelect(folderId)}
        onContextMenu={(e) => onContextMenu(e, folderId, folder.name)}
        onDoubleClick={() => {
          // Double-click toggles expand/collapse for now.
          // Rename remains in the context menu to keep interactions deterministic.
          if (hasChildren) onToggleExpand(folderId)
        }}
      >
        {/* Expand/collapse chevron */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            onToggleExpand(folderId)
          }}
          className={`flex-shrink-0 w-4 h-4 flex items-center justify-center transition-transform ${
            hasChildren ? 'text-gray-400 hover:text-gray-600' : 'invisible'
          }`}
          aria-label={isExpanded ? 'Collapse folder' : 'Expand folder'}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={`h-3 w-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
          </svg>
        </button>

        {/* Folder icon */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4 flex-shrink-0"
          viewBox="0 0 20 20"
          fill={folder.color || 'currentColor'}
          style={folder.color ? { color: folder.color } : undefined}
        >
          {isExpanded ? (
            <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1H8a3 3 0 00-3 3v1.5a1.5 1.5 0 01-3 0V6z" clipRule="evenodd" />
          ) : (
            <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
          )}
        </svg>

        {/* Name or rename input */}
        {isRenaming ? (
          <input
            ref={renameInputRef}
            type="text"
            value={renameValue}
            onChange={(e) => onRenameChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onRenameSubmit()
              if (e.key === 'Escape') onRenameCancel()
            }}
            onBlur={onRenameSubmit}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 min-w-0 px-1 py-0 text-sm border border-accent rounded font-sans focus:outline-none focus:ring-1 focus:ring-accent"
          />
        ) : (
          <span className="flex-1 min-w-0 truncate text-sm font-sans">
            {folder.name}
          </span>
        )}

        {/* Note count badge */}
        {folder.note_count > 0 && !isRenaming && (
          <span className="flex-shrink-0 text-xs text-gray-400 font-mono ml-auto">
            {folder.note_count}
          </span>
        )}
      </div>

      {/* Children (if expanded) */}
      {isExpanded && (
        <>
          {folder.children.map((child) => (
            <FolderNode
              key={String(child.id)}
              folder={child}
              depth={depth + 1}
              selectedFolderId={selectedFolderId}
              expandedIds={expandedIds}
              renamingId={renamingId}
              renameValue={renameValue}
              renameInputRef={renameInputRef}
              creatingSubfolderId={creatingSubfolderId}
              subfolderName={subfolderName}
              subfolderInputRef={subfolderInputRef}
              onSelect={onSelect}
              onToggleExpand={onToggleExpand}
              onContextMenu={onContextMenu}
              onRenameChange={onRenameChange}
              onRenameSubmit={onRenameSubmit}
              onRenameCancel={onRenameCancel}
              onSubfolderNameChange={onSubfolderNameChange}
              onSubfolderSubmit={onSubfolderSubmit}
              onSubfolderCancel={onSubfolderCancel}
            />
          ))}

          {/* Inline subfolder creation input */}
          {isCreatingSubfolder && (
            <div style={{ paddingLeft: paddingLeft + 16 }} className="py-1 pr-2">
              <input
                ref={subfolderInputRef}
                type="text"
                value={subfolderName}
                onChange={(e) => onSubfolderNameChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onSubfolderSubmit()
                  if (e.key === 'Escape') onSubfolderCancel()
                }}
                onBlur={onSubfolderSubmit}
                placeholder="Subfolder name..."
                className="w-full px-2 py-1 text-sm border border-accent rounded font-sans focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}
```

---

## 7. Frontend: CreateFolderDialog Component

**File:** `frontend/src/components/notes/CreateFolderDialog.tsx` (NEW)

```tsx
'use client'

import { useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { foldersApi } from '@/lib/api'
import { Modal, ModalFooter, ModalButton, ModalError } from '@/components/Modal'
import { z } from 'zod'
import type { FolderCreate, FolderWithChildren } from '@/types'

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const folderSchema = z.object({
  name: z.string().min(1, 'Folder name is required').max(200, 'Name too long'),
  parent_id: z.string().nullable().optional(),
})

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CreateFolderDialogProps {
  isOpen: boolean
  onClose: () => void
  defaultParentId?: string | null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Flatten a tree into a list of { id, name, depth } for the dropdown. */
function flattenTree(
  nodes: FolderWithChildren[],
  depth: number = 0
): { id: string; name: string; depth: number }[] {
  const result: { id: string; name: string; depth: number }[] = []
  for (const node of nodes) {
    result.push({ id: String(node.id), name: node.name, depth })
    if (node.children.length > 0) {
      result.push(...flattenTree(node.children, depth + 1))
    }
  }
  return result
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CreateFolderDialog({ isOpen, onClose, defaultParentId }: CreateFolderDialogProps) {
  const queryClient = useQueryClient()

  const [name, setName] = useState('')
  const [parentId, setParentId] = useState<string | null>(defaultParentId || null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const { data: tree = [] } = useQuery({
    queryKey: ['folders-tree'],
    queryFn: foldersApi.getTree,
    enabled: isOpen,
  })

  const flatFolders = flattenTree(tree)

  const createMutation = useMutation({
    mutationFn: foldersApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders-tree'] })
      onClose()
      resetForm()
    },
  })

  const resetForm = () => {
    setName('')
    setParentId(defaultParentId || null)
    setErrors({})
  }

  // Reset when modal opens
  useEffect(() => {
    if (isOpen) {
      resetForm()
      if (defaultParentId) setParentId(defaultParentId)
    }
  }, [isOpen, defaultParentId])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})

    try {
      const validated = folderSchema.parse({ name, parent_id: parentId })
      const payload: FolderCreate = {
        name: validated.name,
        parent_id: validated.parent_id || null,
      }
      createMutation.mutate(payload)
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {}
        error.errors.forEach((err) => {
          if (err.path[0]) newErrors[err.path[0].toString()] = err.message
        })
        setErrors(newErrors)
      }
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Folder" maxWidth="sm">
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        {/* Folder name */}
        <div>
          <label className="block text-sm font-sans font-medium text-primary mb-1">
            Folder Name *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border border-timeline rounded font-sans focus:outline-none focus:ring-2 focus:ring-accent"
            placeholder="e.g., Pragmatism"
          />
          {errors.name && <p className="text-red-600 text-sm mt-1">{errors.name}</p>}
        </div>

        {/* Parent folder */}
        <div>
          <label className="block text-sm font-sans font-medium text-primary mb-1">
            Parent Folder
          </label>
          <select
            value={parentId || ''}
            onChange={(e) => setParentId(e.target.value || null)}
            className="w-full px-3 py-2 border border-timeline rounded font-sans focus:outline-none focus:ring-2 focus:ring-accent bg-white"
          >
            <option value="">Root (no parent)</option>
            {flatFolders.map((f) => (
              <option key={f.id} value={f.id}>
                {'  '.repeat(f.depth)}{f.depth > 0 ? '└ ' : ''}{f.name}
              </option>
            ))}
          </select>
        </div>

        <ModalError
          error={createMutation.error as Error | null}
          fallbackMessage="Failed to create folder. Please try again."
        />

        <ModalFooter>
          <ModalButton onClick={() => { onClose(); resetForm() }}>Cancel</ModalButton>
          <ModalButton
            type="submit"
            variant="primary"
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? 'Creating...' : 'Create Folder'}
          </ModalButton>
        </ModalFooter>
      </form>
    </Modal>
  )
}
```

---

## 8. Verification Steps

### 8.1 Backend Verification (via Swagger at /docs or curl)

**Step 1 — Create root folders:**

```bash
curl -X POST http://localhost:8010/api/folders/ \
  -H "Content-Type: application/json" \
  -d '{"name": "Semester 1"}'

# Save the returned id as SEMESTER1_ID

curl -X POST http://localhost:8010/api/folders/ \
  -H "Content-Type: application/json" \
  -d '{"name": "Semester 2"}'
```

**Step 2 — Create nested folders:**

```bash
curl -X POST http://localhost:8010/api/folders/ \
  -H "Content-Type: application/json" \
  -d '{"name": "Pragmatism", "parent_id": "<SEMESTER1_ID>"}'

curl -X POST http://localhost:8010/api/folders/ \
  -H "Content-Type: application/json" \
  -d '{"name": "Augustine", "parent_id": "<SEMESTER1_ID>"}'
```

**Step 3 — Retrieve tree:**

```bash
curl http://localhost:8010/api/folders/tree
```

Expected: nested JSON with `Semester 1 > [Pragmatism, Augustine]` and `Semester 2` at root.

**Step 4 — Move folder (change parent_id):**

```bash
curl -X PUT http://localhost:8010/api/folders/<AUGUSTINE_ID> \
  -H "Content-Type: application/json" \
  -d '{"parent_id": "<SEMESTER2_ID>"}'
```

Verify tree now has Augustine under Semester 2.

**Step 5 — Delete folder with notes reassignment:**

```bash
# First create a note in the Pragmatism folder (assumes Plan 1 added folder_id to notes)
# Then delete Pragmatism and move notes to Semester 1:
curl -X DELETE "http://localhost:8010/api/folders/<PRAGMATISM_ID>?move_notes_to=<SEMESTER1_ID>"
```

Verify the note now has `folder_id = <SEMESTER1_ID>`.

**Step 6 — Reorder folders:**

```bash
curl -X PUT http://localhost:8010/api/folders/reorder \
  -H "Content-Type: application/json" \
  -d '{"items": [{"id": "<SEMESTER2_ID>", "sort_order": 0}, {"id": "<SEMESTER1_ID>", "sort_order": 1}]}'
```

Verify tree order changed.

**Step 7 — Circular reference prevention:**

```bash
# Try to make Semester 1 a child of Pragmatism (which is a child of Semester 1)
curl -X PUT http://localhost:8010/api/folders/<SEMESTER1_ID> \
  -H "Content-Type: application/json" \
  -d '{"parent_id": "<PRAGMATISM_ID>"}'
```

Expected: 400 error "Cannot move folder into its own descendant (circular reference)".

### 8.2 Frontend Verification

1. Navigate to the notes page (created in Plan 3; for now, the FolderTree can be tested in isolation by importing it into any page).
2. Folder tree renders with "All Notes" and "Unfiled Notes" virtual folders at top.
3. Click "New Folder" at bottom - inline input appears, type name, press Enter.
4. Right-click a folder - context menu appears with New Subfolder, Rename, Color, Delete options.
5. Click "New Subfolder" - child input appears under the folder.
6. Click a folder - it highlights with accent background color.
7. Click chevron - folder expands/collapses to show/hide children.
8. Note count badges appear next to folders that contain notes.
9. Collapse toggle in header hides the sidebar to a thin strip.

---

## 9. File Summary

| Action | File | Description |
|--------|------|-------------|
| CREATE | `backend/app/schemas/folder.py` | Pydantic schemas for Folder CRUD |
| CREATE | `backend/app/routes/folders.py` | FastAPI routes with tree builder |
| MODIFY | `backend/app/schemas/__init__.py` | Register folder schemas |
| MODIFY | `backend/app/main.py` | Register folders router |
| MODIFY | `frontend/src/types/index.ts` | Add Folder TypeScript interfaces |
| MODIFY | `frontend/src/lib/api.ts` | Add foldersApi client |
| CREATE | `frontend/src/components/notes/FolderTree.tsx` | Folder tree sidebar component |
| CREATE | `frontend/src/components/notes/CreateFolderDialog.tsx` | Modal for creating folders |

---

## 10. Dependencies

- **Plan 1 must be complete.** Specifically:
  - The `folders` table must exist in the database (via Alembic migration).
  - The `Folder` SQLAlchemy model must exist at `backend/app/models/folder.py` with columns: `id`, `name`, `parent_id`, `sort_order`, `color`, `created_at`, `updated_at`.
  - The `notes` table must have a `folder_id` foreign key column (added in Plan 1's migration).
  - The `Note` model must have the `folder_id` column and `folder` relationship.

- **Plan 3 is required for full page integration.** The backend APIs and FolderTree can be built/tested before Plan 3, but final `/notes` integration depends on Plan 3's page shell.
