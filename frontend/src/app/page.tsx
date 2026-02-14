'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { timelinesApi, combinedViewsApi, tagsApi, thinkersApi, notesApi } from '@/lib/api'
import type { Tag, Note, Thinker } from '@/types'
import { Timeline } from '@/components/Timeline'
import { CombinedTimelineCanvas } from '@/components/CombinedTimelineCanvas'
import { AddThinkerModal } from '@/components/AddThinkerModal'
import { AddConnectionModal } from '@/components/AddConnectionModal'
import { AddTimelineModal } from '@/components/AddTimelineModal'
import { AddTimelineEventModal } from '@/components/AddTimelineEventModal'
import { CreateCombinedViewModal } from '@/components/CreateCombinedViewModal'
import { TagManagementModal } from '@/components/TagManagementModal'
import { ExportModal } from '@/components/ExportModal'
import { BulkActionsBar } from '@/components/BulkActionsBar'
import { DetailPanel } from '@/components/DetailPanel'
import { HelpGuide } from '@/components/HelpGuide'
import { ConnectionLegend } from '@/components/ConnectionLegend'
import { CanvasControls } from '@/components/CanvasControls'
import { NetworkMetricsPanel } from '@/components/NetworkMetricsPanel'
import { TimelineComparisonView } from '@/components/TimelineComparisonView'
import { AISuggestionsPanel } from '@/components/AISuggestionsPanel'
import { AIChatPanel } from '@/components/AIChatPanel'
import { NotesPanel } from '@/components/NotesPanel'
import { ResearchQuestionsPanel } from '@/components/ResearchQuestionsPanel'
import { InstitutionsManagementModal } from '@/components/InstitutionsManagementModal'
import { QuotesPanel } from '@/components/QuotesPanel'
import { ConnectionMapView } from '@/components/ConnectionMapView'
import QuizPopupModal from '@/components/QuizPopupModal'
import QuizModal from '@/components/QuizModal'
import QuizHistoryPanel from '@/components/QuizHistoryPanel'
import { SettingsModal } from '@/components/SettingsModal'
import { LoginScreen } from '@/components/LoginScreen'
import { StickyNoteModal } from '@/components/StickyNoteModal'
import { OverviewPanel } from '@/components/OverviewPanel'
import { CONNECTION_STYLES, ConnectionStyleType } from '@/lib/constants'

