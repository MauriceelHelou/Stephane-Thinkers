'use client'

interface UnknownThinkerBannerProps {
  unknownNames: string[]
  onAddThinker?: (name: string) => void
  addingName?: string | null
  onDismiss?: () => void
}

export function UnknownThinkerBanner({ unknownNames, onAddThinker, addingName, onDismiss }: UnknownThinkerBannerProps) {
  if (!unknownNames.length) return null

  return (
    <div className="mx-4 mt-3 rounded border border-amber-200 bg-amber-50 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-sans font-semibold text-amber-800">Unknown thinker links detected</p>
          <p className="text-xs font-sans text-amber-700 mt-1">
            {unknownNames.join(', ')} {unknownNames.length === 1 ? 'is' : 'are'} not in your thinker list.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {unknownNames.map((name) => {
              const isAdding = addingName?.trim().toLowerCase() === name.trim().toLowerCase()
              return (
              <button
                key={name}
                type="button"
                onClick={() => onAddThinker?.(name)}
                disabled={isAdding}
                className="px-2 py-1 text-xs font-sans rounded bg-white border border-amber-200 text-amber-700 hover:bg-amber-100 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isAdding ? `Adding ${name}...` : `Add ${name}`}
              </button>
              )
            })}
          </div>
        </div>

        <button
          type="button"
          onClick={onDismiss}
          className="text-amber-500 hover:text-amber-700 text-xs font-sans"
        >
          Dismiss
        </button>
      </div>
    </div>
  )
}
