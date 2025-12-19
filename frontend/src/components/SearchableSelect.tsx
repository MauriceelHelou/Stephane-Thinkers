'use client'

import { useState, useRef, useEffect, useMemo, useCallback } from 'react'

interface SearchableSelectProps<T> {
  options: T[]
  value: T | null
  onChange: (value: T | null) => void
  getLabel: (item: T) => string
  getValue: (item: T) => string
  placeholder?: string
  searchPlaceholder?: string
  allowClear?: boolean
  disabled?: boolean
  className?: string
  error?: string
  renderOption?: (item: T, isSelected: boolean) => React.ReactNode
}

export function SearchableSelect<T>({
  options,
  value,
  onChange,
  getLabel,
  getValue,
  placeholder = 'Select...',
  searchPlaceholder = 'Search...',
  allowClear = true,
  disabled = false,
  className = '',
  error,
  renderOption
}: SearchableSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  // Filter options based on search
  const filteredOptions = useMemo(() => {
    if (!search.trim()) return options
    const query = search.toLowerCase()
    return options.filter(option =>
      getLabel(option).toLowerCase().includes(query)
    )
  }, [options, search, getLabel])

  // Reset highlighted index when filtered options change
  useEffect(() => {
    setHighlightedIndex(0)
  }, [filteredOptions])

  // Scroll highlighted item into view
  useEffect(() => {
    if (isOpen && listRef.current) {
      const highlightedEl = listRef.current.children[highlightedIndex] as HTMLElement
      if (highlightedEl) {
        highlightedEl.scrollIntoView({ block: 'nearest' })
      }
    }
  }, [highlightedIndex, isOpen])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        setSearch('')
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Focus input when opening
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        if (!isOpen) {
          setIsOpen(true)
        } else {
          setHighlightedIndex(prev =>
            prev < filteredOptions.length - 1 ? prev + 1 : prev
          )
        }
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightedIndex(prev => (prev > 0 ? prev - 1 : prev))
        break
      case 'Enter':
        e.preventDefault()
        if (isOpen && filteredOptions[highlightedIndex]) {
          handleSelect(filteredOptions[highlightedIndex])
        } else {
          setIsOpen(true)
        }
        break
      case 'Escape':
        e.preventDefault()
        setIsOpen(false)
        setSearch('')
        break
      case 'Tab':
        setIsOpen(false)
        setSearch('')
        break
    }
  }, [isOpen, filteredOptions, highlightedIndex])

  const handleSelect = (option: T) => {
    onChange(option)
    setIsOpen(false)
    setSearch('')
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange(null)
    setSearch('')
  }

  const displayValue = value ? getLabel(value) : ''

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        className={`w-full px-3 py-2 text-left border rounded font-serif focus:outline-none focus:ring-2 focus:ring-accent flex items-center justify-between ${
          disabled
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200'
            : error
            ? 'border-red-500 bg-white'
            : 'border-timeline bg-white hover:border-gray-400'
        }`}
      >
        <span className={value ? 'text-primary' : 'text-gray-400'}>
          {displayValue || placeholder}
        </span>
        <div className="flex items-center gap-1">
          {allowClear && value && !disabled && (
            <span
              onClick={handleClear}
              className="text-gray-400 hover:text-gray-600 cursor-pointer px-1"
              role="button"
              aria-label="Clear selection"
            >
              ×
            </span>
          )}
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-timeline rounded shadow-lg">
          {/* Search input */}
          <div className="p-2 border-b border-gray-100">
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={searchPlaceholder}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          {/* Options list */}
          <ul
            ref={listRef}
            className="max-h-60 overflow-y-auto py-1"
            role="listbox"
          >
            {filteredOptions.length === 0 ? (
              <li className="px-3 py-2 text-sm text-gray-400 italic">
                No options found
              </li>
            ) : (
              filteredOptions.map((option, index) => {
                const isSelected = value && getValue(value) === getValue(option)
                const isHighlighted = index === highlightedIndex

                return (
                  <li
                    key={getValue(option)}
                    onClick={() => handleSelect(option)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    className={`px-3 py-2 text-sm cursor-pointer ${
                      isHighlighted
                        ? 'bg-accent/10'
                        : isSelected
                        ? 'bg-gray-50'
                        : 'hover:bg-gray-50'
                    }`}
                    role="option"
                    aria-selected={isSelected || false}
                  >
                    {renderOption ? (
                      renderOption(option, isSelected || false)
                    ) : (
                      <span className={isSelected ? 'font-medium text-accent' : ''}>
                        {getLabel(option)}
                      </span>
                    )}
                  </li>
                )
              })
            )}
          </ul>
        </div>
      )}

      {/* Error message */}
      {error && <p className="text-red-600 text-sm mt-1">{error}</p>}
    </div>
  )
}

