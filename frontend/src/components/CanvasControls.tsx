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
  const noneVisible = visibleConnectionTypes.length === 0

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-3 max-w-sm">
      {/* Connection Types Section */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-700">Connections</h3>
          <button
            onClick={() => onToggleAllConnectionTypes(!allVisible)}
            className="px-2 py-0.5 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
            title={allVisible ? 'Hide all connection types' : 'Show all connection types'}
          >
            {allVisible ? 'Hide All' : 'Show All'}
          </button>
        </div>

        <div className="flex flex-wrap gap-1">
          {(Object.entries(CONNECTION_STYLES) as [ConnectionStyleType, typeof CONNECTION_STYLES[ConnectionStyleType]][]).map(([type, style]) => {
            const isVisible = visibleConnectionTypes.includes(type)
            return (
              <button
                key={type}
                onClick={() => onToggleConnectionType(type)}
                className={`px-2 py-1 text-xs rounded-full transition-all flex items-center gap-1.5 ${
                  isVisible
                    ? 'bg-white border shadow-sm'
                    : 'bg-gray-100 border border-transparent opacity-50'
                }`}
                style={{
                  borderColor: isVisible ? style.color : 'transparent',
                }}
                title={`${isVisible ? 'Hide' : 'Show'} ${style.label} connections`}
              >
                {isVisible && (
                  <svg className="w-3 h-3 flex-shrink-0" viewBox="0 0 12 12" fill="none">
                    <path
                      d="M2 6L5 9L10 3"
                      stroke={style.color}
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
                <span
                  className="w-3 h-0.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: isVisible ? style.color : '#9CA3AF' }}
                />
                <span className={isVisible ? 'text-gray-700' : 'text-gray-400'}>
                  {style.label}
                </span>
              </button>
            )
          })}
        </div>

        <p className="text-xs text-gray-500 mt-2">
          Click thinkers to highlight connections. Line thickness shows strength.
        </p>
      </div>

      {/* Sticky Notes Section */}
      <div className="pt-3 border-t border-gray-100">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Sticky Notes</h3>

        <div className="flex items-center gap-2">
          <button
            onClick={onToggleStickyNotes}
            className={`flex-1 px-3 py-1.5 text-sm rounded transition-all flex items-center justify-center gap-2 ${
              showStickyNotes
                ? 'bg-yellow-50 border border-yellow-300 text-yellow-800'
                : 'bg-gray-100 border border-gray-300 text-gray-500'
            }`}
            title={showStickyNotes ? 'Hide sticky notes' : 'Show sticky notes'}
          >
            <span className="text-base">{showStickyNotes ? '👁' : '👁'}</span>
            <span>{showStickyNotes ? 'Visible' : 'Hidden'}</span>
            {stickyNoteCount > 0 && (
              <span className={`text-xs ${showStickyNotes ? 'text-yellow-600' : 'text-gray-400'}`}>
                ({stickyNoteCount})
              </span>
            )}
          </button>

          <button
            onClick={onToggleStickyNoteMode}
            className={`px-3 py-1.5 text-sm rounded transition-all font-medium ${
              stickyNoteMode
                ? 'bg-yellow-400 text-yellow-900 shadow-sm'
                : 'bg-gray-100 border border-gray-300 text-gray-600 hover:bg-gray-200'
            }`}
            title={stickyNoteMode ? 'Exit sticky note mode (Ctrl+S)' : 'Add sticky note (Ctrl+S)'}
          >
            {stickyNoteMode ? '✓ Adding' : '+ Add'}
          </button>
        </div>

        {stickyNoteMode && (
          <p className="text-xs text-yellow-700 mt-2 bg-yellow-50 px-2 py-1 rounded">
            Click anywhere on canvas to place a note
          </p>
        )}
      </div>
    </div>
  )
}
