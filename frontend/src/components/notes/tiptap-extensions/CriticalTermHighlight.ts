import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

export interface CriticalTermHighlightOptions {
  terms: string[]
  highlightClass: string
}

export const criticalTermPluginKey = new PluginKey('criticalTermHighlight')

function buildDecorations(
  doc: Parameters<typeof DecorationSet.create>[0],
  terms: string[],
  highlightClass: string
): DecorationSet {
  if (!terms.length) return DecorationSet.empty

  const escapedTerms = terms
    .filter((term) => term.length > 0)
    .map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))

  if (!escapedTerms.length) return DecorationSet.empty

  const pattern = new RegExp(`\\b(${escapedTerms.join('|')})\\b`, 'gi')
  const decorations: Decoration[] = []

  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return

    pattern.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = pattern.exec(node.text)) !== null) {
      const from = pos + match.index
      const to = from + match[0].length
      decorations.push(
        Decoration.inline(from, to, {
          class: highlightClass,
          'data-critical-term': match[0].toLowerCase(),
        })
      )
    }
  })

  return DecorationSet.create(doc, decorations)
}

export const CriticalTermHighlight = Extension.create<CriticalTermHighlightOptions>({
  name: 'criticalTermHighlight',

  addOptions() {
    return {
      terms: [],
      highlightClass: 'critical-term-highlight',
    }
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: criticalTermPluginKey,
        state: {
          init: (_, { doc }) =>
            buildDecorations(doc, this.options.terms, this.options.highlightClass),
          apply: (tr, oldDecorations) => {
            if (tr.docChanged || tr.getMeta(criticalTermPluginKey)) {
              return buildDecorations(tr.doc, this.options.terms, this.options.highlightClass)
            }
            return oldDecorations.map(tr.mapping, tr.doc)
          },
        },
        props: {
          decorations(state) {
            return this.getState(state)
          },
        },
      }),
    ]
  },
})

export function setCriticalTermHighlights(
  editor: {
    extensionManager: {
      extensions: Array<{ name: string; options?: Record<string, unknown> }>
    }
    view: {
      dispatch: (tr: unknown) => void
      state: {
        tr: {
          setMeta: (key: PluginKey, value: boolean) => unknown
        }
      }
    }
  },
  terms: string[]
) {
  const extension = editor.extensionManager.extensions.find(
    (ext) => ext.name === 'criticalTermHighlight'
  )
  if (extension?.options) {
    extension.options.terms = terms
  }
  const transaction = editor.view.state.tr.setMeta(criticalTermPluginKey, true)
  editor.view.dispatch(transaction)
}
