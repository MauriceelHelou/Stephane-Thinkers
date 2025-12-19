'use client'

import { useState, useRef, useEffect } from 'react'
import { Modal, ModalButton, ModalFooter } from '@/components/Modal'
import { useSettings } from '@/lib/SettingsContext'
import { AppSettings, ShortcutBinding, formatShortcut, shortcutActionNames, defaultSettings } from '@/lib/settings'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

type TabType = 'shortcuts' | 'display'

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { settings, updateShortcut, updateDisplay, resetToDefaults, exportSettingsJson, importSettingsJson, isMac } = useSettings()
  const [activeTab, setActiveTab] = useState<TabType>('shortcuts')
  const [capturingAction, setCapturingAction] = useState<keyof AppSettings['shortcuts'] | null>(null)
  const [importJson, setImportJson] = useState('')
  const [showImport, setShowImport] = useState(false)
  const [importError, setImportError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Handle key capture for rebinding shortcuts
  useEffect(() => {
    if (!capturingAction) return

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()

      // Ignore modifier-only presses
      if (['Control', 'Meta', 'Shift', 'Alt'].includes(e.key)) {
        return
      }

      const newBinding: ShortcutBinding = {
        key: e.key,
        modifiers: {
          ctrl: e.ctrlKey,
          meta: e.metaKey,
          shift: e.shiftKey,
          alt: e.altKey,
        },
      }

      updateShortcut(capturingAction, newBinding)
      setCapturingAction(null)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [capturingAction, updateShortcut])

  const handleExport = () => {
    const json = exportSettingsJson()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'intellectual-genealogy-settings.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result as string
      if (importSettingsJson(content)) {
        setShowImport(false)
        setImportError('')
      } else {
        setImportError('Invalid settings file')
      }
    }
    reader.readAsText(file)
  }

  const handleImportText = () => {
    if (importSettingsJson(importJson)) {
      setShowImport(false)
      setImportJson('')
      setImportError('')
    } else {
      setImportError('Invalid settings JSON')
    }
  }

  const handleResetToDefaults = () => {
    if (confirm('Reset all settings to defaults? This cannot be undone.')) {
      resetToDefaults()
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Settings" maxWidth="2xl">
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('shortcuts')}
          className={`px-4 py-2 font-sans text-sm ${
            activeTab === 'shortcuts'
              ? 'border-b-2 border-accent text-accent font-medium'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Keyboard Shortcuts
        </button>
        <button
          onClick={() => setActiveTab('display')}
          className={`px-4 py-2 font-sans text-sm ${
            activeTab === 'display'
              ? 'border-b-2 border-accent text-accent font-medium'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Display
        </button>
      </div>

      <div className="p-6 max-h-[60vh] overflow-y-auto">
        {activeTab === 'shortcuts' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500 mb-4">
              Click on a shortcut to rebind it. Press the new key combination when prompted.
            </p>

            <div className="space-y-2">
              {(Object.keys(settings.shortcuts) as Array<keyof AppSettings['shortcuts']>).map((action) => (
                <div key={action} className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-sm font-sans">{shortcutActionNames[action]}</span>
                  <button
                    onClick={() => setCapturingAction(action)}
                    className={`px-3 py-1.5 text-sm font-mono rounded border ${
                      capturingAction === action
                        ? 'border-accent bg-accent/10 text-accent animate-pulse'
                        : 'border-gray-200 hover:border-gray-300 bg-gray-50'
                    }`}
                  >
                    {capturingAction === action
                      ? 'Press keys...'
                      : formatShortcut(settings.shortcuts[action], isMac)}
                  </button>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-gray-200">
              <button
                onClick={handleResetToDefaults}
                className="text-sm text-red-600 hover:text-red-700"
              >
                Reset Shortcuts to Defaults
              </button>
            </div>
          </div>
        )}

        {activeTab === 'display' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-sans font-medium">Show Connection Labels</label>
                <p className="text-xs text-gray-500">Display labels on connection lines</p>
              </div>
              <input
                type="checkbox"
                checked={settings.display.showConnectionLabels}
                onChange={(e) => updateDisplay('showConnectionLabels', e.target.checked)}
                className="h-5 w-5 text-accent border-gray-300 rounded"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-sans font-medium">Show Year Markers</label>
                <p className="text-xs text-gray-500">Display year labels on timeline</p>
              </div>
              <input
                type="checkbox"
                checked={settings.display.showYearMarkers}
                onChange={(e) => updateDisplay('showYearMarkers', e.target.checked)}
                className="h-5 w-5 text-accent border-gray-300 rounded"
              />
            </div>

            <div>
              <label className="text-sm font-sans font-medium">Default Zoom Level</label>
              <p className="text-xs text-gray-500 mb-2">Initial zoom when opening a timeline</p>
              <input
                type="range"
                min="0.5"
                max="3"
                step="0.1"
                value={settings.display.defaultZoom}
                onChange={(e) => updateDisplay('defaultZoom', parseFloat(e.target.value))}
                className="w-full"
              />
              <div className="text-xs text-gray-500 text-center">{settings.display.defaultZoom}x</div>
            </div>

            <div>
              <label className="text-sm font-sans font-medium">Sticky Note Preview Length</label>
              <p className="text-xs text-gray-500 mb-2">Characters to show in canvas sticky notes</p>
              <input
                type="number"
                min="20"
                max="200"
                value={settings.display.stickyNotePreviewLength}
                onChange={(e) => updateDisplay('stickyNotePreviewLength', parseInt(e.target.value) || 50)}
                className="w-full px-3 py-2 border border-gray-200 rounded"
              />
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-gray-200 p-4">
        {showImport ? (
          <div className="space-y-3">
            <div>
              <label className="text-sm font-sans font-medium">Import from file</label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleImportFile}
                className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-accent/10 file:text-accent hover:file:bg-accent/20"
              />
            </div>
            <div>
              <label className="text-sm font-sans font-medium">Or paste JSON</label>
              <textarea
                value={importJson}
                onChange={(e) => setImportJson(e.target.value)}
                rows={3}
                className="mt-1 w-full px-3 py-2 border border-gray-200 rounded text-xs font-mono"
                placeholder='{"shortcuts": {...}, "display": {...}}'
              />
              {importError && <p className="text-red-600 text-xs mt-1">{importError}</p>}
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleImportText}
                disabled={!importJson.trim()}
                className="px-3 py-1.5 text-sm bg-accent text-white rounded disabled:opacity-50"
              >
                Import
              </button>
              <button
                onClick={() => { setShowImport(false); setImportJson(''); setImportError('') }}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex justify-between">
            <div className="flex gap-2">
              <button
                onClick={handleExport}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded hover:bg-gray-50"
              >
                Export Settings
              </button>
              <button
                onClick={() => setShowImport(true)}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded hover:bg-gray-50"
              >
                Import Settings
              </button>
            </div>
            <ModalButton onClick={onClose}>Close</ModalButton>
          </div>
        )}
      </div>
    </Modal>
  )
}
