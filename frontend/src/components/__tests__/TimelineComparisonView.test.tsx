import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TimelineComparisonView } from '../TimelineComparisonView'

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  })

const renderWithProviders = (ui: React.ReactElement) => {
  const queryClient = createQueryClient()
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  )
}

describe('TimelineComparisonView', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('renders when open', () => {
      renderWithProviders(<TimelineComparisonView {...defaultProps} />)
      expect(screen.getByText('Timeline Comparison')).toBeInTheDocument()
    })

    it('does not render when closed', () => {
      renderWithProviders(
        <TimelineComparisonView {...defaultProps} isOpen={false} />
      )
      expect(screen.queryByText('Timeline Comparison')).not.toBeInTheDocument()
    })

    it('shows close button', () => {
      renderWithProviders(<TimelineComparisonView {...defaultProps} />)
      expect(screen.getByRole('button', { name: '×' })).toBeInTheDocument()
    })
  })

  describe('Timeline selectors', () => {
    it('shows left timeline selector', () => {
      renderWithProviders(<TimelineComparisonView {...defaultProps} />)
      expect(screen.getByText('Left Timeline')).toBeInTheDocument()
    })

    it('shows right timeline selector', () => {
      renderWithProviders(<TimelineComparisonView {...defaultProps} />)
      expect(screen.getByText('Right Timeline')).toBeInTheDocument()
    })

    it('shows vs label between selectors', () => {
      renderWithProviders(<TimelineComparisonView {...defaultProps} />)
      expect(screen.getByText('vs')).toBeInTheDocument()
    })

    it('shows placeholder text before selection', () => {
      renderWithProviders(<TimelineComparisonView {...defaultProps} />)
      expect(screen.getByText('Select two timelines to compare')).toBeInTheDocument()
    })
  })

  describe('Empty state', () => {
    it('prompts user to select timelines', () => {
      renderWithProviders(<TimelineComparisonView {...defaultProps} />)
      expect(screen.getByText('Select two timelines to compare')).toBeInTheDocument()
    })
  })

  describe('Callback handlers', () => {
    it('calls onClose when close button is clicked', () => {
      renderWithProviders(<TimelineComparisonView {...defaultProps} />)

      const closeButton = screen.getByRole('button', { name: '×' })
      fireEvent.click(closeButton)

      expect(defaultProps.onClose).toHaveBeenCalled()
    })

    it('accepts onThinkerSelect callback', () => {
      const onThinkerSelect = vi.fn()
      renderWithProviders(
        <TimelineComparisonView {...defaultProps} onThinkerSelect={onThinkerSelect} />
      )
      // Component renders without error
    })
  })

  describe('Timeline selection', () => {
    it('renders timeline select dropdowns', () => {
      renderWithProviders(<TimelineComparisonView {...defaultProps} />)

      const selects = screen.getAllByRole('combobox')
      expect(selects.length).toBe(2)
    })

    it('shows default option in selects', () => {
      renderWithProviders(<TimelineComparisonView {...defaultProps} />)

      const options = screen.getAllByText('Select timeline...')
      expect(options.length).toBe(2)
    })
  })

  describe('Comparison features', () => {
    it('has show overlaps checkbox (hidden until timelines selected)', async () => {
      renderWithProviders(<TimelineComparisonView {...defaultProps} />)

      // Checkbox is only shown when both timelines are selected
      // Before selection, it shouldn't be visible
      expect(screen.queryByText('Show overlaps only')).not.toBeInTheDocument()
    })
  })
})
