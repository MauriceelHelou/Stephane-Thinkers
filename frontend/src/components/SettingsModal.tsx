'use client'

import { useState, useRef, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Modal, ModalButton, ModalFooter } from '@/components/Modal'
import { useSettings } from '@/lib/SettingsContext'
import { AppSettings, ShortcutBinding, formatShortcut, shortcutActionNames, defaultSettings } from '@/lib/settings'
import { backupApi, ImportPreview, ImportResult } from '@/lib/api'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

type TabType = 'shortcuts' | 'display' | 'data'

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const queryClient = useQueryClient()
  const { settings, updateShortcut, updateDisplay, resetToDefaults, exportSettingsJson, importSettingsJson, isMac } = useSettings()
  const [activeTab, setActiveTab] = useState<TabType>('shortcuts')
  const [capturingAction, setCapturingAction] = useState<keyof AppSettings['shortcuts'] | null>(null)
  const [importJson, setImportJson] = useState('')
  const [showImport, setShowImport] = useState(false)
  const [importError, setImportError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Database backup/restore state
  const [exportLoading, setExportLoading] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null)
  const [importLoading, setImportLoading] = useState(false)
  const [importConfirmed, setImportConfirmed] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [importDbError, setImportDbError] = useState<string | null>(null)
  const dbFileInputRef = useRef<HTMLInputElement>(null)

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

  // Database backup/restore handlers
  const handleExportDatabase = async () => {
    setExportLoading(true)
    try {
      const blob = await backupApi.exportDatabase()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
      a.download = `database-backup-${timestamp}.json`
      a.click()
      URL.revokeObjectURL(url)

      // Store last export timestamp in localStorage
      localStorage.setItem('lastBackupExport', new Date().toISOString())
    } catch (error) {
      alert(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setExportLoading(false)
    }
  }

  const handleDbFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setImportFile(file)
    setImportPreview(null)
    setImportConfirmed(false)
    setImportResult(null)
    setImportDbError(null)

    // Preview the backup
    try {
      const preview = await backupApi.previewImport(file)
      setImportPreview(preview)
      if (!preview.valid) {
        setImportDbError(preview.warnings.join(', '))
      }
    } catch (error) {
      setImportDbError(`Preview failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const handleRestoreDatabase = async () => {
    if (!importFile || !importConfirmed) return

    setImportLoading(true)
    setImportResult(null)
    setImportDbError(null)

    try {
      const result = await backupApi.importDatabase(importFile)
      setImportResult(result)

      // Invalidate all queries to refetch data
      queryClient.invalidateQueries()

      // Clear the form after successful import
      setTimeout(() => {
        setImportFile(null)
        setImportPreview(null)
        setImportConfirmed(false)
        if (dbFileInputRef.current) {
          dbFileInputRef.current.value = ''
        }
      }, 3000)
    } catch (error) {
      setImportDbError(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setImportLoading(false)
    }
  }

  const getLastExportTime = () => {
    const timestamp = localStorage.getItem('lastBackupExport')
    if (!timestamp) return null
    return new Date(timestamp).toLocaleString()
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
        <button
          onClick={() => setActiveTab('data')}
          className={`px-4 py-2 font-sans text-sm ${
            activeTab === 'data'
              ? 'border-b-2 border-accent text-accent font-medium'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Data
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

        {activeTab === 'data' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-sans font-medium mb-2">Database Backup & Restore</h3>
              <p className="text-sm text-gray-500">
                Export your entire database as a JSON backup file or restore from a previous backup.
              </p>
            </div>

            {/* Export Section */}
            <div className="border-t border-gray-200 pt-4">
              <h4 className="text-sm font-sans font-medium mb-2">Export Database</h4>
              <p className="text-xs text-gray-500 mb-3">
                Download a complete backup of all your data.
              </p>
              <button
                onClick={handleExportDatabase}
                disabled={exportLoading}
                className="px-4 py-2 text-sm bg-accent text-white rounded hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {exportLoading ? 'Exporting...' : 'Download Database Backup'}
              </button>
              {getLastExportTime() && (
                <p className="text-xs text-gray-500 mt-2">
                  Last export: {getLastExportTime()}
                </p>
              )}
            </div>

            {/* Import Section */}
            <div className="border-t border-gray-200 pt-4">
              <h4 className="text-sm font-sans font-medium mb-2">Restore from Backup</h4>
              <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mb-3">
                <p className="text-xs text-yellow-800">
                  ⚠️ <strong>Warning:</strong> This will REPLACE all existing data in the database with the contents of the backup file.
                </p>
              </div>

              <input
                ref={dbFileInputRef}
                type="file"
                accept=".json"
                onChange={handleDbFileSelect}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-accent/10 file:text-accent hover:file:bg-accent/20"
              />

              {importPreview && importPreview.valid && (
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded">
                  <p className="text-sm font-medium text-blue-900 mb-1">Backup Preview</p>
                  <p className="text-xs text-blue-800">
                    Exported: {importPreview.metadata?.exported_at ? new Date(importPreview.metadata.exported_at).toLocaleString() : 'Unknown'}
                  </p>
                  <p className="text-xs text-blue-800">
                    Version: {importPreview.metadata?.api_version || 'Unknown'}
                  </p>
                  <p className="text-xs text-blue-800 mt-1">
                    Records: {Object.entries(importPreview.metadata?.counts || {})
                      .filter(([_, count]) => count > 0)
                      .map(([table, count]) => `${count} ${table}`)
                      .join(', ')}
                  </p>
                  {importPreview.warnings.length > 0 && (
                    <div className="mt-2 text-xs text-yellow-700">
                      {importPreview.warnings.map((warning, i) => (
                        <p key={i}>⚠️ {warning}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {importPreview && importPreview.valid && (
                <div className="mt-3">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={importConfirmed}
                      onChange={(e) => setImportConfirmed(e.target.checked)}
                      className="h-4 w-4 text-accent border-gray-300 rounded"
                    />
                    <span className="text-gray-700">
                      I understand this will replace all existing data
                    </span>
                  </label>
                </div>
              )}

              {importPreview && importPreview.valid && (
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={handleRestoreDatabase}
                    disabled={!importConfirmed || importLoading}
                    className="px-4 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {importLoading ? 'Restoring...' : 'Restore Database'}
                  </button>
                  <button
                    onClick={() => {
                      setImportFile(null)
                      setImportPreview(null)
                      setImportConfirmed(false)
                      if (dbFileInputRef.current) {
                        dbFileInputRef.current.value = ''
                      }
                    }}
                    className="px-4 py-2 text-sm border border-gray-200 rounded hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {importResult && importResult.success && (
                <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded">
                  <p className="text-sm font-medium text-green-900">✓ {importResult.message}</p>
                </div>
              )}

              {importDbError && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded">
                  <p className="text-sm font-medium text-red-900">✗ {importDbError}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-gray-200 p-4">
        {activeTab === 'data' ? (
          // Data tab: Just show Close button
          <div className="flex justify-end">
            <ModalButton onClick={onClose}>Close</ModalButton>
          </div>
        ) : showImport ? (
          // Shortcuts/Display tabs: Show import form
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
          // Shortcuts/Display tabs: Show settings export/import + Close
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
