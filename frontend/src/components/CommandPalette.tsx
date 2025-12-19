'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { Modal } from './Modal'

export interface Command {
  id: string
  label: string
  description?: string
  shortcut?: string
  category?: string
  action: () => void
}

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
  commands: Command[]
}

export function CommandPalette({ isOpen, onClose, commands }: CommandPaletteProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Filter and group commands based on search query
  const filteredCommands = useMemo(() => {
    if (!searchQuery.trim()) {
      return commands
    }

    const query = searchQuery.toLowerCase()
    return commands.filter(cmd =>
      cmd.label.toLowerCase().includes(query) ||
      cmd.description?.toLowerCase().includes(query) ||
      cmd.category?.toLowerCase().includes(query)
    )
  }, [commands, searchQuery])

  // Group commands by category
  const groupedCommands = useMemo(() => {
    const groups: Record<string, Command[]> = {}

    filteredCommands.forEach(cmd => {
      const category = cmd.category || 'General'
      if (!groups[category]) {
        groups[category] = []
      }
      groups[category].push(cmd)
    })

    return groups
  }, [filteredCommands])

  // Flatten for keyboard navigation
  const flatCommands = useMemo(() => {
    return Object.values(groupedCommands).flat()
  }, [groupedCommands])

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current && flatCommands[selectedIndex]) {
      const selectedElement = listRef.current.querySelector(`[data-index="${selectedIndex}"]`)
      if (selectedElement && typeof selectedElement.scrollIntoView === 'function') {
        selectedElement.scrollIntoView({ block: 'nearest' })
      }
    }
  }, [selectedIndex, flatCommands])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(i => Math.min(flatCommands.length - 1, i + 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(i => Math.max(0, i - 1))
        break
      case 'Enter':
        e.preventDefault()
        if (flatCommands[selectedIndex]) {
          flatCommands[selectedIndex].action()
          onClose()
        }
        break
      case 'Escape':
        e.preventDefault()
        onClose()
        break
    }
  }

  const executeCommand = (cmd: Command) => {
    cmd.action()
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="" maxWidth="lg">
      <div className="p-0">
        {/* Search input */}
        <div className="border-b border-gray-200 p-3">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setSelectedIndex(0)
              }}
              onKeyDown={handleKeyDown}
              placeholder="Type a command or search..."
              className="flex-1 text-sm outline-none placeholder-gray-400"
            />
            <span className="text-xs text-gray-400 font-mono">ESC to close</span>
          </div>
        </div>

        {/* Command list */}
        <div ref={listRef} className="max-h-[400px] overflow-y-auto">
          {flatCommands.length === 0 ? (
            <div className="p-4 text-center text-gray-500 text-sm">
              No commands found
            </div>
          ) : (
            Object.entries(groupedCommands).map(([category, cmds]) => (
              <div key={category}>
                <div className="px-3 py-2 text-xs font-semibold text-gray-500 bg-gray-50 sticky top-0">
                  {category}
                </div>
                {cmds.map((cmd, idx) => {
                  const globalIndex = flatCommands.indexOf(cmd)
                  return (
                    <button
                      key={cmd.id}
                      data-index={globalIndex}
                      onClick={() => executeCommand(cmd)}
                      className={`w-full px-3 py-2 text-left flex items-center justify-between gap-2 ${
                        globalIndex === selectedIndex
                          ? 'bg-accent text-white'
                          : 'hover:bg-gray-100'
                      }`}
                    >
                      <div>
                        <div className={`text-sm font-medium ${globalIndex === selectedIndex ? 'text-white' : 'text-gray-900'}`}>
                          {cmd.label}
                        </div>
                        {cmd.description && (
                          <div className={`text-xs ${globalIndex === selectedIndex ? 'text-white/80' : 'text-gray-500'}`}>
                            {cmd.description}
                          </div>
                        )}
                      </div>
                      {cmd.shortcut && (
                        <kbd className={`text-xs font-mono px-1.5 py-0.5 rounded ${
                          globalIndex === selectedIndex
                            ? 'bg-white/20 text-white'
                            : 'bg-gray-100 text-gray-500'
                        }`}>
                          {cmd.shortcut}
                        </kbd>
                      )}
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-3 py-2 bg-gray-50 flex items-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <kbd className="px-1 bg-gray-200 rounded">↑↓</kbd> Navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 bg-gray-200 rounded">↵</kbd> Execute
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 bg-gray-200 rounded">ESC</kbd> Close
          </span>
        </div>
      </div>
    </Modal>
  )
}

// Hook to manage command palette state
export function useCommandPalette() {
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+Shift+P or Ctrl+Shift+P
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'p') {
        e.preventDefault()
        setIsOpen(true)
      }
      // Also support Cmd+K
      if ((e.metaKey || e.ctrlKey) && e.key === 'k' && !e.shiftKey) {
        e.preventDefault()
        setIsOpen(true)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return {
    isOpen,
    openPalette: () => setIsOpen(true),
    closePalette: () => setIsOpen(false)
  }
}
