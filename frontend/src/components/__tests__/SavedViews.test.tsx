import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SavedViews, useViewFromUrl, type SavedView } from '../SavedViews'

describe('SavedViews', () => {
  const mockCurrentView = {
    scale: 1.5,
    offsetX: 100,
    offsetY: 50,
    filterByTimelineId: 'timeline-1',
    filterByTagIds: ['tag-1'],
    filterByField: 'Philosophy',
    filterByYearStart: 1700,
    filterByYearEnd: 1900,
  }

  const defaultProps = {
    currentView: mockCurrentView,
    onLoadView: vi.fn(),
  }

  // Mock localStorage
  const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('localStorage', localStorageMock)
    localStorageMock.getItem.mockReturnValue('[]')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('Rendering', () => {
    it('renders the views button', () => {
      render(<SavedViews {...defaultProps} />)
      expect(screen.getByTitle('Saved Views')).toBeInTheDocument()
    })

    it('shows button text', () => {
      render(<SavedViews {...defaultProps} />)
      expect(screen.getByText('Views')).toBeInTheDocument()
    })
  })

  describe('Modal interaction', () => {
    it('opens modal when button is clicked', async () => {
      render(<SavedViews {...defaultProps} />)

      fireEvent.click(screen.getByTitle('Saved Views'))

      await waitFor(() => {
        expect(screen.getByText('Saved Views')).toBeInTheDocument()
      })
    })

    it('shows save current view button in modal', async () => {
      render(<SavedViews {...defaultProps} />)

      fireEvent.click(screen.getByTitle('Saved Views'))

      await waitFor(() => {
        expect(screen.getByText(/Save Current View/)).toBeInTheDocument()
      })
    })

    it('shows empty state when no views saved', async () => {
      render(<SavedViews {...defaultProps} />)

      fireEvent.click(screen.getByTitle('Saved Views'))

      await waitFor(() => {
        expect(screen.getByText(/No saved views yet/)).toBeInTheDocument()
      })
    })
  })

  describe('Save view form', () => {
    it('shows input when save button is clicked', async () => {
      render(<SavedViews {...defaultProps} />)

      fireEvent.click(screen.getByTitle('Saved Views'))

      await waitFor(() => {
        fireEvent.click(screen.getByText(/Save Current View/))
      })

      expect(screen.getByPlaceholderText(/View name/)).toBeInTheDocument()
    })

    it('shows save and cancel buttons', async () => {
      render(<SavedViews {...defaultProps} />)

      fireEvent.click(screen.getByTitle('Saved Views'))

      await waitFor(() => {
        fireEvent.click(screen.getByText(/Save Current View/))
      })

      expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
    })

    it('allows entering view name', async () => {
      render(<SavedViews {...defaultProps} />)

      fireEvent.click(screen.getByTitle('Saved Views'))

      await waitFor(() => {
        fireEvent.click(screen.getByText(/Save Current View/))
      })

      const input = screen.getByPlaceholderText(/View name/) as HTMLInputElement
      fireEvent.change(input, { target: { value: 'My Test View' } })
      expect(input.value).toBe('My Test View')
    })

    it('hides form when cancel is clicked', async () => {
      render(<SavedViews {...defaultProps} />)

      fireEvent.click(screen.getByTitle('Saved Views'))

      await waitFor(() => {
        fireEvent.click(screen.getByText(/Save Current View/))
      })

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

      expect(screen.queryByPlaceholderText(/View name/)).not.toBeInTheDocument()
    })

    it('saves view to localStorage when submitted', async () => {
      render(<SavedViews {...defaultProps} />)

      fireEvent.click(screen.getByTitle('Saved Views'))

      await waitFor(() => {
        fireEvent.click(screen.getByText(/Save Current View/))
      })

      const input = screen.getByPlaceholderText(/View name/)
      fireEvent.change(input, { target: { value: 'My View' } })
      fireEvent.click(screen.getByRole('button', { name: 'Save' }))

      expect(localStorageMock.setItem).toHaveBeenCalled()
    })
  })

  describe('Loading views from localStorage', () => {
    it('loads saved views on mount', () => {
      const savedViews: SavedView[] = [
        {
          id: '1',
          name: 'Test View',
          scale: 2,
          offsetX: 0,
          offsetY: 0,
          createdAt: new Date().toISOString(),
        },
      ]
      localStorageMock.getItem.mockReturnValue(JSON.stringify(savedViews))

      render(<SavedViews {...defaultProps} />)

      expect(localStorageMock.getItem).toHaveBeenCalled()
    })

    it('displays saved views in list', async () => {
      const savedViews: SavedView[] = [
        {
          id: '1',
          name: 'German Idealism',
          scale: 2,
          offsetX: 0,
          offsetY: 0,
          createdAt: new Date().toISOString(),
        },
      ]
      localStorageMock.getItem.mockReturnValue(JSON.stringify(savedViews))

      render(<SavedViews {...defaultProps} />)

      fireEvent.click(screen.getByTitle('Saved Views'))

      await waitFor(() => {
        expect(screen.getByText('German Idealism')).toBeInTheDocument()
      })
    })
  })

  describe('View loading', () => {
    it('calls onLoadView when view is clicked', async () => {
      const savedViews: SavedView[] = [
        {
          id: '1',
          name: 'Test View',
          scale: 2,
          offsetX: 100,
          offsetY: 50,
          createdAt: new Date().toISOString(),
        },
      ]
      localStorageMock.getItem.mockReturnValue(JSON.stringify(savedViews))

      render(<SavedViews {...defaultProps} />)

      fireEvent.click(screen.getByTitle('Saved Views'))

      await waitFor(() => {
        const viewButton = screen.getByText('Test View')
        fireEvent.click(viewButton)
      })

      expect(defaultProps.onLoadView).toHaveBeenCalled()
    })
  })
})

describe('useViewFromUrl', () => {
  beforeEach(() => {
    // Reset URL
    window.history.replaceState({}, '', '/')
  })

  function TestComponent() {
    const view = useViewFromUrl()

    return (
      <div>
        {view ? (
          <div data-testid="view">
            scale: {view.scale}, offsetX: {view.offsetX}
          </div>
        ) : (
          <div data-testid="no-view">No view</div>
        )}
      </div>
    )
  }

  it('returns null when no URL params', () => {
    render(<TestComponent />)
    expect(screen.getByTestId('no-view')).toBeInTheDocument()
  })

  it('parses scale from URL params', async () => {
    window.history.replaceState({}, '', '/?scale=2')

    render(<TestComponent />)

    await waitFor(() => {
      expect(screen.getByTestId('view')).toBeInTheDocument()
      expect(screen.getByTestId('view').textContent).toContain('scale: 2')
    })
  })

  it('parses offset from URL params', async () => {
    window.history.replaceState({}, '', '/?scale=1&offsetX=100')

    render(<TestComponent />)

    await waitFor(() => {
      expect(screen.getByTestId('view').textContent).toContain('offsetX: 100')
    })
  })
})
