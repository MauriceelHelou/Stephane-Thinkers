'use client'

import { useEffect, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'

interface EditorToolbarProps {
  editor: Editor | null
  onSave?: () => void
  selectedText?: string
  onFlagTerm?: (term: string) => void
  onDetectThinkers?: () => void
  onAnnotateYears?: () => void
}

const SPACING_OPTIONS = ['1', '1.15', '1.35', '1.5', '1.65', '2'] as const

function ToolbarButton({
  active,
  onClick,
  title,
  children,
}: {
  active?: boolean
  onClick: () => void
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`px-2 py-1 text-xs font-sans rounded border transition-colors ${
        active
          ? 'bg-accent/10 text-accent border-accent/30'
          : 'text-secondary border-timeline hover:bg-gray-50 hover:text-primary'
      }`}
    >
      {children}
    </button>
  )
}

export function EditorToolbar({
  editor,
  onSave,
  selectedText,
  onFlagTerm,
  onDetectThinkers,
  onAnnotateYears,
}: EditorToolbarProps) {
  const [isListMenuOpen, setIsListMenuOpen] = useState(false)
  const listMenuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!isListMenuOpen) return

    const handleClickOutside = (event: MouseEvent) => {
      if (!listMenuRef.current?.contains(event.target as Node)) {
        setIsListMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isListMenuOpen])

  if (!editor) return null

  const isBulletListActive = editor.isActive('bulletList')
  const isOrderedListActive = editor.isActive('orderedList')
  const isAnyListActive = isBulletListActive || isOrderedListActive
  const paragraphLineHeight = editor.getAttributes('paragraph').lineHeight as string | undefined
  const headingLineHeight = editor.getAttributes('heading').lineHeight as string | undefined
  const detectedLineSpacing = paragraphLineHeight || headingLineHeight
  const currentLineSpacing =
    detectedLineSpacing && SPACING_OPTIONS.includes(detectedLineSpacing as (typeof SPACING_OPTIONS)[number])
      ? detectedLineSpacing
      : 'default'

  const applyList = (listType: 'bullet' | 'ordered') => {
    if (listType === 'bullet') {
      editor.chain().focus().toggleBulletList().run()
    } else {
      editor.chain().focus().toggleOrderedList().run()
    }
    setIsListMenuOpen(false)
  }

  const handleToggleBlockquote = () => {
    const chain = editor.chain().focus()

    if (isBulletListActive) {
      chain.toggleBulletList()
    } else if (isOrderedListActive) {
      chain.toggleOrderedList()
    }

    chain.toggleBlockquote().run()
  }

  const handleLineSpacingChange = (value: string) => {
    if (value === 'default') {
      editor.chain().focus().unsetLineSpacing().run()
      return
    }

    editor.chain().focus().setLineSpacing(value).run()
  }

  return (
    <div className="flex flex-wrap items-center gap-1 p-2 border-b border-timeline bg-gray-50">
      <ToolbarButton
        active={editor.isActive('bold')}
        onClick={() => editor.chain().focus().toggleBold().run()}
        title="Bold"
      >
        B
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive('italic')}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        title="Italic"
      >
        I
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive('underline')}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        title="Underline"
      >
        U
      </ToolbarButton>
      <div className="relative" ref={listMenuRef}>
        <ToolbarButton
          active={isAnyListActive || isListMenuOpen}
          onClick={() => setIsListMenuOpen((prev) => !prev)}
          title="List options"
        >
          List ▾
        </ToolbarButton>

        {isListMenuOpen && (
          <div className="absolute z-20 mt-1 min-w-[9.5rem] rounded border border-timeline bg-white shadow-lg overflow-hidden">
            <button
              type="button"
              onClick={() => applyList('bullet')}
              className={`block w-full px-3 py-2 text-left text-xs font-sans transition-colors ${
                isBulletListActive
                  ? 'bg-accent/10 text-accent'
                  : 'text-secondary hover:bg-gray-50 hover:text-primary'
              }`}
            >
              • Bullet list
            </button>
            <button
              type="button"
              onClick={() => applyList('ordered')}
              className={`block w-full px-3 py-2 text-left text-xs font-sans transition-colors ${
                isOrderedListActive
                  ? 'bg-accent/10 text-accent'
                  : 'text-secondary hover:bg-gray-50 hover:text-primary'
              }`}
            >
              1. Numbered list
            </button>
          </div>
        )}
      </div>
      <ToolbarButton
        active={editor.isActive('blockquote')}
        onClick={handleToggleBlockquote}
        title="Blockquote"
      >
        Quote
      </ToolbarButton>

      <label className="flex items-center gap-1 px-1">
        <span className="font-sans text-[10px] text-secondary">Spacing</span>
        <select
          value={currentLineSpacing}
          onChange={(event) => handleLineSpacingChange(event.target.value)}
          className="h-7 px-2 text-xs font-sans rounded border border-timeline bg-white text-secondary hover:text-primary focus:outline-none focus:border-accent"
          title="Line spacing"
        >
          <option value="default">Default</option>
          <option value="1">Single</option>
          <option value="1.15">1.15</option>
          <option value="1.35">1.35</option>
          <option value="1.5">1.5</option>
          <option value="1.65">1.65</option>
          <option value="2">Double</option>
        </select>
      </label>

      <div className="w-px h-5 bg-timeline mx-1" />

      <button
        type="button"
        onClick={onSave}
        className="px-2 py-1 text-xs font-sans text-white bg-accent rounded hover:bg-accent/90"
      >
        Save
      </button>

      <button
        type="button"
        onClick={onDetectThinkers}
        className="px-2 py-1 text-xs font-sans text-secondary border border-timeline rounded hover:bg-white"
      >
        Scan Thinkers
      </button>

      <button
        type="button"
        onClick={onAnnotateYears}
        className="px-2 py-1 text-xs font-sans text-secondary border border-timeline rounded hover:bg-white"
      >
        Annotate Dates
      </button>

      {selectedText && (
        <button
          type="button"
          onClick={() => onFlagTerm?.(selectedText)}
          className="px-2 py-1 text-xs font-sans text-amber-700 hover:bg-amber-50 rounded border border-amber-200"
          title={`Flag "${selectedText}" as a critical term`}
        >
          Flag Term
        </button>
      )}
    </div>
  )
}
