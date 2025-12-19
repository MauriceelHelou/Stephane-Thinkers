// Settings types and localStorage persistence

export interface ShortcutBinding {
  key: string
  modifiers: {
    ctrl: boolean
    meta: boolean
    shift: boolean
    alt: boolean
  }
}

export interface AppSettings {
  shortcuts: {
    addThinker: ShortcutBinding
    addConnection: ShortcutBinding
    addEvent: ShortcutBinding
    newTimeline: ShortcutBinding
    openHelp: ShortcutBinding
    escape: ShortcutBinding
    toggleFilters: ShortcutBinding
    zoomIn: ShortcutBinding
    zoomOut: ShortcutBinding
    resetView: ShortcutBinding
  }
  display: {
    showConnectionLabels: boolean
    showYearMarkers: boolean
    defaultZoom: number
    stickyNotePreviewLength: number
  }
}

const SETTINGS_KEY = 'intellectual-genealogy-settings'
const SETTINGS_VERSION = 1

export const defaultSettings: AppSettings = {
  shortcuts: {
    addThinker: { key: 't', modifiers: { ctrl: true, meta: true, shift: false, alt: false } },
    addConnection: { key: 'k', modifiers: { ctrl: true, meta: true, shift: false, alt: false } },
    addEvent: { key: 'e', modifiers: { ctrl: true, meta: true, shift: false, alt: false } },
    newTimeline: { key: 'n', modifiers: { ctrl: true, meta: true, shift: false, alt: false } },
    openHelp: { key: '?', modifiers: { ctrl: false, meta: false, shift: true, alt: false } },
    escape: { key: 'Escape', modifiers: { ctrl: false, meta: false, shift: false, alt: false } },
    toggleFilters: { key: 'f', modifiers: { ctrl: true, meta: true, shift: false, alt: false } },
    zoomIn: { key: '=', modifiers: { ctrl: true, meta: true, shift: false, alt: false } },
    zoomOut: { key: '-', modifiers: { ctrl: true, meta: true, shift: false, alt: false } },
    resetView: { key: '0', modifiers: { ctrl: true, meta: true, shift: false, alt: false } },
  },
  display: {
    showConnectionLabels: true,
    showYearMarkers: true,
    defaultZoom: 1,
    stickyNotePreviewLength: 50,
  },
}

export function loadSettings(): AppSettings {
  if (typeof window === 'undefined') return defaultSettings

  try {
    const stored = localStorage.getItem(SETTINGS_KEY)
    if (!stored) return defaultSettings

    const parsed = JSON.parse(stored)

    // Merge with defaults to handle new settings added in updates
    return {
      shortcuts: { ...defaultSettings.shortcuts, ...parsed.shortcuts },
      display: { ...defaultSettings.display, ...parsed.display },
    }
  } catch {
    return defaultSettings
  }
}

export function saveSettings(settings: AppSettings): void {
  if (typeof window === 'undefined') return

  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({
      ...settings,
      _version: SETTINGS_VERSION,
    }))
  } catch (e) {
    console.error('Failed to save settings:', e)
  }
}

export function resetSettings(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(SETTINGS_KEY)
}

export function exportSettings(settings: AppSettings): string {
  return JSON.stringify(settings, null, 2)
}

export function importSettings(json: string): AppSettings | null {
  try {
    const parsed = JSON.parse(json)
    // Validate basic structure
    if (!parsed.shortcuts || !parsed.display) {
      return null
    }
    return {
      shortcuts: { ...defaultSettings.shortcuts, ...parsed.shortcuts },
      display: { ...defaultSettings.display, ...parsed.display },
    }
  } catch {
    return null
  }
}

// Helper to check if a keyboard event matches a shortcut binding
export function matchesBinding(e: KeyboardEvent, binding: ShortcutBinding): boolean {
  const key = e.key.toLowerCase()
  const bindingKey = binding.key.toLowerCase()

  // Handle special keys
  if (bindingKey === 'escape' && key === 'escape') {
    return (
      e.ctrlKey === binding.modifiers.ctrl &&
      e.metaKey === binding.modifiers.meta &&
      e.shiftKey === binding.modifiers.shift &&
      e.altKey === binding.modifiers.alt
    )
  }

  // For regular keys, check exact match or with modifiers
  if (key !== bindingKey) return false

  // For shortcuts that use ctrl OR meta (cross-platform), either works
  const ctrlOrMeta = binding.modifiers.ctrl && binding.modifiers.meta
  if (ctrlOrMeta) {
    // Either ctrl or meta should work
    if (!e.ctrlKey && !e.metaKey) return false
  } else {
    if (e.ctrlKey !== binding.modifiers.ctrl) return false
    if (e.metaKey !== binding.modifiers.meta) return false
  }

  if (e.shiftKey !== binding.modifiers.shift) return false
  if (e.altKey !== binding.modifiers.alt) return false

  return true
}

// Format a shortcut binding for display
export function formatShortcut(binding: ShortcutBinding, isMac: boolean = false): string {
  const parts: string[] = []

  if (binding.modifiers.ctrl && binding.modifiers.meta) {
    // Cross-platform shortcut
    parts.push(isMac ? '⌘' : 'Ctrl')
  } else {
    if (binding.modifiers.ctrl) parts.push('Ctrl')
    if (binding.modifiers.meta) parts.push(isMac ? '⌘' : 'Meta')
  }

  if (binding.modifiers.shift) parts.push(isMac ? '⇧' : 'Shift')
  if (binding.modifiers.alt) parts.push(isMac ? '⌥' : 'Alt')

  // Format the key nicely
  let keyDisplay = binding.key.toUpperCase()
  if (binding.key === 'Escape') keyDisplay = 'Esc'
  if (binding.key === '?') keyDisplay = '?'
  if (binding.key === '=') keyDisplay = '+'
  if (binding.key === '-') keyDisplay = '−'

  parts.push(keyDisplay)

  return parts.join(isMac ? '' : '+')
}

// Shortcut action names for display
export const shortcutActionNames: Record<keyof AppSettings['shortcuts'], string> = {
  addThinker: 'Add Thinker',
  addConnection: 'Add Connection',
  addEvent: 'Add Event',
  newTimeline: 'New Timeline',
  openHelp: 'Open Help',
  escape: 'Cancel/Close',
  toggleFilters: 'Toggle Filters',
  zoomIn: 'Zoom In',
  zoomOut: 'Zoom Out',
  resetView: 'Reset View',
}
