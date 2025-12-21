'use client'

import { CONNECTION_STYLES, ConnectionStyleType } from '@/lib/constants'

interface CanvasControlsProps {
  // Connection filtering
  visibleConnectionTypes: ConnectionStyleType[]
  onToggleConnectionType: (type: ConnectionStyleType) => void
  onToggleAllConnectionTypes: (visible: boolean) => void

  // Sticky notes
  showStickyNotes: boolean
  onToggleStickyNotes: () => void
  stickyNoteCount: number
  stickyNoteMode: boolean
  onToggleStickyNoteMode: () => void
}

export function CanvasControls({
  visibleConnectionTypes,
  onToggleConnectionType,
  onToggleAllConnectionTypes,
  showStickyNotes,
  onToggleStickyNotes,
  stickyNoteCount,
  stickyNoteMode,
  onToggleStickyNoteMode,
}: CanvasControlsProps) {
  const allVisible = visibleConnectionTypes.length === Object.keys(CONNECTION_STYLES).length

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-2 w-32">
      {/* Connection Types Section */}
      <div className="mb-2">
        <div className="flex items-center justify-between mb-1.5">
          <h3 className="text-xs font-semibold text-gray-700">Lines</h3>
          <button
            onClick={() => onToggleAllConnectionTypes(!allVisible)}
            className="text-[10px] text-gray-500 hover:text-gray-900"
            title={allVisible ? 'Hide all' : 'Show all'}
          >
            {allVisible ? 'none' : 'all'}
          </button>
        </div>

        <div className="space-y-1">
          {(Object.entries(CONNECTION_STYLES) as [ConnectionStyleType, typeof CONNECTION_STYLES[ConnectionStyleType]][]).map(([type, style]) => {
            const isVisible = visibleConnectionTypes.includes(type)
            return (
              <button
                key={type}
                onClick={() => onToggleConnectionType(type)}
                className={`w-full px-1.5 py-1 text-[10px] rounded flex items-center gap-1.5 transition-all ${
                  isVisible
                    ? 'bg-white border'
                    : 'bg-gray-50 border border-transparent opacity-40'
                }`}
                style={{
                  borderColor: isVisible ? style.color : 'transparent',
                }}
                title={`${isVisible ? 'Hide' : 'Show'} ${style.label}`}
              >
                <span
                  className="w-2.5 h-0.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: style.color }}
                />
                <span className={`truncate ${isVisible ? 'text-gray-700' : 'text-gray-400'}`}>
                  {style.label}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Sticky Notes Section */}
      <div className="pt-2 border-t border-gray-100">
        <h3 className="text-xs font-semibold text-gray-700 mb-1.5">Notes</h3>

        <div className="space-y-1">
          <button
            onClick={onToggleStickyNotes}
            className={`w-full px-1.5 py-1 text-[10px] rounded flex items-center gap-1.5 ${
              showStickyNotes
                ? 'bg-yellow-50 border border-yellow-300 text-yellow-800'
                : 'bg-gray-50 border border-gray-200 text-gray-500'
            }`}
            title={showStickyNotes ? 'Hide notes' : 'Show notes'}
          >
            <span className="text-xs">{showStickyNotes ? '👁' : '⊗'}</span>
            <span className="truncate">{showStickyNotes ? 'Visible' : 'Hidden'}</span>
            {stickyNoteCount > 0 && (
              <span className="ml-auto text-[9px]">({stickyNoteCount})</span>
            )}
          </button>

          <button
            onClick={onToggleStickyNoteMode}
            className={`w-full px-1.5 py-1 text-[10px] rounded ${
              stickyNoteMode
                ? 'bg-yellow-400 text-yellow-900'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            title="Add note (Ctrl+S)"
          >
            {stickyNoteMode ? '✓ Adding' : '+ Add'}
          </button>
        </div>
      </div>
    </div>
  )
}
