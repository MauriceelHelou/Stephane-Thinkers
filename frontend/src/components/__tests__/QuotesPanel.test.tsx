import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '../../test/test-utils'
import userEvent from '@testing-library/user-event'
import { QuotesPanel } from '../QuotesPanel'
import { server } from '../../test/setup'
import { http, HttpResponse } from 'msw'

const API_URL = 'http://localhost:8001'

const mockQuotes = [
  {
    id: 'quote-1',
    thinker_id: 'thinker-1',
    text: 'I had to deny knowledge to make room for faith.',
    source: 'Critique of Pure Reason',
    year: 1781,
    context_notes: 'Preface to the second edition',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  },
  {
    id: 'quote-2',
    thinker_id: 'thinker-1',
    text: 'Thoughts without content are empty, intuitions without concepts are blind.',
    source: 'Critique of Pure Reason',
    year: 1781,
    context_notes: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  },
  {
    id: 'quote-3',
    thinker_id: 'thinker-2',
    text: 'The owl of Minerva spreads its wings only with the falling of the dusk.',
    source: 'Philosophy of Right',
    year: 1820,
    context_notes: 'Preface',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  }
]

const mockThinkers = [
  {
    id: 'thinker-1',
    name: 'Immanuel Kant',
    birth_year: 1724,
    death_year: 1804,
    field: 'Philosophy',
    timeline_id: 'timeline-1',
    position_x: 100,
    position_y: 200,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  },
  {
    id: 'thinker-2',
    name: 'Georg Hegel',
    birth_year: 1770,
    death_year: 1831,
    field: 'Philosophy',
    timeline_id: 'timeline-1',
    position_x: 200,
    position_y: 200,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  }
]