// Multi-select variant for selecting multiple options
interface MultiSearchableSelectProps<T> {
  options: T[]
  value: T[]
  onChange: (value: T[]) => void
  getLabel: (item: T) => string
  getValue: (item: T) => string
  placeholder?: string
  searchPlaceholder?: string
  disabled?: boolean
  className?: string
  error?: string
  maxSelections?: number
}

export function MultiSearchableSelect<T>({
  options,
  value,
  onChange,
  getLabel,
  getValue,
  placeholder = 'Select items...',
  searchPlaceholder = 'Search...',
  disabled = false,
  className = '',
  error,
  maxSelections
}: MultiSearchableSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selectedIds = new Set(value.map(getValue))

  const filteredOptions = useMemo(() => {
    if (!search.trim()) return options
    const query = search.toLowerCase()
    return options.filter(option =>
      getLabel(option).toLowerCase().includes(query)
    )
  }, [options, search, getLabel])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        setSearch('')
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  const toggleOption = (option: T) => {
    const optionId = getValue(option)
    if (selectedIds.has(optionId)) {
      onChange(value.filter(v => getValue(v) !== optionId))
    } else {
      if (maxSelections && value.length >= maxSelections) return
      onChange([...value, option])
    }
  }

  const removeOption = (e: React.MouseEvent, option: T) => {
    e.stopPropagation()
    onChange(value.filter(v => getValue(v) !== getValue(option)))
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full min-h-[42px] px-3 py-2 border rounded font-serif focus-within:ring-2 focus-within:ring-accent flex flex-wrap items-center gap-1 cursor-pointer ${
          disabled
            ? 'bg-gray-100 cursor-not-allowed border-gray-200'
            : error
            ? 'border-red-500 bg-white'
            : 'border-timeline bg-white hover:border-gray-400'
        }`}
      >
        {value.length === 0 ? (
          <span className="text-gray-400">{placeholder}</span>
        ) : (
          value.map(v => (
            <span
              key={getValue(v)}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-accent/10 text-accent rounded text-sm"
            >
              {getLabel(v)}
              {!disabled && (
                <button
                  type="button"
                  onClick={(e) => removeOption(e, v)}
                  className="hover:text-accent/70"
                >
                  ×
                </button>
              )}
            </span>
          ))
        )}
      </div>

      {isOpen && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-timeline rounded shadow-lg">
          <div className="p-2 border-b border-gray-100">
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          <ul className="max-h-60 overflow-y-auto py-1">
            {filteredOptions.length === 0 ? (
              <li className="px-3 py-2 text-sm text-gray-400 italic">
                No options found
              </li>
            ) : (
              filteredOptions.map(option => {
                const isSelected = selectedIds.has(getValue(option))
                const isDisabledOption = !isSelected && maxSelections && value.length >= maxSelections

                return (
                  <li
                    key={getValue(option)}
                    onClick={() => !isDisabledOption && toggleOption(option)}
                    className={`px-3 py-2 text-sm flex items-center gap-2 ${
                      isDisabledOption
                        ? 'opacity-50 cursor-not-allowed'
                        : 'cursor-pointer hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      readOnly
                      className="h-4 w-4 text-accent border-gray-300 rounded"
                    />
                    <span className={isSelected ? 'font-medium' : ''}>
                      {getLabel(option)}
                    </span>
                  </li>
                )
              })
            )}
          </ul>
        </div>
      )}

      {error && <p className="text-red-600 text-sm mt-1">{error}</p>}
    </div>
  )
}