export default function Home() {
  const queryClient = useQueryClient()
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isConnectionModalOpen, setIsConnectionModalOpen] = useState(false)
  const [isAddTimelineModalOpen, setIsAddTimelineModalOpen] = useState(false)
  const [isAddEventModalOpen, setIsAddEventModalOpen] = useState(false)
  const [isCreateCombinedViewModalOpen, setIsCreateCombinedViewModalOpen] = useState(false)
  const [isTagManagementOpen, setIsTagManagementOpen] = useState(false)
  const [isExportModalOpen, setIsExportModalOpen] = useState(false)
  const [isHelpOpen, setIsHelpOpen] = useState(false)
  const [clickPosition, setClickPosition] = useState<{ x: number; y: number } | null>(null)
  const [selectedThinkerId, setSelectedThinkerId] = useState<string | null>(null)
  const [selectedTimelineId, setSelectedTimelineId] = useState<string | null>(null)
  const [selectedCombinedViewId, setSelectedCombinedViewId] = useState<string | null>(null)
  const [connectionMode, setConnectionMode] = useState(false)
  const [connectionFrom, setConnectionFrom] = useState<string | null>(null)
  const [connectionTo, setConnectionTo] = useState<string | null>(null)
  const [editingConnectionId, setEditingConnectionId] = useState<string | null>(null)
  const [editingEventId, setEditingEventId] = useState<string | null>(null)
  const [editingTimelineId, setEditingTimelineId] = useState<string | null>(null)
  const [editingCombinedViewId, setEditingCombinedViewId] = useState<string | null>(null)
  const [shiftHeld, setShiftHeld] = useState(false)
  const [bulkSelectedIds, setBulkSelectedIds] = useState<string[]>([])
  const [bulkSelectMode, setBulkSelectMode] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [visibleConnectionTypes, setVisibleConnectionTypes] = useState<ConnectionStyleType[]>(
    Object.keys(CONNECTION_STYLES) as ConnectionStyleType[]
  )
  const [showConnectionLabels, setShowConnectionLabels] = useState(true)
  const [showConnectionLegend, setShowConnectionLegend] = useState(true)
  const [isNetworkMetricsOpen, setIsNetworkMetricsOpen] = useState(false)
  const [isComparisonViewOpen, setIsComparisonViewOpen] = useState(false)
  const [isAIPanelOpen, setIsAIPanelOpen] = useState(false)
  const [isAIChatOpen, setIsAIChatOpen] = useState(false)
  const [isNotesPanelOpen, setIsNotesPanelOpen] = useState(false)
  const [isResearchQuestionsOpen, setIsResearchQuestionsOpen] = useState(false)
  const [isInstitutionsModalOpen, setIsInstitutionsModalOpen] = useState(false)
  const [isQuotesPanelOpen, setIsQuotesPanelOpen] = useState(false)
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const [isConnectionMapOpen, setIsConnectionMapOpen] = useState(false)
  const [connectionMapThinkerId, setConnectionMapThinkerId] = useState<string | null>(null)

  // Quiz state
  const [isQuizPopupOpen, setIsQuizPopupOpen] = useState(false)
  const [isQuizModalOpen, setIsQuizModalOpen] = useState(false)
  const [isQuizHistoryOpen, setIsQuizHistoryOpen] = useState(false)
  const [hasShownQuizPopup, setHasShownQuizPopup] = useState(false)
  const [quizReviewMode, setQuizReviewMode] = useState(false)

  // Settings state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  // Overview panel state
  const [isOverviewPanelOpen, setIsOverviewPanelOpen] = useState(false)

  // Sticky note state
  const [stickyNoteMode, setStickyNoteMode] = useState(false)
  const [stickyNotePosition, setStickyNotePosition] = useState<{ x: number; y: number } | null>(null)
  const [isStickyNoteModalOpen, setIsStickyNoteModalOpen] = useState(false)
  const [editingStickyNote, setEditingStickyNote] = useState<Note | null>(null)
  const [showStickyNotes, setShowStickyNotes] = useState(true) // Toggle visibility of sticky notes

  // Tab scroll indicators
  const tabsScrollRef = useRef<HTMLDivElement>(null)
  const [showLeftArrow, setShowLeftArrow] = useState(false)
  const [showRightArrow, setShowRightArrow] = useState(false)

  const { data: timelines = [] } = useQuery({
    queryKey: ['timelines'],
    queryFn: timelinesApi.getAll,
  })

  const { data: combinedViews = [] } = useQuery({
    queryKey: ['combined-views'],
    queryFn: combinedViewsApi.getAll,
  })

  const { data: tags = [] } = useQuery({
    queryKey: ['tags'],
    queryFn: tagsApi.getAll,
  })

  const { data: allThinkers = [] } = useQuery({
    queryKey: ['thinkers'],
    queryFn: () => thinkersApi.getAll(),
  })

  // Canvas notes (sticky notes)
  // Reduce polling frequency to prevent laggy network calls
  const { data: canvasNotes = [] } = useQuery({
    queryKey: ['canvas-notes'],
    queryFn: notesApi.getCanvasNotes,
    staleTime: 30000, // Consider data fresh for 30 seconds
    refetchInterval: false, // Disable automatic polling
    refetchOnWindowFocus: false, // Don't refetch on window focus
  })

  // Extract unique fields from thinkers for the field filter
  const uniqueFields = Array.from(
    new Set(
      allThinkers
        .map((t: { field?: string | null }) => t.field)
        .filter((field): field is string => !!field && field.trim() !== '')
    )
  ).sort()

  const [filterTagIds, setFilterTagIds] = useState<string[]>([])
  const [showTagFilterDropdown, setShowTagFilterDropdown] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('')
  const [showSearchDropdown, setShowSearchDropdown] = useState(false)
  const [filterField, setFilterField] = useState<string>('')
  const [filterYearStart, setFilterYearStart] = useState<string>('')
  const [filterYearEnd, setFilterYearEnd] = useState<string>('')
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)

  // Check authentication on mount
  useEffect(() => {
    const token = sessionStorage.getItem('auth_token')
    const isAuth = sessionStorage.getItem('authenticated') === 'true' && !!token
    setIsAuthenticated(isAuth)
  }, [])

  // Debounce search query for performance
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Compute search results for dropdown
  const searchResults = searchQuery.trim()
    ? allThinkers
        .filter((t: { name: string }) =>
          t.name.toLowerCase().includes(searchQuery.toLowerCase())
        )
        .slice(0, 8) // Limit to 8 results
    : []

  const handleToggleFilterTag = (tagId: string) => {
    setFilterTagIds(prev =>
      prev.includes(tagId)
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    )
  }

  const clearTagFilters = () => {
    setFilterTagIds([])
  }

  const clearAllFilters = () => {
    setFilterTagIds([])
    setFilterField('')
    setFilterYearStart('')
    setFilterYearEnd('')
    setSearchQuery('')
    setDebouncedSearchQuery('')
  }

  const hasActiveFilters = filterTagIds.length > 0 || filterField !== '' || filterYearStart !== '' || filterYearEnd !== '' || searchQuery !== ''

  // Connection type visibility handlers
  const handleToggleConnectionType = (type: ConnectionStyleType) => {
    setVisibleConnectionTypes(prev => {
      return prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type]
    })
  }

  const handleToggleAllConnectionTypes = (visible: boolean) => {
    if (visible) {
      const allTypes = Object.keys(CONNECTION_STYLES) as ConnectionStyleType[]
      setVisibleConnectionTypes(allTypes)
    } else {
      setVisibleConnectionTypes([])
    }
  }

  const deleteTimelineMutation = useMutation({
    mutationFn: timelinesApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timelines'] })
      // If the deleted timeline was selected, reset to "All Thinkers"
      setSelectedTimelineId(null)
    },
  })

  const deleteCombinedViewMutation = useMutation({
    mutationFn: combinedViewsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['combined-views'] })
      // If the deleted view was selected, reset to "All Thinkers"
      setSelectedCombinedViewId(null)
    },
  })

  // Mutation for updating thinker position (anchor_year and position_y)
  // When dragging, we set is_manually_positioned=true to preserve the position during repopulate
  // Uses optimistic update to avoid snap-back on production latency
  const updateThinkerPositionMutation = useMutation({
    mutationFn: ({ id, anchor_year, position_y }: { id: string; anchor_year: number; position_y: number }) =>
      thinkersApi.update(id, { anchor_year, position_y, is_manually_positioned: true }),
    onMutate: async ({ id, anchor_year, position_y }) => {
      await queryClient.cancelQueries({ queryKey: ['thinkers'] })
      const previous = queryClient.getQueryData<Thinker[]>(['thinkers'])
      queryClient.setQueryData<Thinker[]>(['thinkers'], (old) =>
        old?.map((t) =>
          t.id === id ? { ...t, anchor_year, position_y, is_manually_positioned: true } : t
        )
      )
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['thinkers'], context.previous)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['thinkers'] })
    },
  })

  // Mutation for updating note position
  // Uses optimistic update to avoid snap-back on production latency
  const updateNotePositionMutation = useMutation({
    mutationFn: ({ id, position_x, position_y }: { id: string; position_x: number; position_y: number }) =>
      notesApi.update(id, { position_x, position_y }),
    onMutate: async ({ id, position_x, position_y }) => {
      await queryClient.cancelQueries({ queryKey: ['canvas-notes'] })
      const previous = queryClient.getQueryData<Note[]>(['canvas-notes'])
      queryClient.setQueryData<Note[]>(['canvas-notes'], (old) =>
        old?.map((n) =>
          n.id === id ? { ...n, position_x, position_y } : n
        )
      )
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['canvas-notes'], context.previous)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['canvas-notes'] })
    },
  })

  // Mutation for repopulating thinker positions
  const [isRepopulating, setIsRepopulating] = useState(false)
  const repopulateMutation = useMutation({
    mutationFn: (timelineId: string | null) =>
      timelineId ? timelinesApi.repopulate(timelineId) : timelinesApi.repopulateAll(),
    onMutate: () => {
      setIsRepopulating(true)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['thinkers'] })
      setIsRepopulating(false)
    },
    onError: () => {
      setIsRepopulating(false)
    },
  })

  const handleRepopulate = () => {
    if (!isRepopulating && !selectedCombinedViewId) {
      repopulateMutation.mutate(selectedTimelineId)
    }
  }

  const selectedTimeline = selectedTimelineId
    ? timelines.find((t) => t.id === selectedTimelineId) || null
    : null

  // Track any open modal to prevent keyboard shortcuts when typing
  const isAnyModalOpen = isAddModalOpen || isConnectionModalOpen || isAddTimelineModalOpen ||
    isAddEventModalOpen || isCreateCombinedViewModalOpen || isTagManagementOpen || isExportModalOpen ||
    isHelpOpen || isNotesPanelOpen || isResearchQuestionsOpen || isInstitutionsModalOpen || isStickyNoteModalOpen

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (showMoreMenu && !target.closest('[data-more-menu]')) {
        setShowMoreMenu(false)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [showMoreMenu])

  // Tab scroll overflow detection
  useEffect(() => {
    const checkScrollOverflow = () => {
      const container = tabsScrollRef.current
      if (!container) return

      const { scrollLeft, scrollWidth, clientWidth } = container
      setShowLeftArrow(scrollLeft > 0)
      setShowRightArrow(scrollLeft + clientWidth < scrollWidth - 1)
    }

    const container = tabsScrollRef.current
    if (container) {
      checkScrollOverflow()
      container.addEventListener('scroll', checkScrollOverflow)
      window.addEventListener('resize', checkScrollOverflow)
    }

    return () => {
      if (container) {
        container.removeEventListener('scroll', checkScrollOverflow)
      }
      window.removeEventListener('resize', checkScrollOverflow)
    }
  }, [timelines, combinedViews]) // Re-check when tabs change

  // Keep the currently selected tab visible on narrow screens.
  useEffect(() => {
    const container = tabsScrollRef.current
    if (!container) return
    const mainContainer = container.closest('main[role="main"]') as HTMLElement | null

    const getActiveTabSelector = () => {
      if (selectedCombinedViewId) {
        return `[data-tab-type=\"combined\"][data-tab-id=\"${selectedCombinedViewId}\"]`
      }
      if (selectedTimelineId) {
        return `[data-tab-type=\"timeline\"][data-tab-id=\"${selectedTimelineId}\"]`
      }
      return '[data-tab-type=\"all\"]'
    }

    const resetMainScroll = () => {
      if (mainContainer && mainContainer.scrollLeft !== 0) {
        mainContainer.scrollTo({ left: 0, behavior: 'auto' })
      }
    }

    const scrollActiveTabIntoView = (behavior: ScrollBehavior) => {
      const activeTab = container.querySelector<HTMLElement>(getActiveTabSelector())
      if (!activeTab) return

      const containerRect = container.getBoundingClientRect()
      const activeTabRect = activeTab.getBoundingClientRect()
      const currentLeft = container.scrollLeft
      const currentRight = currentLeft + container.clientWidth
      const tabLeft = activeTabRect.left - containerRect.left + currentLeft
      const tabRight = activeTabRect.right - containerRect.left + currentLeft
      const edgePadding = 16

      let targetLeft = currentLeft
      if (tabLeft < currentLeft + edgePadding) {
        targetLeft = Math.max(0, tabLeft - edgePadding)
      } else if (tabRight > currentRight - edgePadding) {
        targetLeft = tabRight - container.clientWidth + edgePadding
      }

      if (Math.abs(targetLeft - currentLeft) > 1) {
        container.scrollTo({ left: targetLeft, behavior })
      }
    }

    requestAnimationFrame(() => {
      resetMainScroll()
      scrollActiveTabIntoView('smooth')
    })

    const resizeObserver = new ResizeObserver(() => {
      resetMainScroll()
      scrollActiveTabIntoView('auto')
    })
    resizeObserver.observe(container)

    const handleResize = () => {
      resetMainScroll()
      scrollActiveTabIntoView('auto')
    }
    window.addEventListener('resize', handleResize)

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', handleResize)
    }
  }, [selectedTimelineId, selectedCombinedViewId, timelines, combinedViews])

  // Scroll tabs programmatically
  const scrollTabs = useCallback((direction: 'left' | 'right') => {
    const container = tabsScrollRef.current
    if (!container) return

    const scrollAmount = 200
    container.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth'
    })
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Track shift key for quick connection mode (Shift+Click)
      if (e.key === 'Shift') {
        setShiftHeld(true)
      }

      // Don't trigger shortcuts when typing in inputs or when modals are open
      if (isAnyModalOpen || e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
        return
      }

      // Always use Ctrl for shortcuts (not Cmd on Mac)
      const modifier = e.ctrlKey

      // Escape - close panel, cancel connection mode, or cancel sticky note mode
      if (e.key === 'Escape') {
        if (stickyNoteMode) {
          setStickyNoteMode(false)
        } else if (selectedThinkerId) {
          setSelectedThinkerId(null)
        } else if (connectionFrom) {
          setConnectionFrom(null)
          setConnectionTo(null)
        }
      }

      // T - Add Thinker (Cmd/Ctrl+T)
      if (modifier && e.key.toLowerCase() === 't') {
        e.preventDefault()
        setClickPosition(null)
        setIsAddModalOpen(true)
      }

      // K - Add Connection (Cmd/Ctrl+K)
      if (modifier && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setConnectionFrom(null)
        setConnectionTo(null)
        setSelectedThinkerId(null)
        setIsConnectionModalOpen(true)
      }

      // E - Add Event (Cmd/Ctrl+E)
      if (modifier && e.key.toLowerCase() === 'e') {
        e.preventDefault()
        setIsAddEventModalOpen(true)
      }

      // N - New Timeline (Cmd/Ctrl+N)
      if (modifier && e.key.toLowerCase() === 'n') {
        e.preventDefault()
        setIsAddTimelineModalOpen(true)
      }

      // ? - Help guide
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault()
        setIsHelpOpen(true)
      }

      // Ctrl+S - Toggle sticky note mode
      if (modifier && e.key.toLowerCase() === 's') {
        e.preventDefault()
        setStickyNoteMode(prev => !prev)
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        setShiftHeld(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [isAnyModalOpen, selectedThinkerId, connectionFrom, stickyNoteMode])

  const handleCanvasClick = (position: { x: number; y: number }) => {
    if (connectionMode) return

    // If in sticky note mode, create a sticky note at this position
    if (stickyNoteMode) {
      setStickyNotePosition(position)
      setEditingStickyNote(null)
      setIsStickyNoteModalOpen(true)
      setStickyNoteMode(false) // Exit sticky note mode after placing
      return
    }

    setClickPosition(position)
    setIsAddModalOpen(true)
  }

  // Handle sticky note click (for editing)
  const handleNoteClick = useCallback((noteId: string) => {
    const note = canvasNotes.find((n: Note) => n.id === noteId)
    if (note) {
      setEditingStickyNote(note)
      setStickyNotePosition(null)
      setIsStickyNoteModalOpen(true)
    }
  }, [canvasNotes])

  const handleCloseStickyNoteModal = () => {
    setIsStickyNoteModalOpen(false)
    setEditingStickyNote(null)
    setStickyNotePosition(null)
  }

  // Handle thinker click with Shift for quick connections and Ctrl/Cmd for bulk selection
  const handleThinkerClick = useCallback((thinkerId: string, isShiftClick?: boolean, isCtrlClick?: boolean, isAltClick?: boolean) => {
    const useShift = isShiftClick ?? shiftHeld

    // Ctrl/Cmd+Click toggles bulk selection (without Shift)
    if (isCtrlClick && !useShift) {
      setBulkSelectedIds(prev =>
        prev.includes(thinkerId)
          ? prev.filter(id => id !== thinkerId)
          : [...prev, thinkerId]
      )
      return
    }

    // Shift+Click for quick connection mode
    if (connectionMode || useShift) {
      if (!connectionFrom) {
        setConnectionFrom(thinkerId)
      } else if (connectionFrom !== thinkerId) {
        setConnectionTo(thinkerId)
        setIsConnectionModalOpen(true)
        setConnectionMode(false)
      }
    } else {
      // Clear bulk selection when regular clicking
      if (bulkSelectedIds.length > 0) {
        setBulkSelectedIds([])
      }
      setSelectedThinkerId(thinkerId)
    }
  }, [shiftHeld, connectionMode, connectionFrom, bulkSelectedIds])

  const handleCloseDetailPanel = () => {
    setSelectedThinkerId(null)
  }

  // Handle thinker drag - save the new anchor_year and position_y
  const handleThinkerDrag = useCallback((thinkerId: string, anchorYear: number, positionY: number) => {
    updateThinkerPositionMutation.mutate({
      id: thinkerId,
      anchor_year: anchorYear,
      position_y: positionY,
    })
  }, [updateThinkerPositionMutation])

  // Handle note drag - save the new position_x and position_y
  const handleNoteDrag = useCallback((noteId: string, positionX: number, positionY: number) => {
    updateNotePositionMutation.mutate({
      id: noteId,
      position_x: positionX,
      position_y: positionY,
    })
  }, [updateNotePositionMutation])

  const handleOpenConnectionMap = (thinkerId: string) => {
    setConnectionMapThinkerId(thinkerId)
    setIsConnectionMapOpen(true)
  }

  const handleAddConnectionFromThinker = (fromThinkerId: string) => {
    setConnectionFrom(fromThinkerId)
    setConnectionTo(null)
    setIsConnectionModalOpen(true)
  }

  const handleStartConnectionMode = () => {
    // Directly open the connection modal with dropdown selectors
    setConnectionFrom(null)
    setConnectionTo(null)
    setSelectedThinkerId(null)
    setIsConnectionModalOpen(true)
  }

  const handleCancelConnectionMode = () => {
    setConnectionMode(false)
    setConnectionFrom(null)
    setConnectionTo(null)
  }

  const handleConnectionClick = (connectionId: string) => {
    setEditingConnectionId(connectionId)
    setIsConnectionModalOpen(true)
  }

  const handleCloseConnectionModal = () => {
    setIsConnectionModalOpen(false)
    setConnectionFrom(null)
    setConnectionTo(null)
    setEditingConnectionId(null)
  }

  const handleEventClick = (eventId: string) => {
    setEditingEventId(eventId)
    setIsAddEventModalOpen(true)
  }

  const handleCloseEventModal = () => {
    setIsAddEventModalOpen(false)
    setEditingEventId(null)
  }

  const handleEditTimeline = (timelineId: string) => {
    setEditingTimelineId(timelineId)
    setIsAddTimelineModalOpen(true)
  }

  const handleCloseTimelineModal = () => {
    setIsAddTimelineModalOpen(false)
    setEditingTimelineId(null)
  }

  const handleDeleteTimeline = (timelineId: string, timelineName: string) => {
    // First confirmation
    if (confirm(`Are you sure you want to delete the timeline "${timelineName}"?`)) {
      // Second confirmation
      if (confirm(`This will permanently delete "${timelineName}". This action cannot be undone. Are you absolutely sure?`)) {
        deleteTimelineMutation.mutate(timelineId)
      }
    }
  }

  const handleEditCombinedView = (viewId: string) => {
    setEditingCombinedViewId(viewId)
    setIsCreateCombinedViewModalOpen(true)
  }

  const handleCloseCombinedViewModal = () => {
    setIsCreateCombinedViewModalOpen(false)
    setEditingCombinedViewId(null)
  }

  const handleDeleteCombinedView = (viewId: string, viewName: string) => {
    if (confirm(`Are you sure you want to delete the combined view "${viewName}"?`)) {
      deleteCombinedViewMutation.mutate(viewId)
    }
  }

  const handleSelectTimeline = (timelineId: string | null) => {
    setSelectedTimelineId(timelineId)
    setSelectedCombinedViewId(null)
  }

  const handleSelectCombinedView = (viewId: string) => {
    setSelectedCombinedViewId(viewId)
    setSelectedTimelineId(null)
  }

  // Always show Ctrl+ for shortcuts (consistent across platforms)
  const modKey = 'Ctrl+'

  // Show quiz popup on page load (once per browser session)
  useEffect(() => {
    const hasSeenPopup = sessionStorage.getItem('quiz_popup_shown')

    if (!hasSeenPopup && !hasShownQuizPopup) {
      const timer = setTimeout(() => {
        setIsQuizPopupOpen(true)
        setHasShownQuizPopup(true)
        sessionStorage.setItem('quiz_popup_shown', 'true')
      }, 3000) // 3 second delay after page load

      return () => clearTimeout(timer)
    }
  }, [hasShownQuizPopup])

  // Prevent pinch-to-zoom on the timeline canvas area only (not the header)
  useEffect(() => {
    const preventZoom = (e: TouchEvent) => {
      // Only prevent if pinching (2+ touches) and target is in the timeline area
      if (e.touches.length > 1) {
        const target = e.target as HTMLElement
        const isInTimeline = target.closest('#timeline-canvas')
        if (isInTimeline) {
          e.preventDefault()
        }
      }
    }

    const preventGesture = (e: Event) => {
      // Only prevent gestures in the timeline area
      const target = e.target as HTMLElement
      const isInTimeline = target.closest('#timeline-canvas')
      if (isInTimeline) {
        e.preventDefault()
      }
    }

    document.addEventListener('touchmove', preventZoom, { passive: false })
    document.addEventListener('gesturestart', preventGesture, { passive: false })
    document.addEventListener('gesturechange', preventGesture, { passive: false })

    return () => {
      document.removeEventListener('touchmove', preventZoom)
      document.removeEventListener('gesturestart', preventGesture)
      document.removeEventListener('gesturechange', preventGesture)
    }
  }, [])

  // Show loading state while checking auth
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  // Show login screen if not authenticated
  if (!isAuthenticated) {
    return <LoginScreen onSuccess={() => setIsAuthenticated(true)} />
  }

  return (
    <main className="flex flex-col h-screen bg-background overflow-hidden" role="main">
      {/* Skip link for keyboard navigation */}
      <a
        href="#timeline-canvas"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-accent focus:text-white focus:px-4 focus:py-2 focus:rounded"
      >
        Skip to timeline
      </a>

      <header className="flex items-center justify-between px-3 sm:px-6 py-2 border-b border-timeline flex-shrink-0 bg-background z-40 relative">
        <div className="flex items-center gap-2">
          <h1 className="font-serif text-base sm:text-xl font-semibold text-primary truncate">
            <span className="hidden sm:inline">Intellectual Genealogy Mapper</span>
            <span className="sm:hidden">IGM</span>
          </h1>
          <button
            onClick={() => setIsHelpOpen(true)}
            className="w-5 h-5 rounded-full border border-timeline text-gray-400 hover:text-primary hover:border-primary text-xs font-sans flex items-center justify-center flex-shrink-0"
            title="Help (?)"
          >
            ?
          </button>
        </div>

        {/* Mobile menu button */}
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="sm:hidden p-2 hover:bg-gray-100 rounded"
          aria-label="Toggle menu"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isMobileMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
          </svg>
        </button>

        {/* Desktop toolbar */}
        <div className="hidden sm:flex gap-2 items-center">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setShowSearchDropdown(true)
              }}
              onFocus={() => setShowSearchDropdown(true)}
              onBlur={() => {
                // Delay to allow click on dropdown items
                setTimeout(() => setShowSearchDropdown(false), 200)
              }}
              placeholder="Search thinkers..."
              className="w-48 px-3 py-1.5 font-sans text-xs border border-timeline rounded focus:outline-none focus:ring-2 focus:ring-accent pl-8"
            />
            <svg
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('')
                  setShowSearchDropdown(false)
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            )}
            {/* Search results dropdown */}
            {showSearchDropdown && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-timeline rounded shadow-lg z-50 max-h-64 overflow-y-auto">
                {searchResults.map((thinker: { id: string; name: string; birth_year?: number | null; death_year?: number | null; field?: string | null }) => (
                  <button
                    key={thinker.id}
                    onClick={() => {
                      setSelectedThinkerId(thinker.id)
                      setSearchQuery('')
                      setShowSearchDropdown(false)
                    }}
                    className="w-full px-3 py-2 text-left text-xs hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                  >
                    <div className="font-medium text-primary">{thinker.name}</div>
                    <div className="text-gray-500 text-[10px]">
                      {thinker.birth_year && thinker.death_year
                        ? `${thinker.birth_year}–${thinker.death_year}`
                        : thinker.birth_year
                        ? `b. ${thinker.birth_year}`
                        : thinker.death_year
                        ? `d. ${thinker.death_year}`
                        : ''}
                      {thinker.field && <span className="ml-2">{thinker.field}</span>}
                    </div>
                  </button>
                ))}
              </div>
            )}
            {showSearchDropdown && searchQuery.trim() && searchResults.length === 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-timeline rounded shadow-lg z-50 px-3 py-2 text-xs text-gray-500">
                No thinkers found
              </div>
            )}
          </div>
          <button
            onClick={() => {
              setClickPosition(null)
              setIsAddModalOpen(true)
            }}
            className="px-3 py-1.5 font-sans text-xs border border-timeline rounded hover:bg-gray-50"
            title={`Add Thinker (${modKey}T)`}
          >
            Thinker <span className="text-gray-400 ml-1">{modKey}T</span>
          </button>
          <button
            onClick={handleStartConnectionMode}
            className="px-3 py-1.5 font-sans text-xs border border-timeline rounded hover:bg-gray-50"
            title={`Add Connection (${modKey}K)`}
          >
            Connection <span className="text-gray-400 ml-1">{modKey}K</span>
          </button>
          <button
            onClick={() => setIsAddEventModalOpen(true)}
            className="px-3 py-1.5 font-sans text-xs border border-timeline rounded hover:bg-gray-50"
            title={`Add Event (${modKey}E)`}
          >
            Event <span className="text-gray-400 ml-1">{modKey}E</span>
          </button>
          <button
            onClick={() => setIsTagManagementOpen(true)}
            className="px-3 py-1.5 font-sans text-xs border border-timeline rounded hover:bg-gray-50"
            title="Manage Tags"
          >
            Tags
          </button>
          <Link
            href="/notes"
            className="px-3 py-1.5 font-sans text-xs font-medium border border-accent text-accent rounded hover:bg-accent hover:text-white transition-colors"
            title="Notes Workspace"
          >
            Notes
          </Link>
          <div className="relative">
            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`px-3 py-1.5 font-sans text-xs border rounded hover:bg-gray-50 flex items-center gap-1 ${
                hasActiveFilters
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-timeline'
              }`}
              title="Filter Thinkers"
            >
              Filters
              {hasActiveFilters && (
                <span className="bg-accent text-white text-xs px-1.5 rounded-full">!</span>
              )}
            </button>
            {showAdvancedFilters && (
              <div className="absolute top-full right-0 mt-1 bg-white border border-timeline rounded shadow-lg z-30 min-w-[280px]">
                <div className="px-3 py-2 border-b border-timeline flex items-center justify-between">
                  <span className="text-xs font-sans font-medium text-secondary">Filter Thinkers</span>
                  {hasActiveFilters && (
                    <button
                      onClick={clearAllFilters}
                      className="text-xs text-accent hover:underline"
                    >
                      Clear All
                    </button>
                  )}
                </div>

                {/* Field Filter */}
                <div className="px-3 py-2 border-b border-gray-100">
                  <label className="block text-xs font-sans font-medium text-gray-600 mb-1">Field</label>
                  <select
                    value={filterField}
                    onChange={(e) => setFilterField(e.target.value)}
                    className="w-full px-2 py-1.5 text-sm border border-timeline rounded focus:outline-none focus:ring-1 focus:ring-accent"
                  >
                    <option value="">All Fields</option>
                    {uniqueFields.map((field) => (
                      <option key={field} value={field}>{field}</option>
                    ))}
                  </select>
                </div>

                {/* Year Range Filter */}
                <div className="px-3 py-2 border-b border-gray-100">
                  <label className="block text-xs font-sans font-medium text-gray-600 mb-1">Year Range (Active Period)</label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="number"
                      value={filterYearStart}
                      onChange={(e) => setFilterYearStart(e.target.value)}
                      placeholder="From"
                      className="w-24 px-2 py-1.5 text-sm border border-timeline rounded focus:outline-none focus:ring-1 focus:ring-accent"
                    />
                    <span className="text-gray-400">to</span>
                    <input
                      type="number"
                      value={filterYearEnd}
                      onChange={(e) => setFilterYearEnd(e.target.value)}
                      placeholder="To"
                      className="w-24 px-2 py-1.5 text-sm border border-timeline rounded focus:outline-none focus:ring-1 focus:ring-accent"
                    />
                  </div>
                </div>

                {/* Tag Filter */}
                <div className="px-3 py-2 border-b border-gray-100">
                  <label className="block text-xs font-sans font-medium text-gray-600 mb-1">Tags</label>
                  <div className="max-h-32 overflow-y-auto">
                    {tags.length === 0 ? (
                      <p className="text-xs text-gray-500 italic">No tags available</p>
                    ) : (
                      tags.map((tag: Tag) => (
                        <label
                          key={tag.id}
                          className="flex items-center gap-2 py-1 hover:bg-gray-50 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={filterTagIds.includes(tag.id)}
                            onChange={() => handleToggleFilterTag(tag.id)}
                            className="w-3 h-3 text-accent border-gray-300 rounded focus:ring-accent"
                          />
                          <span
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: tag.color || '#64748b' }}
                          />
                          <span className="text-xs font-serif">{tag.name}</span>
                        </label>
                      ))
                    )}
                  </div>
                </div>

                <div className="px-3 py-2">
                  <button
                    onClick={() => setShowAdvancedFilters(false)}
                    className="w-full px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
          {/* More dropdown */}
          <div className="relative" data-more-menu>
            <button
              onClick={() => setShowMoreMenu(!showMoreMenu)}
              className="px-3 py-1.5 font-sans text-xs border border-timeline rounded hover:bg-gray-50 flex items-center gap-1"
            >
              More
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showMoreMenu && (
              <div className="absolute top-full right-0 mt-1 bg-white border border-timeline rounded-lg shadow-lg z-30 min-w-[180px] py-1">
                <button
                  onClick={() => { setIsOverviewPanelOpen(true); setShowMoreMenu(false); }}
                  className="w-full px-4 py-2 text-left text-xs font-sans hover:bg-gray-50 font-medium"
                >
                  Overview (All Data)
                </button>
                <div className="border-t border-gray-100 my-1" />
                <button
                  onClick={() => { setIsNetworkMetricsOpen(true); setShowMoreMenu(false); }}
                  className="w-full px-4 py-2 text-left text-xs font-sans hover:bg-gray-50"
                >
                  Network Analysis
                </button>
                <button
                  onClick={() => { setIsComparisonViewOpen(true); setShowMoreMenu(false); }}
                  className="w-full px-4 py-2 text-left text-xs font-sans hover:bg-gray-50"
                >
                  Compare Timelines
                </button>
                <div className="border-t border-gray-100 my-1" />
                <button
                  onClick={() => { setIsNotesPanelOpen(true); setShowMoreMenu(false); }}
                  className="w-full px-4 py-2 text-left text-xs font-sans hover:bg-gray-50"
                >
                  Research Notes
                </button>
                <button
                  onClick={() => { setIsResearchQuestionsOpen(true); setShowMoreMenu(false); }}
                  className="w-full px-4 py-2 text-left text-xs font-sans hover:bg-gray-50"
                >
                  Research Questions
                </button>
                <button
                  onClick={() => { setIsQuotesPanelOpen(true); setShowMoreMenu(false); }}
                  className="w-full px-4 py-2 text-left text-xs font-sans hover:bg-gray-50"
                >
                  Quote Library
                </button>
                <button
                  onClick={() => { setIsInstitutionsModalOpen(true); setShowMoreMenu(false); }}
                  className="w-full px-4 py-2 text-left text-xs font-sans hover:bg-gray-50"
                >
                  Institutions
                </button>
                <div className="border-t border-gray-100 my-1" />
                <button
                  onClick={() => { setIsAIChatOpen(true); setShowMoreMenu(false); }}
                  className="w-full px-4 py-2 text-left text-xs font-sans hover:bg-gray-50 text-purple-600"
                >
                  AI Assistant
                </button>
                <button
                  onClick={() => { setIsAIPanelOpen(true); setShowMoreMenu(false); }}
                  className="w-full px-4 py-2 text-left text-xs font-sans hover:bg-gray-50"
                >
                  AI Suggestions
                </button>
                <div className="border-t border-gray-100 my-1" />
                <button
                  onClick={() => { setIsQuizModalOpen(true); setShowMoreMenu(false); }}
                  className="w-full px-4 py-2 text-left text-xs font-sans hover:bg-gray-50 text-amber-700 font-medium"
                >
                  Test Me (Quiz)
                </button>
                <button
                  onClick={() => { setIsQuizHistoryOpen(true); setShowMoreMenu(false); }}
                  className="w-full px-4 py-2 text-left text-xs font-sans hover:bg-gray-50"
                >
                  Quiz History & Stats
                </button>
                <div className="border-t border-gray-100 my-1" />
                <button
                  onClick={() => { setIsExportModalOpen(true); setShowMoreMenu(false); }}
                  className="w-full px-4 py-2 text-left text-xs font-sans hover:bg-gray-50"
                >
                  Export
                </button>
                <button
                  onClick={() => { setIsHelpOpen(true); setShowMoreMenu(false); }}
                  className="w-full px-4 py-2 text-left text-xs font-sans hover:bg-gray-50"
                >
                  Help & Shortcuts
                </button>
                <button
                  onClick={() => { setIsSettingsOpen(true); setShowMoreMenu(false); }}
                  className="w-full px-4 py-2 text-left text-xs font-sans hover:bg-gray-50"
                >
                  Settings
                </button>
              </div>
            )}
          </div>
        </div>
        {/* Connection mode indicator */}
        {connectionFrom && (
          <div className="absolute left-1/2 -translate-x-1/2 bg-blue-100 text-blue-800 px-3 py-1 rounded text-xs font-sans hidden sm:block">
            Select second thinker for connection (Shift+Click or Escape to cancel)
          </div>
        )}

        {/* Sticky note mode indicator */}
        {stickyNoteMode && (
          <div className="absolute left-1/2 -translate-x-1/2 bg-yellow-100 text-yellow-800 px-3 py-1 rounded text-xs font-sans hidden sm:block">
            Click on canvas to place sticky note (Press Ctrl+S or Escape to cancel)
          </div>
        )}

        {/* Mobile menu dropdown */}
        {isMobileMenuOpen && (
          <div className="absolute top-full left-0 right-0 bg-white border-b border-timeline shadow-lg z-20 sm:hidden">
            <div className="p-3 space-y-3">
              {/* Search */}
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value)
                    setShowSearchDropdown(true)
                  }}
                  onFocus={() => setShowSearchDropdown(true)}
                  placeholder="Search thinkers..."
                  className="w-full px-3 py-2 font-sans text-sm border border-timeline rounded focus:outline-none focus:ring-2 focus:ring-accent pl-9"
                />
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery('')
                      setShowSearchDropdown(false)
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    ×
                  </button>
                )}
                {/* Mobile search results dropdown */}
                {showSearchDropdown && searchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-timeline rounded shadow-lg z-50 max-h-48 overflow-y-auto">
                    {searchResults.map((thinker: { id: string; name: string; birth_year?: number | null; death_year?: number | null; field?: string | null }) => (
                      <button
                        key={thinker.id}
                        onClick={() => {
                          setSelectedThinkerId(thinker.id)
                          setSearchQuery('')
                          setShowSearchDropdown(false)
                          setIsMobileMenuOpen(false)
                        }}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                      >
                        <div className="font-medium text-primary">{thinker.name}</div>
                        <div className="text-gray-500 text-xs">
                          {thinker.birth_year && thinker.death_year
                            ? `${thinker.birth_year}–${thinker.death_year}`
                            : thinker.birth_year
                            ? `b. ${thinker.birth_year}`
                            : thinker.death_year
                            ? `d. ${thinker.death_year}`
                            : ''}
                          {thinker.field && <span className="ml-2">{thinker.field}</span>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {showSearchDropdown && searchQuery.trim() && searchResults.length === 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-timeline rounded shadow-lg z-50 px-3 py-2 text-sm text-gray-500">
                    No thinkers found
                  </div>
                )}
              </div>

              {/* Primary Actions */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => { setClickPosition(null); setIsAddModalOpen(true); setIsMobileMenuOpen(false); }}
                  className="px-3 py-2 font-sans text-sm bg-accent text-white rounded hover:bg-opacity-90"
                >
                  + Thinker
                </button>
                <button
                  onClick={() => { handleStartConnectionMode(); setIsMobileMenuOpen(false); }}
                  className="px-3 py-2 font-sans text-sm border border-accent text-accent rounded hover:bg-accent/10"
                >
                  + Connection
                </button>
                <button
                  onClick={() => { setIsAddEventModalOpen(true); setIsMobileMenuOpen(false); }}
                  className="px-3 py-2 font-sans text-sm border border-timeline rounded hover:bg-gray-50"
                >
                  + Event
                </button>
              </div>

              {/* Secondary Actions */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100">
                <button
                  onClick={() => { setIsTagManagementOpen(true); setIsMobileMenuOpen(false); }}
                  className="px-3 py-2 font-sans text-sm border border-timeline rounded hover:bg-gray-50"
                >
                  Tags
                </button>
                <button
                  onClick={() => { setShowAdvancedFilters(true); setIsMobileMenuOpen(false); }}
                  className={`px-3 py-2 font-sans text-sm border rounded hover:bg-gray-50 ${hasActiveFilters ? 'border-accent bg-accent/10 text-accent' : 'border-timeline'}`}
                >
                  Filters {hasActiveFilters && '!'}
                </button>
                <button
                  onClick={() => { setIsNetworkMetricsOpen(true); setIsMobileMenuOpen(false); }}
                  className="px-3 py-2 font-sans text-sm border border-timeline rounded hover:bg-gray-50"
                >
                  Analysis
                </button>
                <button
                  onClick={() => { setIsExportModalOpen(true); setIsMobileMenuOpen(false); }}
                  className="px-3 py-2 font-sans text-sm border border-timeline rounded hover:bg-gray-50"
                >
                  Export
                </button>
                <button
                  onClick={() => { setIsAIPanelOpen(true); setIsMobileMenuOpen(false); }}
                  className="px-3 py-2 font-sans text-sm border border-purple-300 text-purple-700 rounded hover:bg-purple-50"
                >
                  AI
                </button>
                <button
                  onClick={() => { setIsHelpOpen(true); setIsMobileMenuOpen(false); }}
                  className="px-3 py-2 font-sans text-sm border border-timeline rounded hover:bg-gray-50"
                >
                  Help
                </button>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Quick Filters Bar - Connection Types & Notes Toggle */}
      {/* HIDDEN - Kept for future use. Controls moved to CanvasControls component in bottom-right */}
      {false && (
        <div className="flex items-center justify-between px-2 sm:px-4 py-1.5 border-b border-gray-100 bg-white flex-shrink-0 z-10">
          {/* Connection Type Toggles */}
          <div className="flex items-center gap-1 sm:gap-2">
            <span className="text-xs text-gray-500 hidden sm:inline">Connections:</span>
            <div className="flex items-center gap-0.5 sm:gap-1">
              {(Object.entries(CONNECTION_STYLES) as [ConnectionStyleType, typeof CONNECTION_STYLES[ConnectionStyleType]][]).map(([type, style]) => {
                const isVisible = visibleConnectionTypes.includes(type)
                return (
                  <button
                    key={type}
                    onClick={() => handleToggleConnectionType(type)}
                    className={`px-2 py-0.5 text-xs rounded-full transition-all flex items-center gap-1 ${
                      isVisible
                        ? 'bg-white border shadow-sm'
                        : 'bg-gray-100 border-transparent opacity-50'
                    }`}
                    style={{
                      borderColor: isVisible ? style.color : 'transparent',
                    }}
                    title={`${isVisible ? 'Hide' : 'Show'} ${style.label} connections`}
                  >
                    <span
                      className="w-3 h-0.5 rounded-full"
                      style={{ backgroundColor: isVisible ? style.color : '#9CA3AF' }}
                    />
                    <span className={`hidden sm:inline ${isVisible ? 'text-gray-700' : 'text-gray-400'}`}>
                      {style.label}
                    </span>
                  </button>
                )
              })}
            </div>
            <button
              onClick={() => handleToggleAllConnectionTypes(visibleConnectionTypes.length === 0)}
              className="px-1.5 py-0.5 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
              title={visibleConnectionTypes.length === 0 ? 'Show all connection types' : 'Hide all connection types'}
            >
              {visibleConnectionTypes.length === 0 ? 'All' : visibleConnectionTypes.length < Object.keys(CONNECTION_STYLES).length ? 'All' : 'None'}
            </button>
          </div>

          {/* Notes Toggle */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowStickyNotes(prev => !prev)}
              className={`px-2 py-0.5 text-xs rounded-full transition-all flex items-center gap-1.5 ${
                showStickyNotes
                  ? 'bg-yellow-50 border border-yellow-300 text-yellow-800'
                  : 'bg-gray-100 text-gray-400'
              }`}
              title={showStickyNotes ? 'Hide sticky notes' : 'Show sticky notes'}
            >
              <span className="text-sm">{showStickyNotes ? '📝' : '📝'}</span>
              <span className="hidden sm:inline">Notes</span>
              {canvasNotes.length > 0 && (
                <span className={`text-xs ${showStickyNotes ? 'text-yellow-600' : 'text-gray-400'}`}>
                  ({canvasNotes.length})
                </span>
              )}
            </button>
            <button
              onClick={() => setStickyNoteMode(prev => !prev)}
              className={`px-2 py-0.5 text-xs rounded transition-all ${
                stickyNoteMode
                  ? 'bg-yellow-200 text-yellow-900 font-medium'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
              title="Add sticky note (Ctrl+S)"
            >
              +
            </button>
          </div>
        </div>
      )}

      {/* Timeline Tabs */}
      <div className="flex items-center px-2 sm:px-4 py-2 sm:py-3 border-b border-timeline bg-gray-50 flex-shrink-0 z-40 relative">
        {/* Fixed action buttons on the left */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => setIsAddTimelineModalOpen(true)}
            className="px-2 sm:px-3 py-1.5 font-sans text-sm border border-timeline border-dashed rounded hover:bg-white hover:border-solid"
            title="New Timeline"
            data-testid="new-timeline-button"
          >
            <span className="sm:hidden">+</span>
            <span className="hidden sm:inline">+new</span>
          </button>
          <button
            onClick={() => setIsCreateCombinedViewModalOpen(true)}
            className="px-2 sm:px-3 py-1.5 font-sans text-sm border border-blue-300 border-dashed rounded hover:bg-blue-50 hover:border-solid text-blue-700"
            title="Combined View"
            data-testid="combine-button"
          >
            <span className="sm:hidden">+c</span>
            <span className="hidden sm:inline">+combine</span>
          </button>
          <div className="hidden sm:block border-l border-timeline h-6 mx-2"></div>
        </div>

        {/* Scrollable tabs area - edge-to-edge horizontal scroll */}
        <div className="flex-1 min-w-0">
          <div
            ref={tabsScrollRef}
            className="flex items-center gap-1 sm:gap-2 overflow-x-auto flex-1 min-w-0 tabs-scrollbar"
            data-testid="tabs-scroll-container"
          >
            <button
              onClick={() => handleSelectTimeline(null)}
              className={`px-4 py-1.5 font-sans text-sm rounded transition-colors flex-shrink-0 ${
                selectedTimelineId === null && selectedCombinedViewId === null
                  ? 'bg-accent text-white'
                  : 'bg-white border border-timeline hover:bg-gray-100'
              }`}
              data-tab-type="all"
            >
              All Thinkers
            </button>
          {timelines.map((timeline) => (
            <div key={timeline.id} className="relative group flex-shrink-0">
              <button
                onClick={() => handleSelectTimeline(timeline.id)}
                className={`px-4 py-1.5 pr-16 font-sans text-sm rounded transition-colors ${
                  selectedTimelineId === timeline.id
                    ? 'bg-accent text-white'
                    : 'bg-white border border-timeline hover:bg-gray-100'
                }`}
                data-testid={`timeline-tab-${timeline.id}`}
                data-tab-type="timeline"
                data-tab-id={timeline.id}
              >
                {timeline.name}
              </button>
              <div className="absolute right-1 top-1/2 -translate-y-1/2 flex gap-0.5">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleEditTimeline(timeline.id)
                  }}
                  className={`w-6 h-6 flex items-center justify-center rounded hover:bg-blue-100 transition-colors text-xs ${
                    selectedTimelineId === timeline.id
                      ? 'text-white hover:text-blue-600'
                      : 'text-gray-400 hover:text-blue-600'
                  }`}
                  aria-label={`Edit ${timeline.name}`}
                  title={`Edit ${timeline.name}`}
                >
                  ✎
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDeleteTimeline(timeline.id, timeline.name)
                  }}
                  className={`w-6 h-6 flex items-center justify-center rounded hover:bg-red-100 transition-colors ${
                    selectedTimelineId === timeline.id
                      ? 'text-white hover:text-red-600'
                      : 'text-gray-400 hover:text-red-600'
                  }`}
                  aria-label={`Delete ${timeline.name}`}
                  title={`Delete ${timeline.name}`}
                >
                  ×
                </button>
              </div>
            </div>
          ))}

          {combinedViews.length > 0 && (
            <div className="border-l border-timeline h-6 mx-2 flex-shrink-0"></div>
          )}

          {combinedViews.map((view) => (
            <div key={view.id} className="relative group flex-shrink-0">
              <button
                onClick={() => handleSelectCombinedView(view.id)}
                className={`px-4 py-1.5 pr-16 font-sans text-sm rounded transition-colors ${
                  selectedCombinedViewId === view.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-blue-50 border border-blue-200 hover:bg-blue-100'
                }`}
                data-testid={`combined-view-tab-${view.id}`}
                data-tab-type="combined"
                data-tab-id={view.id}
              >
                {view.name}
              </button>
              <div className="absolute right-1 top-1/2 -translate-y-1/2 flex gap-0.5">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleEditCombinedView(view.id)
                  }}
                  className={`w-6 h-6 flex items-center justify-center rounded hover:bg-blue-200 transition-colors text-xs ${
                    selectedCombinedViewId === view.id
                      ? 'text-white hover:text-blue-600'
                      : 'text-blue-400 hover:text-blue-600'
                  }`}
                  aria-label={`Edit ${view.name}`}
                  title={`Edit ${view.name}`}
                >
                  ✎
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDeleteCombinedView(view.id, view.name)
                  }}
                  className={`w-6 h-6 flex items-center justify-center rounded hover:bg-red-100 transition-colors ${
                    selectedCombinedViewId === view.id
                      ? 'text-white hover:text-red-600'
                      : 'text-blue-400 hover:text-red-600'
                  }`}
                  aria-label={`Delete ${view.name}`}
                  title={`Delete ${view.name}`}
                >
                  ×
                </button>
              </div>
            </div>
          ))}
          </div>

        </div>

        {/* Repopulate button - always visible */}
        <div className="flex items-center gap-1 flex-shrink-0 ml-2 pl-2 border-l border-timeline">
          <button
            onClick={handleRepopulate}
            disabled={isRepopulating}
            className={`px-3 py-1.5 font-sans text-sm border rounded transition-colors flex items-center gap-1.5 ${
              isRepopulating
                ? 'border-gray-300 bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'border-green-400 text-green-700 hover:bg-green-50 hover:border-green-500'
            }`}
            title={selectedTimelineId
              ? "Auto-position all thinkers on this timeline using force-directed layout"
              : "Auto-position all thinkers using force-directed layout"
            }
          >
            {isRepopulating ? (
              <>
                <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Repositioning...
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Repopulate
              </>
            )}
          </button>
        </div>
      </div>

      <div id="timeline-canvas" className="flex-1 overflow-hidden relative z-[35]" tabIndex={-1}>
        {/* Click outside detail panel to close it - scoped to canvas area */}
        {selectedThinkerId && (
          <div
            className="absolute inset-0 z-30"
            onClick={() => setSelectedThinkerId(null)}
            aria-hidden="true"
          />
        )}
        {selectedCombinedViewId ? (
          <CombinedTimelineCanvas
            viewId={selectedCombinedViewId}
            onThinkerClick={handleThinkerClick}
            onCanvasClick={handleCanvasClick}
            onConnectionClick={handleConnectionClick}
            selectedThinkerId={selectedThinkerId}
            visibleConnectionTypes={visibleConnectionTypes}
            filterByTagIds={filterTagIds}
            searchQuery={debouncedSearchQuery}
            filterByField={filterField}
            filterByYearStart={filterYearStart ? parseInt(filterYearStart, 10) : null}
            filterByYearEnd={filterYearEnd ? parseInt(filterYearEnd, 10) : null}
          />
        ) : (
          <Timeline
            onCanvasClick={handleCanvasClick}
            onThinkerClick={handleThinkerClick}
            onConnectionClick={handleConnectionClick}
            onEventClick={handleEventClick}
            onThinkerDrag={handleThinkerDrag}
            onEmptyClick={handleCloseDetailPanel}
            canvasNotes={showStickyNotes ? canvasNotes : []}
            onNoteClick={handleNoteClick}
            onNoteDrag={handleNoteDrag}
            selectedThinkerId={selectedThinkerId}
            bulkSelectedIds={bulkSelectedIds}
            filterByTimelineId={selectedTimelineId}
            filterByTagIds={filterTagIds}
            searchQuery={debouncedSearchQuery}
            filterByField={filterField}
            filterByYearStart={filterYearStart ? parseInt(filterYearStart, 10) : null}
            filterByYearEnd={filterYearEnd ? parseInt(filterYearEnd, 10) : null}
            selectedTimeline={selectedTimeline}
            visibleConnectionTypes={visibleConnectionTypes}
            showConnectionLabels={showConnectionLabels}
            highlightSelectedConnections={true}
            stickyNoteMode={stickyNoteMode}
          />
        )}

        {/* Canvas Controls - positioned in bottom-left corner */}
        {!selectedCombinedViewId && (
          <div className="absolute bottom-4 left-4 z-10">
            {showConnectionLegend ? (
              <div className="relative">
                <button
                  onClick={() => setShowConnectionLegend(false)}
                  className="absolute -top-2 -right-2 w-6 h-6 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center text-gray-500 shadow-sm z-20"
                  title="Hide controls"
                >
                  &times;
                </button>
                <CanvasControls
                  visibleConnectionTypes={visibleConnectionTypes}
                  onToggleConnectionType={handleToggleConnectionType}
                  onToggleAllConnectionTypes={handleToggleAllConnectionTypes}
                  showConnectionLabels={showConnectionLabels}
                  onToggleConnectionLabels={() => setShowConnectionLabels(prev => !prev)}
                  showStickyNotes={showStickyNotes}
                  onToggleStickyNotes={() => setShowStickyNotes(prev => !prev)}
                  stickyNoteCount={canvasNotes.length}
                  stickyNoteMode={stickyNoteMode}
                  onToggleStickyNoteMode={() => setStickyNoteMode(prev => !prev)}
                />
              </div>
            ) : (
              <button
                onClick={() => setShowConnectionLegend(true)}
                className="px-3 py-2 bg-white rounded-lg shadow-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50"
              >
                Show Controls
              </button>
            )}
          </div>
        )}
      </div>

      <AddThinkerModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        clickPosition={clickPosition}
        defaultTimelineId={selectedTimelineId}
      />

      <AddConnectionModal
        isOpen={isConnectionModalOpen}
        onClose={handleCloseConnectionModal}
        fromThinkerId={connectionFrom}
        toThinkerId={connectionTo}
        editingConnectionId={editingConnectionId}
      />

      <AddTimelineModal
        isOpen={isAddTimelineModalOpen}
        onClose={handleCloseTimelineModal}
        editingTimelineId={editingTimelineId}
      />

      <AddTimelineEventModal
        isOpen={isAddEventModalOpen}
        onClose={handleCloseEventModal}
        defaultTimelineId={selectedTimelineId}
        editingEventId={editingEventId}
      />

      <CreateCombinedViewModal
        isOpen={isCreateCombinedViewModalOpen}
        onClose={handleCloseCombinedViewModal}
        editingViewId={editingCombinedViewId}
      />

      <TagManagementModal
        isOpen={isTagManagementOpen}
        onClose={() => setIsTagManagementOpen(false)}
      />

      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        selectedTimelineId={selectedTimelineId}
        selectedTimeline={selectedTimeline}
      />

      <NetworkMetricsPanel
        isOpen={isNetworkMetricsOpen}
        onClose={() => setIsNetworkMetricsOpen(false)}
        onThinkerSelect={(id) => {
          setSelectedThinkerId(id)
          setIsNetworkMetricsOpen(false)
        }}
      />

      <TimelineComparisonView
        isOpen={isComparisonViewOpen}
        onClose={() => setIsComparisonViewOpen(false)}
        onThinkerSelect={(id) => {
          setSelectedThinkerId(id)
          setIsComparisonViewOpen(false)
        }}
      />

      <AISuggestionsPanel
        isOpen={isAIPanelOpen}
        onClose={() => setIsAIPanelOpen(false)}
        selectedTimelineId={selectedTimelineId}
      />

      <AIChatPanel
        isOpen={isAIChatOpen}
        onClose={() => setIsAIChatOpen(false)}
        onThinkerSelect={(id) => {
          setSelectedThinkerId(id)
          setIsAIChatOpen(false)
        }}
      />

      <NotesPanel
        isOpen={isNotesPanelOpen}
        onClose={() => setIsNotesPanelOpen(false)}
        selectedThinkerId={selectedThinkerId}
        onThinkerSelect={(id) => {
          setSelectedThinkerId(id)
          setIsNotesPanelOpen(false)
        }}
      />

      <ResearchQuestionsPanel
        isOpen={isResearchQuestionsOpen}
        onClose={() => setIsResearchQuestionsOpen(false)}
        onThinkerSelect={(id) => {
          setSelectedThinkerId(id)
          setIsResearchQuestionsOpen(false)
        }}
      />

      <InstitutionsManagementModal
        isOpen={isInstitutionsModalOpen}
        onClose={() => setIsInstitutionsModalOpen(false)}
      />

      <QuotesPanel
        isOpen={isQuotesPanelOpen}
        onClose={() => setIsQuotesPanelOpen(false)}
        onThinkerSelect={(id) => {
          setSelectedThinkerId(id)
          setIsQuotesPanelOpen(false)
        }}
      />

      <ConnectionMapView
        isOpen={isConnectionMapOpen}
        onClose={() => setIsConnectionMapOpen(false)}
        centeredThinkerId={connectionMapThinkerId}
        onThinkerSelect={(id) => {
          setSelectedThinkerId(id)
          setIsConnectionMapOpen(false)
        }}
      />

      <QuizPopupModal
        isOpen={isQuizPopupOpen}
        onClose={() => {
          setIsQuizPopupOpen(false)
          setQuizReviewMode(false)
        }}
        onOpenFullQuiz={() => {
          setIsQuizPopupOpen(false)
          setIsQuizModalOpen(true)
        }}
        selectedTimelineId={selectedTimelineId}
        reviewMode={quizReviewMode}
      />

      <QuizModal
        isOpen={isQuizModalOpen}
        onClose={() => setIsQuizModalOpen(false)}
        selectedTimelineId={selectedTimelineId}
        onSelectThinker={(id) => {
          setSelectedThinkerId(id)
          setIsQuizModalOpen(false)
        }}
      />

      <QuizHistoryPanel
        isOpen={isQuizHistoryOpen}
        onClose={() => setIsQuizHistoryOpen(false)}
        onStartReviewSession={() => {
          setIsQuizHistoryOpen(false)
          setQuizReviewMode(true)
          setIsQuizModalOpen(true)
        }}
      />

      <DetailPanel
        thinkerId={selectedThinkerId}
        onClose={handleCloseDetailPanel}
        onOpenConnectionMap={handleOpenConnectionMap}
        onAddConnection={handleAddConnectionFromThinker}
      />

      <HelpGuide isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

      <StickyNoteModal
        isOpen={isStickyNoteModalOpen}
        onClose={handleCloseStickyNoteModal}
        position={stickyNotePosition}
        editingNote={editingStickyNote}
      />

      <OverviewPanel
        isOpen={isOverviewPanelOpen}
        onClose={() => setIsOverviewPanelOpen(false)}
        onSelectThinker={(id) => {
          setSelectedThinkerId(id)
          setIsOverviewPanelOpen(false)
        }}
        onEditConnection={(id) => {
          setEditingConnectionId(id)
          setConnectionFrom(null)
          setConnectionTo(null)
          setIsConnectionModalOpen(true)
          setIsOverviewPanelOpen(false)
        }}
        onEditEvent={(id) => {
          setEditingEventId(id)
          setIsAddEventModalOpen(true)
          setIsOverviewPanelOpen(false)
        }}
      />

      <BulkActionsBar
        selectedIds={bulkSelectedIds}
        onClearSelection={() => setBulkSelectedIds([])}
        onClose={() => setBulkSelectedIds([])}
      />
    </main>
  )
}