describe('QuotesPanel', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onThinkerSelect: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    server.use(
      http.get(`${API_URL}/api/quotes/`, () => {
        return HttpResponse.json(mockQuotes)
      }),
      http.get(`${API_URL}/api/thinkers/`, () => {
        return HttpResponse.json(mockThinkers)
      }),
      http.post(`${API_URL}/api/quotes/`, async ({ request }) => {
        const body = await request.json() as Record<string, unknown>
        return HttpResponse.json({
          id: 'new-quote-id',
          ...body
        })
      }),
      http.put(`${API_URL}/api/quotes/:id`, async ({ params, request }) => {
        const body = await request.json() as Record<string, unknown>
        return HttpResponse.json({
          id: params.id,
          ...body
        })
      }),
      http.delete(`${API_URL}/api/quotes/:id`, () => {
        return HttpResponse.json({ success: true })
      })
    )
  })

  describe('Panel Rendering', () => {
    it('renders panel when isOpen is true', async () => {
      render(<QuotesPanel {...defaultProps} />)
      expect(screen.getByText('Quote Library')).toBeInTheDocument()
    })

    it('does not render panel when isOpen is false', () => {
      render(<QuotesPanel {...defaultProps} isOpen={false} />)
      expect(screen.queryByText('Quote Library')).not.toBeInTheDocument()
    })

    it('shows quote count in header', async () => {
      render(<QuotesPanel {...defaultProps} />)
      await waitFor(() => {
        expect(screen.getByText(/3 quotes/)).toBeInTheDocument()
      })
    })

    it('shows thinker count in header', async () => {
      render(<QuotesPanel {...defaultProps} />)
      await waitFor(() => {
        expect(screen.getByText(/2 thinkers/)).toBeInTheDocument()
      })
    })

    it('has close button', () => {
      render(<QuotesPanel {...defaultProps} />)
      expect(screen.getByRole('button', { name: '×' })).toBeInTheDocument()
    })

    it('calls onClose when close button clicked', async () => {
      const onClose = vi.fn()
      render(<QuotesPanel {...defaultProps} onClose={onClose} />)
      await userEvent.click(screen.getByRole('button', { name: '×' }))
      expect(onClose).toHaveBeenCalled()
    })

    it('has add quote button', () => {
      render(<QuotesPanel {...defaultProps} />)
      expect(screen.getByRole('button', { name: '+ Add Quote' })).toBeInTheDocument()
    })
  })

  describe('Quote Display', () => {
    it('displays quotes grouped by thinker by default', async () => {
      render(<QuotesPanel {...defaultProps} />)
      await waitFor(() => {
        // Find thinker names in the group headers (span with font-medium class)
        const kantElements = screen.getAllByText('Immanuel Kant')
        expect(kantElements.length).toBeGreaterThan(0)
        const hegelElements = screen.getAllByText('Georg Hegel')
        expect(hegelElements.length).toBeGreaterThan(0)
      })
    })

    it('displays quote text', async () => {
      render(<QuotesPanel {...defaultProps} />)
      await waitFor(() => {
        expect(screen.getByText(/"I had to deny knowledge to make room for faith."/)).toBeInTheDocument()
      })
    })

    it('displays quote source', async () => {
      render(<QuotesPanel {...defaultProps} />)
      await waitFor(() => {
        expect(screen.getByText(/Critique of Pure Reason/)).toBeInTheDocument()
      })
    })

    it('displays quote year', async () => {
      render(<QuotesPanel {...defaultProps} />)
      await waitFor(() => {
        expect(screen.getByText('1781')).toBeInTheDocument()
      })
    })

    it('displays quote context when available', async () => {
      render(<QuotesPanel {...defaultProps} />)
      await waitFor(() => {
        expect(screen.getByText('Preface to the second edition')).toBeInTheDocument()
      })
    })

    it('shows thinker lifespan in group header', async () => {
      render(<QuotesPanel {...defaultProps} />)
      await waitFor(() => {
        expect(screen.getByText(/1724-1804/)).toBeInTheDocument()
      })
    })

    it('shows quote count per thinker', async () => {
      render(<QuotesPanel {...defaultProps} />)
      await waitFor(() => {
        expect(screen.getByText('2 quotes')).toBeInTheDocument()
        expect(screen.getByText('1 quotes')).toBeInTheDocument()
      })
    })

    it('shows loading state', () => {
      render(<QuotesPanel {...defaultProps} />)
      expect(screen.getByText('Loading quotes...')).toBeInTheDocument()
    })

    it('shows empty state when no quotes', async () => {
      server.use(
        http.get(`${API_URL}/api/quotes/`, () => {
          return HttpResponse.json([])
        })
      )
      render(<QuotesPanel {...defaultProps} />)
      await waitFor(() => {
        expect(screen.getByText('No quotes found')).toBeInTheDocument()
      })
    })
  })

  describe('Filtering', () => {
    it('has search input', () => {
      render(<QuotesPanel {...defaultProps} />)
      expect(screen.getByPlaceholderText('Search quotes...')).toBeInTheDocument()
    })

    it('filters quotes by search query', async () => {
      render(<QuotesPanel {...defaultProps} />)
      await waitFor(() => {
        expect(screen.getByText(/"I had to deny knowledge/)).toBeInTheDocument()
      })

      const searchInput = screen.getByPlaceholderText('Search quotes...')
      await userEvent.type(searchInput, 'Minerva')

      await waitFor(() => {
        expect(screen.queryByText(/"I had to deny knowledge/)).not.toBeInTheDocument()
        expect(screen.getByText(/"The owl of Minerva/)).toBeInTheDocument()
      })
    })

    it('filters quotes by thinker', async () => {
      render(<QuotesPanel {...defaultProps} />)
      await waitFor(() => {
        const kantElements = screen.getAllByText('Immanuel Kant')
        expect(kantElements.length).toBeGreaterThan(0)
      })

      const thinkerSelect = screen.getByDisplayValue('All Thinkers')
      await userEvent.selectOptions(thinkerSelect, 'thinker-2')

      await waitFor(() => {
        expect(screen.queryByText(/"I had to deny knowledge/)).not.toBeInTheDocument()
        expect(screen.getByText(/"The owl of Minerva/)).toBeInTheDocument()
      })
    })

    it('has sort by dropdown', () => {
      render(<QuotesPanel {...defaultProps} />)
      expect(screen.getByDisplayValue('Sort by Thinker')).toBeInTheDocument()
    })

    it('sorts by year when selected', async () => {
      render(<QuotesPanel {...defaultProps} />)
      await waitFor(() => {
        const kantElements = screen.getAllByText('Immanuel Kant')
        expect(kantElements.length).toBeGreaterThan(0)
      })

      const sortSelect = screen.getByDisplayValue('Sort by Thinker')
      await userEvent.selectOptions(sortSelect, 'date')

      // In date sort, grouped view changes to flat list
      await waitFor(() => {
        const quotes = screen.getAllByText(/"/);
        expect(quotes.length).toBeGreaterThan(0)
      })
    })

    it('sorts by source when selected', async () => {
      render(<QuotesPanel {...defaultProps} />)
      await waitFor(() => {
        const kantElements = screen.getAllByText('Immanuel Kant')
        expect(kantElements.length).toBeGreaterThan(0)
      })

      const sortSelect = screen.getByDisplayValue('Sort by Thinker')
      await userEvent.selectOptions(sortSelect, 'source')

      await waitFor(() => {
        const quotes = screen.getAllByText(/"/);
        expect(quotes.length).toBeGreaterThan(0)
      })
    })
  })

  describe('Add Quote Form', () => {
    it('opens add form when button clicked', async () => {
      render(<QuotesPanel {...defaultProps} />)
      await userEvent.click(screen.getByRole('button', { name: '+ Add Quote' }))
      expect(screen.getByText('Add New Quote')).toBeInTheDocument()
    })

    it('has thinker select in form', async () => {
      render(<QuotesPanel {...defaultProps} />)
      await userEvent.click(screen.getByRole('button', { name: '+ Add Quote' }))
      expect(screen.getByText('Thinker *')).toBeInTheDocument()
      expect(screen.getByText('Select a thinker...')).toBeInTheDocument()
    })

    it('has quote text textarea', async () => {
      render(<QuotesPanel {...defaultProps} />)
      await userEvent.click(screen.getByRole('button', { name: '+ Add Quote' }))
      expect(screen.getByPlaceholderText('Enter the quote...')).toBeInTheDocument()
    })

    it('has source input', async () => {
      render(<QuotesPanel {...defaultProps} />)
      await userEvent.click(screen.getByRole('button', { name: '+ Add Quote' }))
      expect(screen.getByPlaceholderText('Book, letter, etc.')).toBeInTheDocument()
    })

    it('has year input', async () => {
      render(<QuotesPanel {...defaultProps} />)
      await userEvent.click(screen.getByRole('button', { name: '+ Add Quote' }))
      expect(screen.getByPlaceholderText('e.g., 1781')).toBeInTheDocument()
    })

    it('has context textarea', async () => {
      render(<QuotesPanel {...defaultProps} />)
      await userEvent.click(screen.getByRole('button', { name: '+ Add Quote' }))
      expect(screen.getByPlaceholderText('Historical context or notes about this quote...')).toBeInTheDocument()
    })

    it('has cancel button', async () => {
      render(<QuotesPanel {...defaultProps} />)
      await userEvent.click(screen.getByRole('button', { name: '+ Add Quote' }))
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
    })

    it('closes form on cancel', async () => {
      render(<QuotesPanel {...defaultProps} />)
      await userEvent.click(screen.getByRole('button', { name: '+ Add Quote' }))
      expect(screen.getByText('Add New Quote')).toBeInTheDocument()

      await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
      expect(screen.queryByText('Add New Quote')).not.toBeInTheDocument()
    })

    it('submits new quote', async () => {
      render(<QuotesPanel {...defaultProps} />)
      await waitFor(() => {
        const kantElements = screen.getAllByText('Immanuel Kant')
        expect(kantElements.length).toBeGreaterThan(0)
      })

      await userEvent.click(screen.getByRole('button', { name: '+ Add Quote' }))

      // Fill form
      const thinkerSelect = screen.getByRole('combobox', { name: /thinker/i })
      await userEvent.selectOptions(thinkerSelect, 'thinker-1')

      const quoteTextarea = screen.getByPlaceholderText('Enter the quote...')
      await userEvent.type(quoteTextarea, 'Act only according to that maxim')

      const sourceInput = screen.getByPlaceholderText('Book, letter, etc.')
      await userEvent.type(sourceInput, 'Groundwork')

      const yearInput = screen.getByPlaceholderText('e.g., 1781')
      await userEvent.type(yearInput, '1785')

      await userEvent.click(screen.getByRole('button', { name: 'Add Quote' }))

      // Form should close
      await waitFor(() => {
        expect(screen.queryByText('Add New Quote')).not.toBeInTheDocument()
      })
    })
  })

  describe('Edit Quote', () => {
    it('has edit button on quotes', async () => {
      render(<QuotesPanel {...defaultProps} />)
      await waitFor(() => {
        expect(screen.getByText(/"I had to deny knowledge/)).toBeInTheDocument()
      })

      const editButtons = screen.getAllByTitle('Edit')
      expect(editButtons.length).toBeGreaterThan(0)
    })

    it('opens edit form when edit clicked', async () => {
      render(<QuotesPanel {...defaultProps} />)
      await waitFor(() => {
        expect(screen.getByText(/"I had to deny knowledge/)).toBeInTheDocument()
      })

      const editButtons = screen.getAllByTitle('Edit')
      await userEvent.click(editButtons[0])

      expect(screen.getByText('Edit Quote')).toBeInTheDocument()
    })

    it('populates form with existing quote data', async () => {
      render(<QuotesPanel {...defaultProps} />)
      await waitFor(() => {
        expect(screen.getByText(/"I had to deny knowledge/)).toBeInTheDocument()
      })

      const editButtons = screen.getAllByTitle('Edit')
      await userEvent.click(editButtons[0])

      const quoteTextarea = screen.getByPlaceholderText('Enter the quote...') as HTMLTextAreaElement
      expect(quoteTextarea.value).toBe('I had to deny knowledge to make room for faith.')
    })

    it('disables thinker select in edit mode', async () => {
      render(<QuotesPanel {...defaultProps} />)
      await waitFor(() => {
        expect(screen.getByText(/"I had to deny knowledge/)).toBeInTheDocument()
      })

      const editButtons = screen.getAllByTitle('Edit')
      await userEvent.click(editButtons[0])

      const thinkerSelect = screen.getByRole('combobox', { name: /thinker/i })
      expect(thinkerSelect).toBeDisabled()
    })

    it('shows update button in edit mode', async () => {
      render(<QuotesPanel {...defaultProps} />)
      await waitFor(() => {
        expect(screen.getByText(/"I had to deny knowledge/)).toBeInTheDocument()
      })

      const editButtons = screen.getAllByTitle('Edit')
      await userEvent.click(editButtons[0])

      expect(screen.getByRole('button', { name: 'Update Quote' })).toBeInTheDocument()
    })
  })

  describe('Delete Quote', () => {
    it('has delete button on quotes', async () => {
      render(<QuotesPanel {...defaultProps} />)
      await waitFor(() => {
        expect(screen.getByText(/"I had to deny knowledge/)).toBeInTheDocument()
      })

      const deleteButtons = screen.getAllByTitle('Delete')
      expect(deleteButtons.length).toBeGreaterThan(0)
    })

    it('shows confirmation on delete', async () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)

      render(<QuotesPanel {...defaultProps} />)
      await waitFor(() => {
        expect(screen.getByText(/"I had to deny knowledge/)).toBeInTheDocument()
      })

      const deleteButtons = screen.getAllByTitle('Delete')
      await userEvent.click(deleteButtons[0])

      expect(confirmSpy).toHaveBeenCalledWith('Delete this quote?')
      confirmSpy.mockRestore()
    })

    it('deletes quote on confirmation', async () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

      render(<QuotesPanel {...defaultProps} />)
      await waitFor(() => {
        expect(screen.getByText(/"I had to deny knowledge/)).toBeInTheDocument()
      })

      const deleteButtons = screen.getAllByTitle('Delete')
      await userEvent.click(deleteButtons[0])

      expect(confirmSpy).toHaveBeenCalled()
      confirmSpy.mockRestore()
    })
  })

  describe('Thinker Selection', () => {
    it('clicking thinker name calls onThinkerSelect', async () => {
      const onThinkerSelect = vi.fn()
      render(<QuotesPanel {...defaultProps} onThinkerSelect={onThinkerSelect} />)

      await waitFor(() => {
        const kantElements = screen.getAllByText('Immanuel Kant')
        expect(kantElements.length).toBeGreaterThan(0)
      })

      // Click on thinker group header (the span element, not the option)
      const kantElements = screen.getAllByText('Immanuel Kant')
      // The group header is the span element (second one, after the select option)
      const groupHeader = kantElements.find(el => el.className.includes('font-medium'))
      if (groupHeader) {
        await userEvent.click(groupHeader.parentElement || groupHeader)
      }

      expect(onThinkerSelect).toHaveBeenCalledWith('thinker-1')
    })
  })
})
