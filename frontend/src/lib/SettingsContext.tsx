'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import {
  AppSettings,
  ShortcutBinding,
  loadSettings,
  saveSettings,
  resetSettings as resetStoredSettings,
  defaultSettings,
  exportSettings,
  importSettings,
} from './settings'

interface SettingsContextValue {
  settings: AppSettings
  updateShortcut: (action: keyof AppSettings['shortcuts'], binding: ShortcutBinding) => void
  updateDisplay: <K extends keyof AppSettings['display']>(key: K, value: AppSettings['display'][K]) => void
  resetToDefaults: () => void
  exportSettingsJson: () => string
  importSettingsJson: (json: string) => boolean
  isMac: boolean
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

interface SettingsProviderProps {
  children: ReactNode
}

export function SettingsProvider({ children }: SettingsProviderProps) {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings)
  const [isMac, setIsMac] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)

  // Load settings from localStorage on mount
  useEffect(() => {
    const loaded = loadSettings()
    setSettings(loaded)
    setIsLoaded(true)

    // Detect platform
    if (typeof navigator !== 'undefined') {
      setIsMac(navigator.platform.toUpperCase().indexOf('MAC') >= 0)
    }
  }, [])

  // Save settings to localStorage whenever they change
  useEffect(() => {
    if (isLoaded) {
      saveSettings(settings)
    }
  }, [settings, isLoaded])

  const updateShortcut = useCallback((action: keyof AppSettings['shortcuts'], binding: ShortcutBinding) => {
    setSettings(prev => ({
      ...prev,
      shortcuts: {
        ...prev.shortcuts,
        [action]: binding,
      },
    }))
  }, [])

  const updateDisplay = useCallback(<K extends keyof AppSettings['display']>(
    key: K,
    value: AppSettings['display'][K]
  ) => {
    setSettings(prev => ({
      ...prev,
      display: {
        ...prev.display,
        [key]: value,
      },
    }))
  }, [])

  const resetToDefaults = useCallback(() => {
    resetStoredSettings()
    setSettings(defaultSettings)
  }, [])

  const exportSettingsJson = useCallback(() => {
    return exportSettings(settings)
  }, [settings])

  const importSettingsJson = useCallback((json: string): boolean => {
    const imported = importSettings(json)
    if (imported) {
      setSettings(imported)
      return true
    }
    return false
  }, [])

  return (
    <SettingsContext.Provider
      value={{
        settings,
        updateShortcut,
        updateDisplay,
        resetToDefaults,
        exportSettingsJson,
        importSettingsJson,
        isMac,
      }}
    >
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  const context = useContext(SettingsContext)
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider')
  }
  return context
}
