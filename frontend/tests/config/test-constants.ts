// API URLs
export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002'
export const FRONTEND_URL = 'http://localhost:3001'

// Test IDs - standardized data-testid values used throughout the app
export const TEST_IDS = {
  // Toolbar
  toolbar: 'toolbar',
  addThinkerButton: 'add-thinker-button',
  addConnectionButton: 'add-connection-button',
  addEventButton: 'add-event-button',
  newTimelineButton: 'new-timeline-button',
  combineViewButton: 'combine-view-button',
  exportButton: 'export-button',
  helpButton: 'help-button',
  analysisButton: 'analysis-button',
  compareButton: 'compare-button',
  aiButton: 'ai-button',
  animateButton: 'animate-button',
  moreMenuButton: 'more-menu-button',
  filterButton: 'filter-button',

  // Canvas
  canvas: 'timeline-canvas',
  canvasContainer: 'canvas-container',
  minimap: 'minimap',
  zoomControls: 'zoom-controls',
  zoomInButton: 'zoom-in-button',
  zoomOutButton: 'zoom-out-button',
  resetZoomButton: 'reset-zoom-button',
  zoomIndicator: 'zoom-indicator',

  // Timeline tabs
  timelineTabs: 'timeline-tabs',
  timelineTab: 'timeline-tab',
  allThinkersTab: 'all-thinkers-tab',
  combinedViewTab: 'combined-view-tab',

  // Modals
  addThinkerModal: 'add-thinker-modal',
  addConnectionModal: 'add-connection-modal',
  addEventModal: 'add-event-modal',
  addTimelineModal: 'add-timeline-modal',
  exportModal: 'export-modal',
  helpGuideModal: 'help-guide-modal',
  tagManagementModal: 'tag-management-modal',
  institutionsModal: 'institutions-modal',
  combinedViewModal: 'combined-view-modal',
  commandPalette: 'command-palette',
  settingsModal: 'settings-modal',

  // Panels
  detailPanel: 'detail-panel',
  notesPanel: 'notes-panel',
  aiPanel: 'ai-panel',
  networkMetricsPanel: 'network-metrics-panel',
  researchQuestionsPanel: 'research-questions-panel',
  quotesPanel: 'quotes-panel',
  quizPanel: 'quiz-panel',

  // Quiz
  quizPopup: 'quiz-popup',
  quizModal: 'quiz-modal',
  quizHistoryPanel: 'quiz-history-panel',

  // Form elements (generic suffixes to combine with modal names)
  nameInput: 'name-input',
  submitButton: 'submit-button',
  cancelButton: 'cancel-button',
  closeButton: 'close-button',

  // Connection legend
  connectionLegend: 'connection-legend',
  influencedCheckbox: 'influenced-checkbox',
  critiquedCheckbox: 'critiqued-checkbox',
  builtUponCheckbox: 'built-upon-checkbox',
  synthesizedCheckbox: 'synthesized-checkbox',
} as const

// Connection types
export const CONNECTION_TYPES = ['influenced', 'critiqued', 'built_upon', 'synthesized'] as const
export type ConnectionType = typeof CONNECTION_TYPES[number]

// Event types
export const EVENT_TYPES = ['council', 'publication', 'war', 'invention', 'cultural', 'political', 'other'] as const
export type EventType = typeof EVENT_TYPES[number]

// Note types
export const NOTE_TYPES = ['general', 'research', 'biography', 'connection'] as const
export type NoteType = typeof NOTE_TYPES[number]

// Note colors
export const NOTE_COLORS = ['yellow', 'pink', 'blue', 'green'] as const
export type NoteColor = typeof NOTE_COLORS[number]

// Question statuses
export const QUESTION_STATUSES = ['open', 'in_progress', 'answered', 'abandoned'] as const
export type QuestionStatus = typeof QUESTION_STATUSES[number]

// Question categories
export const QUESTION_CATEGORIES = ['influence', 'periodization', 'methodology', 'biography', 'other'] as const
export type QuestionCategory = typeof QUESTION_CATEGORIES[number]

// Quiz question categories
export const QUIZ_CATEGORIES = [
  'birth_year', 'death_year', 'quote', 'quote_completion',
  'publication', 'connection', 'field', 'biography'
] as const
export type QuizCategory = typeof QUIZ_CATEGORIES[number]

// Quiz difficulties
export const QUIZ_DIFFICULTIES = ['easy', 'medium', 'hard', 'adaptive'] as const
export type QuizDifficulty = typeof QUIZ_DIFFICULTIES[number]

// Keyboard shortcuts (default)
export const KEYBOARD_SHORTCUTS = {
  addThinker: { key: 't', meta: true },
  addConnection: { key: 'k', meta: true },
  addEvent: { key: 'e', meta: true },
  newTimeline: { key: 'n', meta: true },
  commandPalette: { key: 'p', meta: true, shift: true },
  help: { key: '?' },
  escape: { key: 'Escape' },
  toggleNotes: { key: 'n', meta: true, shift: true },
  zoomIn: { key: '=', meta: true },
  zoomOut: { key: '-', meta: true },
  resetZoom: { key: '0', meta: true },
} as const

// Timeouts
export const TIMEOUTS = {
  short: 1000,
  medium: 5000,
  long: 10000,
  apiCall: 5000,
  animation: 300,
  canvasRender: 500,
} as const

// Viewport sizes
export const VIEWPORTS = {
  mobile: { width: 375, height: 667 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1280, height: 720 },
  largeDesktop: { width: 1920, height: 1080 },
} as const

// Visual regression thresholds
export const VISUAL_THRESHOLDS = {
  canvas: { threshold: 0.2, maxDiffPixels: 100 },
  modal: { threshold: 0.05, maxDiffPixels: 10 },
  text: { threshold: 0.3, maxDiffPixels: 150 },
} as const
