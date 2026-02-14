import { Extension } from '@tiptap/core'
import type { EditorState, Transaction } from '@tiptap/pm/state'

export interface LineSpacingOptions {
  types: string[]
  allowedLineHeights: string[]
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    lineSpacing: {
      setLineSpacing: (lineHeight: string) => ReturnType
      unsetLineSpacing: () => ReturnType
    }
  }
}

export const LineSpacing = Extension.create<LineSpacingOptions>({
  name: 'lineSpacing',

  addOptions() {
    return {
      types: ['paragraph', 'heading'],
      allowedLineHeights: ['1', '1.15', '1.35', '1.5', '1.65', '2'],
    }
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          lineHeight: {
            default: null,
            parseHTML: (element: HTMLElement) => element.style.lineHeight || null,
            renderHTML: (attributes: Record<string, unknown>) => {
              const lineHeight = attributes.lineHeight as string | null | undefined
              if (!lineHeight) return {}
              return { style: `line-height: ${lineHeight}` }
            },
          },
        },
      },
    ]
  },

  addCommands() {
    const updateLineHeight = (
      lineHeight: string | null,
      state: EditorState,
      tr: Transaction
    ) => {
      const { from, to, empty, $from } = state.selection
      let changed = false

      state.doc.nodesBetween(from, to, (node, pos) => {
        if (!this.options.types.includes(node.type.name)) return

        const current = (node.attrs.lineHeight as string | null | undefined) ?? null
        if (current === lineHeight) return

        tr.setNodeMarkup(pos, undefined, { ...node.attrs, lineHeight })
        changed = true
      })

      if (!changed && empty) {
        for (let depth = $from.depth; depth > 0; depth--) {
          const node = $from.node(depth)
          if (!this.options.types.includes(node.type.name)) continue

          const pos = $from.before(depth)
          const current = (node.attrs.lineHeight as string | null | undefined) ?? null
          if (current === lineHeight) break

          tr.setNodeMarkup(pos, undefined, { ...node.attrs, lineHeight })
          changed = true
          break
        }
      }

      return changed
    }

    return {
      setLineSpacing:
        (lineHeight: string) =>
        ({ state, tr, dispatch }) => {
          if (!this.options.allowedLineHeights.includes(lineHeight)) {
            return false
          }

          const changed = updateLineHeight(lineHeight, state, tr)
          if (!changed) return false
          if (dispatch) dispatch(tr)
          return true
        },

      unsetLineSpacing:
        () =>
        ({ state, tr, dispatch }) => {
          const changed = updateLineHeight(null, state, tr)
          if (!changed) return false
          if (dispatch) dispatch(tr)
          return true
        },
    }
  },
})
