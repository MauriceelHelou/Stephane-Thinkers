'use client'

import { useEffect, useMemo, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import { analysisApi, criticalTermsApi, thinkersApi, timelinesApi } from '@/lib/api'
import type { ThinkerDetectionResult } from '@/types'
import { EditorToolbar } from './EditorToolbar'
import { UnknownThinkerBanner } from './UnknownThinkerBanner'
import { CriticalTermHighlight, setCriticalTermHighlights } from './tiptap-extensions/CriticalTermHighlight'
import { ThinkerMention, createThinkerSuggestion, type ThinkerMentionAttrs } from './tiptap-extensions/ThinkerMention'
import { LineSpacing } from './tiptap-extensions/LineSpacing'

interface RichTextEditorProps {
  content: string
  noteId?: string | null
  onChange: (html: string) => void
  onSave?: () => void
  placeholder?: string
  onFlagTerm?: (term: string) => void
  onDetectionResult?: (result: ThinkerDetectionResult) => void
}

export function RichTextEditor({
  content,
  noteId,
  onChange,
  onSave,
  placeholder = 'Write your note...',
  onFlagTerm,
  onDetectionResult,
}: RichTextEditorProps) {
  const queryClient = useQueryClient()
  const [selectedText, setSelectedText] = useState('')
  const [unknownNames, setUnknownNames] = useState<string[]>([])
  const [addingUnknownName, setAddingUnknownName] = useState<string | null>(null)

  const { data: criticalTerms = [] } = useQuery({
    queryKey: ['critical-terms-active'],
    queryFn: () => criticalTermsApi.getAll(true),
  })
  const { data: timelines = [] } = useQuery({
    queryKey: ['timelines'],
    queryFn: timelinesApi.getAll,
  })

  const highlightTerms = useMemo(() => criticalTerms.map((term) => term.name.toLowerCase()), [criticalTerms])

  const fetchThinkers = async (query: string): Promise<ThinkerMentionAttrs[]> => {
    const thinkers = await analysisApi.searchThinkers(query)
    return thinkers.map((thinker) => ({
      id: thinker.id,
      name: thinker.name,
      birthYear: thinker.birth_year,
      deathYear: thinker.death_year,
      field: thinker.field,
    }))
  }

  const thinkerSuggestion = useMemo(
    () => createThinkerSuggestion(fetchThinkers, (name) => setUnknownNames((prev) => [...prev, name])),
    []
  )

  const editor = useEditor({
    immediatelyRender: false,
    editorProps: {
      attributes: {
        spellcheck: 'true',
        autocorrect: 'on',
        autocapitalize: 'sentences',
        autocomplete: 'on',
        lang: 'en',
      },
    },
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder }),
      Underline,
      LineSpacing,
      ThinkerMention.configure({ suggestion: thinkerSuggestion }),
      CriticalTermHighlight.configure({ terms: highlightTerms }),
    ],
    content,
    onUpdate: ({ editor: currentEditor }) => {
      onChange(currentEditor.getHTML())
      const { from, to } = currentEditor.state.selection
      const text = currentEditor.state.doc.textBetween(from, to, ' ')
      setSelectedText(text.trim())
    },
  })

  useEffect(() => {
    if (!editor) return
    const current = editor.getHTML()
    if (content !== current) {
      editor.commands.setContent(content || '<p></p>', { emitUpdate: false })
    }
  }, [content, editor])

  useEffect(() => {
    if (!editor) return
    setCriticalTermHighlights(editor as never, highlightTerms)
  }, [editor, highlightTerms])

  const handleDetectThinkers = async () => {
    if (!noteId) return
    try {
      const result = await analysisApi.detectThinkers(noteId)
      setUnknownNames(result.unknown_names || [])
      onDetectionResult?.(result)
    } catch {
      // keep editor responsive even if detection fails
    }
  }

  const handleAnnotateYears = async () => {
    if (!noteId || !editor) return
    try {
      const result = await analysisApi.annotateYears(noteId)
      const nextContent = result.updated_content_html || result.updated_content
      if (!nextContent) return
      editor.commands.setContent(nextContent, { emitUpdate: false })
      onChange(nextContent)
    } catch {
      // keep editor responsive even if annotation fails
    }
  }

  const handleAddUnknownThinker = async (rawName: string) => {
    const name = rawName.trim()
    if (!name || addingUnknownName) return

    setAddingUnknownName(name)
    try {
      const existing = await analysisApi.searchThinkers(name)
      const exactMatch = existing.find(
        (thinker) => thinker.name.trim().toLowerCase() === name.toLowerCase()
      )

      if (!exactMatch) {
        const mainTimeline =
          timelines.find((timeline) => timeline.name.trim().toLowerCase() === 'main timeline') || null

        await thinkersApi.create({
          name,
          timeline_id: mainTimeline?.id || null,
        })
      }

      queryClient.invalidateQueries({ queryKey: ['thinkers'] })
      setUnknownNames((prev) => prev.filter((item) => item.trim().toLowerCase() !== name.toLowerCase()))

      if (noteId) {
        const detection = await analysisApi.detectThinkers(noteId)
        setUnknownNames(detection.unknown_names || [])
        onDetectionResult?.(detection)
      }
    } catch {
      // keep editor responsive even if thinker creation fails
    } finally {
      setAddingUnknownName(null)
    }
  }

  return (
    <div className="h-full min-h-0 flex flex-col">
      <EditorToolbar
        editor={editor}
        onSave={onSave}
        selectedText={selectedText}
        onFlagTerm={onFlagTerm}
        onDetectThinkers={handleDetectThinkers}
        onAnnotateYears={handleAnnotateYears}
      />

      <UnknownThinkerBanner
        unknownNames={unknownNames}
        onAddThinker={handleAddUnknownThinker}
        addingName={addingUnknownName}
        onDismiss={() => setUnknownNames([])}
      />

      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
        <EditorContent editor={editor} className="notes-editor h-full" />
      </div>
    </div>
  )
}
