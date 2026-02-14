import Mention from '@tiptap/extension-mention'
import { mergeAttributes } from '@tiptap/core'
import type { SuggestionOptions } from '@tiptap/suggestion'

export interface ThinkerMentionAttrs {
  id: string
  name: string
  birthYear?: number | null
  deathYear?: number | null
  field?: string | null
}

export const ThinkerMention = Mention.extend({
  name: 'thinkerMention',

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-thinker-id'),
        renderHTML: (attributes: Record<string, unknown>) => ({
          'data-thinker-id': attributes.id,
        }),
      },
      name: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-thinker-name'),
        renderHTML: (attributes: Record<string, unknown>) => ({
          'data-thinker-name': attributes.name,
        }),
      },
      birthYear: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          const value = element.getAttribute('data-birth-year')
          return value ? parseInt(value, 10) : null
        },
        renderHTML: (attributes: Record<string, unknown>) => {
          if (attributes.birthYear == null) return {}
          return { 'data-birth-year': String(attributes.birthYear) }
        },
      },
      deathYear: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          const value = element.getAttribute('data-death-year')
          return value ? parseInt(value, 10) : null
        },
        renderHTML: (attributes: Record<string, unknown>) => {
          if (attributes.deathYear == null) return {}
          return { 'data-death-year': String(attributes.deathYear) }
        },
      },
      field: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-field'),
        renderHTML: (attributes: Record<string, unknown>) => {
          if (!attributes.field) return {}
          return { 'data-field': attributes.field }
        },
      },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-type="thinker-mention"]' }]
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(
        {
          'data-type': 'thinker-mention',
          class: 'thinker-mention',
        },
        HTMLAttributes
      ),
      `${node.attrs.name}`,
    ]
  },
})

export function createThinkerSuggestion(
  fetchThinkers: (query: string) => Promise<ThinkerMentionAttrs[]>,
  onAddNewThinker: (name: string) => void
): Partial<SuggestionOptions<ThinkerMentionAttrs>> {
  return {
    char: '[',
    allowSpaces: true,
    items: async ({ query }) => {
      if (!query || query.length < 1) {
        return fetchThinkers('')
      }
      return fetchThinkers(query)
    },
    command: ({ editor, range, props }) => {
      editor
        .chain()
        .focus()
        .insertContentAt(range, [
          {
            type: 'thinkerMention',
            attrs: {
              id: props.id,
              name: props.name,
              birthYear: props.birthYear,
              deathYear: props.deathYear,
              field: props.field,
            },
          },
          { type: 'text', text: ' ' },
        ])
        .run()
    },
    render: () => {
      let root: HTMLDivElement | null = null

      return {
        onStart: (props) => {
          root = document.createElement('div')
          root.className = 'thinker-suggestion-popover'
          root.style.position = 'fixed'
          root.style.zIndex = '9999'
          root.style.background = 'white'
          root.style.border = '1px solid #E0E0E0'
          root.style.borderRadius = '8px'
          root.style.padding = '4px'
          root.style.minWidth = '220px'
          root.style.maxHeight = '220px'
          root.style.overflowY = 'auto'
          document.body.appendChild(root)

          const items = props.items as ThinkerMentionAttrs[]
          if (!items.length) {
            root.innerHTML = '<div style="padding:8px;font-size:12px;color:#666">No thinkers found</div>'
          } else {
            root.innerHTML = items
              .map((item) => {
                const years = item.birthYear || item.deathYear
                  ? ` (${item.birthYear ?? '?'}-${item.deathYear ?? '?'})`
                  : ''
                return `<button data-id="${item.id}" style="display:block;width:100%;text-align:left;border:none;background:white;padding:8px;font-size:12px;cursor:pointer">${item.name}${years}</button>`
              })
              .join('')

            root.querySelectorAll('button[data-id]').forEach((button) => {
              button.addEventListener('click', () => {
                const thinker = items.find((item) => item.id === button.getAttribute('data-id'))
                if (thinker) props.command(thinker)
              })
            })
          }

          const rect = props.clientRect?.()
          if (rect && root) {
            root.style.left = `${rect.left}px`
            root.style.top = `${rect.bottom + 6}px`
          }
        },
        onUpdate: (props) => {
          if (!root) return
          const rect = props.clientRect?.()
          if (rect) {
            root.style.left = `${rect.left}px`
            root.style.top = `${rect.bottom + 6}px`
          }
        },
        onKeyDown: ({ event }) => {
          if (event.key === 'Escape') {
            return true
          }
          return false
        },
        onExit: () => {
          if (root) {
            root.remove()
            root = null
          }
        },
      }
    },
  }
}

export function triggerAddUnknownThinker(name: string, onAddNewThinker: (name: string) => void) {
  onAddNewThinker(name)
}
