'use client'

import { CONNECTION_STYLES, ConnectionStyleType } from '@/lib/constants'

interface ConnectionLegendProps {
  visibleTypes: ConnectionStyleType[]
  onToggleType: (type: ConnectionStyleType) => void
  onToggleAll: (visible: boolean) => void
}

export function ConnectionLegend({ visibleTypes, onToggleType, onToggleAll }: ConnectionLegendProps) {
  const allTypes = Object.keys(CONNECTION_STYLES) as ConnectionStyleType[]
  const allVisible = allTypes.every(type => visibleTypes.includes(type))
  const noneVisible = visibleTypes.length === 0

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-700">Connection Types</h3>
        <div className="flex gap-1">
          <button
            onClick={() => onToggleAll(true)}
            className={`px-2 py-0.5 text-xs rounded ${
              allVisible
                ? 'bg-gray-200 text-gray-500 cursor-default'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            disabled={allVisible}
          >
            All
          </button>
          <button
            onClick={() => onToggleAll(false)}
            className={`px-2 py-0.5 text-xs rounded ${
              noneVisible
                ? 'bg-gray-200 text-gray-500 cursor-default'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            disabled={noneVisible}
          >
            None
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        {allTypes.map((type) => {
          const style = CONNECTION_STYLES[type]
          const isVisible = visibleTypes.includes(type)

          return (
            <label
              key={type}
              className="flex items-center gap-2 cursor-pointer group"
            >
              <input
                type="checkbox"
                checked={isVisible}
                onChange={() => onToggleType(type)}
                className="sr-only"
              />
              <span
                className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                  isVisible
                    ? 'bg-white border-gray-400'
                    : 'bg-gray-100 border-gray-300'
                }`}
                style={{
                  borderColor: isVisible ? style.color : undefined,
                }}
              >
                {isVisible && (
                  <svg
                    className="w-3 h-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke={style.color}
                    strokeWidth={3}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                )}
              </span>

              {/* Connection line preview */}
              <svg width="24" height="12" className="flex-shrink-0">
                <line
                  x1="0"
                  y1="6"
                  x2="24"
                  y2="6"
                  stroke={isVisible ? style.color : '#9CA3AF'}
                  strokeWidth="2"
                  strokeDasharray={style.dashPattern.join(' ') || undefined}
                  opacity={isVisible ? 1 : 0.4}
                />
                {/* Arrow */}
                <polygon
                  points="24,6 18,3 18,9"
                  fill={isVisible ? style.color : '#9CA3AF'}
                  opacity={isVisible ? 1 : 0.4}
                />
              </svg>

              <span
                className={`text-sm transition-colors ${
                  isVisible ? 'text-gray-700' : 'text-gray-400'
                }`}
              >
                {style.label}
              </span>
            </label>
          )
        })}
      </div>

      <div className="mt-3 pt-2 border-t border-gray-100">
        <p className="text-xs text-gray-500">
          Line thickness indicates connection strength.
          <br />
          Click a thinker to highlight their connections.
        </p>
      </div>
    </div>
  )
}
