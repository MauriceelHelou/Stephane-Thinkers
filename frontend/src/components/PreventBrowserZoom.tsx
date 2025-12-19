'use client'

import { useEffect } from 'react'

/**
 * Prevents browser-level zoom from trackpad pinch gestures.
 * This allows our canvas to handle zoom independently.
 */
export function PreventBrowserZoom() {
  useEffect(() => {
    // Prevent Ctrl+wheel zoom (trackpad pinch on all browsers)
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
      }
    }

    // Prevent gesture events (Safari specific)
    const handleGestureStart = (e: Event) => {
      e.preventDefault()
    }

    const handleGestureChange = (e: Event) => {
      e.preventDefault()
    }

    // Prevent Ctrl+Plus/Minus zoom
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '-' || e.key === '=' || e.key === '0')) {
        e.preventDefault()
      }
    }

    // Add listeners with passive: false to allow preventDefault
    document.addEventListener('wheel', handleWheel, { passive: false })
    document.addEventListener('gesturestart', handleGestureStart)
    document.addEventListener('gesturechange', handleGestureChange)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('wheel', handleWheel)
      document.removeEventListener('gesturestart', handleGestureStart)
      document.removeEventListener('gesturechange', handleGestureChange)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  return null
}
