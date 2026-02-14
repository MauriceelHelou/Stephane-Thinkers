'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useDroppable, useDraggable } from '@dnd-kit/core'
import { foldersApi, notesApi } from '@/lib/api'
import type { FolderWithChildren } from '@/types'

interface FolderTreeProps {
  selectedFolderId: string | null
  onSelectFolder: (folderId: string | null) => void
  onCreateNote?: (folderId: string | null) => void
  showArchived: boolean
  onToggleShowArchived: (show: boolean) => void
}

function DragHandle({ id, data }: { id: string; data: Record<string, unknown> }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id, data })

  return (
    <span
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 text-xs select-none ${
        isDragging ? 'opacity-50' : ''
      }`}
      title="Drag to move"
    >
      ⠿
    </span>
  )
}

function FolderNode({
  node,
  level,
  selectedFolderId,
  onSelectFolder,
  onCreateNote,
  onCreateSubfolder,
  onArchive,
  onUnarchive,
}: {
  node: FolderWithChildren
  level: number
  selectedFolderId: string | null
  onSelectFolder: (folderId: string) => void
  onCreateNote?: (folderId: string) => void
  onCreateSubfolder?: (parentId: string, name: string) => void
  onArchive?: (folderId: string) => void
  onUnarchive?: (folderId: string) => void
}) {
  const [expanded, setExpanded] = useState(true)
  const [showSubfolderInput, setShowSubfolderInput] = useState(false)
  const [subfolderName, setSubfolderName] = useState('')

  const isArchived = node.is_archived ?? false

  const { isOver, setNodeRef: setDropRef } = useDroppable({
    id: `droppable-folder-${node.id}`,
    data: { type: 'folder', id: node.id, isArchived },
    disabled: isArchived,
  })

  const handleCreateSubfolder = () => {
    const name = subfolderName.trim()
    if (name && onCreateSubfolder) {
      onCreateSubfolder(node.id, name)
      setSubfolderName('')
      setShowSubfolderInput(false)
      setExpanded(true)
    }
  }

  return (
    <div className="group" ref={setDropRef}>
      <div
        className={`flex items-center gap-1 rounded transition-all ${
          isOver && !isArchived ? 'ring-2 ring-accent bg-accent/5' : ''
        } ${isArchived ? 'opacity-50' : ''}`}
      >
        <DragHandle
          id={`folder-${node.id}`}
          data={{ type: 'folder', id: node.id, name: node.name }}
        />

        {node.children.length > 0 ? (
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="text-xs text-secondary w-4"
          >
            {expanded ? '▾' : '▸'}
          </button>
        ) : (
          <span className="w-4" />
        )}

        <button
          type="button"
          onClick={() => onSelectFolder(node.id)}
          className={`flex-1 text-left px-2 py-1 rounded text-xs font-sans transition-colors ${
            isArchived ? 'italic ' : ''
          }${
            selectedFolderId === node.id
              ? 'bg-accent/10 text-accent font-medium'
              : 'text-secondary hover:bg-gray-50 hover:text-primary'
          }`}
          style={{ marginLeft: level * 8 }}
        >
          {node.name}
          <span className="ml-1 text-[10px] text-gray-400">({node.note_count})</span>
        </button>

        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {!isArchived && onCreateSubfolder && (
            <button
              type="button"
              onClick={() => setShowSubfolderInput((prev) => !prev)}
              className="text-[10px] px-1 text-gray-400 hover:text-accent hover:bg-gray-50 rounded"
              title="Add subfolder"
            >
              +
            </button>
          )}

          {!isArchived && onCreateNote && (
            <button
              type="button"
              onClick={() => onCreateNote(node.id)}
              className="text-[10px] px-1 text-gray-400 hover:text-accent hover:bg-gray-50 rounded"
              title="Add note"
            >
              +N
            </button>
          )}

          {!isArchived && onArchive && (
            <button
              type="button"
              onClick={() => onArchive(node.id)}
              className="text-[10px] px-1 text-gray-400 hover:text-orange-500 hover:bg-gray-50 rounded"
              title="Archive folder"
            >
              A
            </button>
          )}

          {isArchived && onUnarchive && (
            <button
              type="button"
              onClick={() => onUnarchive(node.id)}
              className="text-[10px] px-1 text-gray-400 hover:text-green-600 hover:bg-gray-50 rounded"
              title="Unarchive folder"
            >
              U
            </button>
          )}
        </div>
      </div>

      {showSubfolderInput && (
        <div className="flex items-center gap-1 mt-1" style={{ marginLeft: (level + 1) * 8 + 16 }}>
          <input
            type="text"
            value={subfolderName}
            onChange={(e) => setSubfolderName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateSubfolder()
              if (e.key === 'Escape') {
                setShowSubfolderInput(false)
                setSubfolderName('')
              }
            }}
            placeholder="Subfolder name"
            className="flex-1 px-2 py-0.5 text-xs font-sans border border-timeline rounded"
            autoFocus
          />
          <button
            type="button"
            onClick={handleCreateSubfolder}
            className="text-[10px] px-1 py-0.5 text-accent hover:text-accent/80"
          >
            OK
          </button>
          <button
            type="button"
            onClick={() => {
              setShowSubfolderInput(false)
              setSubfolderName('')
            }}
            className="text-[10px] px-1 py-0.5 text-gray-400 hover:text-gray-600"
          >
            X
          </button>
        </div>
      )}

      {expanded && node.children.length > 0 && (
        <div className="mt-0.5 space-y-0.5">
          {node.children.map((child) => (
            <FolderNode
              key={child.id}
              node={child}
              level={level + 1}
              selectedFolderId={selectedFolderId}
              onSelectFolder={onSelectFolder}
              onCreateNote={onCreateNote}
              onCreateSubfolder={onCreateSubfolder}
              onArchive={onArchive}
              onUnarchive={onUnarchive}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function FolderTree({
  selectedFolderId,
  onSelectFolder,
  onCreateNote,
  showArchived,
  onToggleShowArchived,
}: FolderTreeProps) {
  const queryClient = useQueryClient()
  const [newFolderName, setNewFolderName] = useState('')

  const { data: folderTree = [], isLoading } = useQuery({
    queryKey: ['folder-tree', { includeArchived: showArchived }],
    queryFn: () => foldersApi.getTree(showArchived || undefined),
  })

  const { data: unfiledCount = 0 } = useQuery({
    queryKey: ['notes-unfiled-count'],
    queryFn: async () => {
      const notes = await notesApi.getAll()
      return notes.filter((note) => !note.folder_id).length
    },
  })

  const createFolderMutation = useMutation({
    mutationFn: (data: { name: string; parent_id?: string | null }) => foldersApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folder-tree'] })
      setNewFolderName('')
    },
  })

  const archiveMutation = useMutation({
    mutationFn: (id: string) => foldersApi.archive(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folder-tree'] })
      queryClient.invalidateQueries({ queryKey: ['notes'] })
      queryClient.invalidateQueries({ queryKey: ['notes-unfiled-count'] })
    },
  })

  const unarchiveMutation = useMutation({
    mutationFn: (id: string) => foldersApi.unarchive(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folder-tree'] })
      queryClient.invalidateQueries({ queryKey: ['notes'] })
      queryClient.invalidateQueries({ queryKey: ['notes-unfiled-count'] })
    },
  })

  const submitNewFolder = () => {
    const name = newFolderName.trim()
    if (!name) return
    createFolderMutation.mutate({ name })
  }

  const handleCreateSubfolder = (parentId: string, name: string) => {
    createFolderMutation.mutate({ name, parent_id: parentId })
  }

  // Root-level drop zone
  const { isOver: isOverRoot, setNodeRef: setRootDropRef } = useDroppable({
    id: 'droppable-root',
    data: { type: 'root' },
  })

  // Unfiled drop zone
  const { isOver: isOverUnfiled, setNodeRef: setUnfiledDropRef } = useDroppable({
    id: 'droppable-unfiled',
    data: { type: 'unfiled' },
  })

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => onSelectFolder(null)}
        className={`w-full text-left px-2 py-1.5 rounded text-xs font-sans transition-colors ${
          selectedFolderId === null
            ? 'bg-accent/10 text-accent font-medium'
            : 'text-secondary hover:bg-gray-50 hover:text-primary'
        }`}
      >
        All Notes
      </button>

      <div ref={setUnfiledDropRef}>
        <button
          type="button"
          onClick={() => onSelectFolder('unfiled')}
          className={`w-full text-left px-2 py-1.5 rounded text-xs font-sans transition-colors ${
            isOverUnfiled ? 'ring-2 ring-accent bg-accent/5' : ''
          } ${
            selectedFolderId === 'unfiled'
              ? 'bg-accent/10 text-accent font-medium'
              : 'text-secondary hover:bg-gray-50 hover:text-primary'
          }`}
        >
          Unfiled <span className="text-[10px] text-gray-400">({unfiledCount})</span>
        </button>
      </div>

      <div
        ref={setRootDropRef}
        className={`py-1 border border-dashed rounded transition-all ${
          isOverRoot ? 'border-accent bg-accent/5 text-accent' : 'border-transparent'
        }`}
      >
        {isOverRoot && (
          <p className="text-[10px] text-center text-accent font-sans">Move to root</p>
        )}
      </div>

      <div className="pt-1 pb-2 border-b border-gray-100">
        <div className="flex items-center gap-1">
          <input
            type="text"
            value={newFolderName}
            onChange={(event) => setNewFolderName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') submitNewFolder()
            }}
            className="flex-1 px-2 py-1 text-xs font-sans border border-timeline rounded"
            placeholder="New folder"
          />
          <button
            type="button"
            onClick={submitNewFolder}
            className="px-2 py-1 text-xs font-sans border border-timeline rounded hover:bg-gray-50"
          >
            Add
          </button>
        </div>
      </div>

      {isLoading ? (
        <p className="px-2 py-1 text-xs text-secondary font-sans">Loading folders...</p>
      ) : (
        <div className="space-y-0.5">
          {folderTree.map((folder) => (
            <FolderNode
              key={folder.id}
              node={folder}
              level={0}
              selectedFolderId={selectedFolderId}
              onSelectFolder={(folderId) => onSelectFolder(folderId)}
              onCreateNote={onCreateNote as ((folderId: string) => void) | undefined}
              onCreateSubfolder={handleCreateSubfolder}
              onArchive={(id) => archiveMutation.mutate(id)}
              onUnarchive={(id) => unarchiveMutation.mutate(id)}
            />
          ))}
        </div>
      )}

      <div className="pt-2 mt-2 border-t border-gray-100">
        <label className="flex items-center gap-2 text-[10px] font-sans text-secondary cursor-pointer">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => onToggleShowArchived(e.target.checked)}
            className="rounded border-gray-300 text-accent focus:ring-accent"
          />
          Show archived
        </label>
      </div>
    </div>
  )
}
