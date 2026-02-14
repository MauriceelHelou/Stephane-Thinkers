import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '../../test/test-utils'
import userEvent from '@testing-library/user-event'
import { AIChatPanel } from '../AIChatPanel'
import { server } from '../../test/setup'
import { http, HttpResponse } from 'msw'

const API_URL = 'http://localhost:8010'

describe('AIChatPanel', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onThinkerSelect: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    // Setup default AI handlers
    server.use(
      http.post(`${API_URL}/api/ai/chat`, async () => {
        return HttpResponse.json({
          answer: 'This is a test response from the AI.',
          citations: [
            { type: 'thinker', id: 'thinker-1', name: 'Immanuel Kant' }
          ],
          follow_up_questions: ['What about Hegel?', 'How did this influence metaphysics?']
        })
      }),
      http.post(`${API_URL}/api/ai/summary`, async () => {
        return HttpResponse.json({
          summary: 'Test summary of the database.',
          key_points: ['Point 1', 'Point 2'],
          key_figures: ['Kant', 'Hegel'],
          themes: ['Idealism', 'Ethics'],
          length: 'medium'
        })
      }),
      http.post(`${API_URL}/api/ai/parse`, async () => {
        return HttpResponse.json({
          entity_type: 'thinker',
          data: {
            name: 'Immanuel Kant',
            birth_year: 1724,
            death_year: 1804,
            field: 'Philosophy'
          },
          confidence: 0.95,
          needs_clarification: []
        })
      })
    )
  })

  describe('Panel Rendering', () => {
    it('renders panel when isOpen is true', () => {
      render(<AIChatPanel {...defaultProps} />)
      expect(screen.getByText('AI Research Assistant')).toBeInTheDocument()
    })

    it('does not render panel when isOpen is false', () => {
      render(<AIChatPanel {...defaultProps} isOpen={false} />)
      expect(screen.queryByText('AI Research Assistant')).not.toBeInTheDocument()
    })

    it('renders all three tabs', () => {
      render(<AIChatPanel {...defaultProps} />)
      expect(screen.getByText('Ask Questions')).toBeInTheDocument()
      expect(screen.getByText('Generate Summary')).toBeInTheDocument()
      expect(screen.getByText('Quick Add')).toBeInTheDocument()
    })

    it('has close button', () => {
      render(<AIChatPanel {...defaultProps} />)
      expect(screen.getByRole('button', { name: '×' })).toBeInTheDocument()
    })

    it('calls onClose when close button clicked', async () => {
      const onClose = vi.fn()
      render(<AIChatPanel {...defaultProps} onClose={onClose} />)
      await userEvent.click(screen.getByRole('button', { name: '×' }))
      expect(onClose).toHaveBeenCalled()
    })
  })

  describe('Chat Tab', () => {
    it('shows chat placeholder when no messages', () => {
      render(<AIChatPanel {...defaultProps} />)
      expect(screen.getByText('Ask questions about your research')).toBeInTheDocument()
    })

    it('shows suggested questions', () => {
      render(<AIChatPanel {...defaultProps} />)
      expect(screen.getByText('"Who are the most influential thinkers?"')).toBeInTheDocument()
      expect(screen.getByText('"What connections exist between philosophers?"')).toBeInTheDocument()
    })

    it('has input field and send button', () => {
      render(<AIChatPanel {...defaultProps} />)
      expect(screen.getByPlaceholderText('Ask a question...')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Send' })).toBeInTheDocument()
    })

    it('disables send button when input is empty', () => {
      render(<AIChatPanel {...defaultProps} />)
      expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
    })

    it('enables send button when input has text', async () => {
      render(<AIChatPanel {...defaultProps} />)
      const input = screen.getByPlaceholderText('Ask a question...')
      await userEvent.type(input, 'Test question')
      expect(screen.getByRole('button', { name: 'Send' })).not.toBeDisabled()
    })

    it('sends message and displays response', async () => {
      render(<AIChatPanel {...defaultProps} />)
      const input = screen.getByPlaceholderText('Ask a question...')

      await userEvent.type(input, 'Who is Kant?')
      await userEvent.click(screen.getByRole('button', { name: 'Send' }))

      // User message should appear
      await waitFor(() => {
        expect(screen.getByText('Who is Kant?')).toBeInTheDocument()
      })

      // AI response should appear
      await waitFor(() => {
        expect(screen.getByText('This is a test response from the AI.')).toBeInTheDocument()
      })
    })

    it('displays citations in response', async () => {
      render(<AIChatPanel {...defaultProps} />)
      const input = screen.getByPlaceholderText('Ask a question...')

      await userEvent.type(input, 'Who is Kant?')
      await userEvent.click(screen.getByRole('button', { name: 'Send' }))

      await waitFor(() => {
        expect(screen.getByText('Sources:')).toBeInTheDocument()
        expect(screen.getByText('Immanuel Kant')).toBeInTheDocument()
      })
    })

    it('displays follow-up questions', async () => {
      render(<AIChatPanel {...defaultProps} />)
      const input = screen.getByPlaceholderText('Ask a question...')

      await userEvent.type(input, 'Who is Kant?')
      await userEvent.click(screen.getByRole('button', { name: 'Send' }))

      await waitFor(() => {
        expect(screen.getByText('Follow-up questions:')).toBeInTheDocument()
        expect(screen.getByText('What about Hegel?')).toBeInTheDocument()
      })
    })

    it('clicking citation calls onThinkerSelect', async () => {
      const onThinkerSelect = vi.fn()
      render(<AIChatPanel {...defaultProps} onThinkerSelect={onThinkerSelect} />)
      const input = screen.getByPlaceholderText('Ask a question...')

      await userEvent.type(input, 'Who is Kant?')
      await userEvent.click(screen.getByRole('button', { name: 'Send' }))

      await waitFor(async () => {
        const citationButton = screen.getByText('Immanuel Kant')
        await userEvent.click(citationButton)
        expect(onThinkerSelect).toHaveBeenCalledWith('thinker-1')
      })
    })

    it('clicking suggested question fills input', async () => {
      render(<AIChatPanel {...defaultProps} />)
      await userEvent.click(screen.getByText('"Who are the most influential thinkers?"'))

      const input = screen.getByPlaceholderText('Ask a question...') as HTMLInputElement
      expect(input.value).toBe('Who are the most influential thinkers?')
    })

    it('shows loading state while waiting for response', async () => {
      server.use(
        http.post(`${API_URL}/api/ai/chat`, async () => {
          await new Promise(resolve => setTimeout(resolve, 100))
          return HttpResponse.json({
            answer: 'Response',
            citations: [],
            follow_up_questions: []
          })
        })
      )

      render(<AIChatPanel {...defaultProps} />)
      const input = screen.getByPlaceholderText('Ask a question...')

      await userEvent.type(input, 'Test')
      await userEvent.click(screen.getByRole('button', { name: 'Send' }))

      expect(screen.getByText('Thinking...')).toBeInTheDocument()
    })

    it('handles API error gracefully', async () => {
      server.use(
        http.post(`${API_URL}/api/ai/chat`, () => {
          return HttpResponse.error()
        })
      )

      render(<AIChatPanel {...defaultProps} />)
      const input = screen.getByPlaceholderText('Ask a question...')

      await userEvent.type(input, 'Test')
      await userEvent.click(screen.getByRole('button', { name: 'Send' }))

      await waitFor(() => {
        expect(screen.getByText('Sorry, I encountered an error. Please try again.')).toBeInTheDocument()
      })
    })

    it('sends message on Enter key', async () => {
      render(<AIChatPanel {...defaultProps} />)
      const input = screen.getByPlaceholderText('Ask a question...')

      await userEvent.type(input, 'Test question{Enter}')

      await waitFor(() => {
        expect(screen.getByText('Test question')).toBeInTheDocument()
      })
    })
  })

  describe('Summary Tab', () => {
    it('switches to summary tab when clicked', async () => {
      render(<AIChatPanel {...defaultProps} />)
      await userEvent.click(screen.getByText('Generate Summary'))

      expect(screen.getByText('Summary Type')).toBeInTheDocument()
    })

    it('has summary type dropdown', async () => {
      render(<AIChatPanel {...defaultProps} />)
      await userEvent.click(screen.getByText('Generate Summary'))

      expect(screen.getByDisplayValue('Database Overview')).toBeInTheDocument()
    })

    it('has length dropdown', async () => {
      render(<AIChatPanel {...defaultProps} />)
      await userEvent.click(screen.getByText('Generate Summary'))

      expect(screen.getByDisplayValue('Medium (1-2 paragraphs)')).toBeInTheDocument()
    })

    it('shows target input when field type selected', async () => {
      render(<AIChatPanel {...defaultProps} />)
      await userEvent.click(screen.getByText('Generate Summary'))

      const typeSelect = screen.getByDisplayValue('Database Overview')
      await userEvent.selectOptions(typeSelect, 'field')

      expect(screen.getByPlaceholderText('e.g., Philosophy')).toBeInTheDocument()
    })

    it('shows target input when period type selected', async () => {
      render(<AIChatPanel {...defaultProps} />)
      await userEvent.click(screen.getByText('Generate Summary'))

      const typeSelect = screen.getByDisplayValue('Database Overview')
      await userEvent.selectOptions(typeSelect, 'period')

      expect(screen.getByPlaceholderText('e.g., 1700-1800')).toBeInTheDocument()
    })

    it('generates summary on button click', async () => {
      render(<AIChatPanel {...defaultProps} />)
      await userEvent.click(screen.getByText('Generate Summary'))
      // After clicking the tab, the submit button has same text - get all and pick the last one
      const buttons = screen.getAllByRole('button', { name: 'Generate Summary' })
      await userEvent.click(buttons[buttons.length - 1])

      await waitFor(() => {
        expect(screen.getByText('Test summary of the database.')).toBeInTheDocument()
      })
    })

    it('displays key points after generation', async () => {
      render(<AIChatPanel {...defaultProps} />)
      await userEvent.click(screen.getByText('Generate Summary'))
      const buttons = screen.getAllByRole('button', { name: 'Generate Summary' })
      await userEvent.click(buttons[buttons.length - 1])

      await waitFor(() => {
        expect(screen.getByText('Key Points')).toBeInTheDocument()
        expect(screen.getByText('Point 1')).toBeInTheDocument()
        expect(screen.getByText('Point 2')).toBeInTheDocument()
      })
    })

    it('displays key figures after generation', async () => {
      render(<AIChatPanel {...defaultProps} />)
      await userEvent.click(screen.getByText('Generate Summary'))
      const buttons = screen.getAllByRole('button', { name: 'Generate Summary' })
      await userEvent.click(buttons[buttons.length - 1])

      await waitFor(() => {
        expect(screen.getByText('Key Figures')).toBeInTheDocument()
        expect(screen.getByText('Kant')).toBeInTheDocument()
        expect(screen.getByText('Hegel')).toBeInTheDocument()
      })
    })

    it('displays themes after generation', async () => {
      render(<AIChatPanel {...defaultProps} />)
      await userEvent.click(screen.getByText('Generate Summary'))
      const buttons = screen.getAllByRole('button', { name: 'Generate Summary' })
      await userEvent.click(buttons[buttons.length - 1])

      await waitFor(() => {
        expect(screen.getByText('Themes')).toBeInTheDocument()
        expect(screen.getByText('Idealism')).toBeInTheDocument()
        expect(screen.getByText('Ethics')).toBeInTheDocument()
      })
    })
  })

  describe('Quick Add Tab', () => {
    it('switches to quick add tab when clicked', async () => {
      render(<AIChatPanel {...defaultProps} />)
      await userEvent.click(screen.getByText('Quick Add'))

      expect(screen.getByText('Enter information in natural language:')).toBeInTheDocument()
    })

    it('shows example inputs', async () => {
      render(<AIChatPanel {...defaultProps} />)
      await userEvent.click(screen.getByText('Quick Add'))

      expect(screen.getByText(/"Add Immanuel Kant, born 1724, died 1804, philosopher"/)).toBeInTheDocument()
    })

    it('has textarea for natural language input', async () => {
      render(<AIChatPanel {...defaultProps} />)
      await userEvent.click(screen.getByText('Quick Add'))

      expect(screen.getByPlaceholderText('Type your entry here...')).toBeInTheDocument()
    })

    it('disables parse button when input is empty', async () => {
      render(<AIChatPanel {...defaultProps} />)
      await userEvent.click(screen.getByText('Quick Add'))

      expect(screen.getByRole('button', { name: 'Parse Entry' })).toBeDisabled()
    })

    it('parses natural language input', async () => {
      render(<AIChatPanel {...defaultProps} />)
      await userEvent.click(screen.getByText('Quick Add'))

      const textarea = screen.getByPlaceholderText('Type your entry here...')
      await userEvent.type(textarea, 'Add Immanuel Kant, born 1724, philosopher')
      await userEvent.click(screen.getByRole('button', { name: 'Parse Entry' }))

      await waitFor(() => {
        expect(screen.getByText('Detected:')).toBeInTheDocument()
        expect(screen.getByText('thinker')).toBeInTheDocument()
      })
    })

    it('shows parsed data fields', async () => {
      render(<AIChatPanel {...defaultProps} />)
      await userEvent.click(screen.getByText('Quick Add'))

      const textarea = screen.getByPlaceholderText('Type your entry here...')
      await userEvent.type(textarea, 'Add Immanuel Kant')
      await userEvent.click(screen.getByRole('button', { name: 'Parse Entry' }))

      await waitFor(() => {
        expect(screen.getByText('name:')).toBeInTheDocument()
        expect(screen.getByText('Immanuel Kant')).toBeInTheDocument()
        expect(screen.getByText('birth_year:')).toBeInTheDocument()
        expect(screen.getByText('1724')).toBeInTheDocument()
      })
    })

    it('shows confidence percentage', async () => {
      render(<AIChatPanel {...defaultProps} />)
      await userEvent.click(screen.getByText('Quick Add'))

      const textarea = screen.getByPlaceholderText('Type your entry here...')
      await userEvent.type(textarea, 'Add Kant')
      await userEvent.click(screen.getByRole('button', { name: 'Parse Entry' }))

      await waitFor(() => {
        expect(screen.getByText('Confidence: 95%')).toBeInTheDocument()
      })
    })

    it('shows create and cancel buttons after parsing', async () => {
      render(<AIChatPanel {...defaultProps} />)
      await userEvent.click(screen.getByText('Quick Add'))

      const textarea = screen.getByPlaceholderText('Type your entry here...')
      await userEvent.type(textarea, 'Add Kant')
      await userEvent.click(screen.getByRole('button', { name: 'Parse Entry' }))

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Create Entry' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
      })
    })

    it('clears parsed result on cancel', async () => {
      render(<AIChatPanel {...defaultProps} />)
      await userEvent.click(screen.getByText('Quick Add'))

      const textarea = screen.getByPlaceholderText('Type your entry here...')
      await userEvent.type(textarea, 'Add Kant')
      await userEvent.click(screen.getByRole('button', { name: 'Parse Entry' }))

      await waitFor(async () => {
        expect(screen.getByText('Detected:')).toBeInTheDocument()
        await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
      })

      expect(screen.queryByText('Detected:')).not.toBeInTheDocument()
    })

    it('shows clarification needs when present', async () => {
      server.use(
        http.post(`${API_URL}/api/ai/parse`, () => {
          return HttpResponse.json({
            entity_type: 'connection',
            data: { from_name: 'Kant', to_name: 'Hegel' },
            confidence: 0.7,
            needs_clarification: ['Could not find Kant in database', 'Could not find Hegel in database']
          })
        })
      )

      render(<AIChatPanel {...defaultProps} />)
      await userEvent.click(screen.getByText('Quick Add'))

      const textarea = screen.getByPlaceholderText('Type your entry here...')
      await userEvent.type(textarea, 'Kant influenced Hegel')
      await userEvent.click(screen.getByRole('button', { name: 'Parse Entry' }))

      await waitFor(() => {
        expect(screen.getByText('Needs clarification:')).toBeInTheDocument()
        expect(screen.getByText('Could not find Kant in database')).toBeInTheDocument()
      })
    })
  })

  describe('Tab Navigation', () => {
    it('defaults to chat tab', () => {
      render(<AIChatPanel {...defaultProps} />)
      expect(screen.getByText('Ask questions about your research')).toBeInTheDocument()
    })

    it('switches between tabs correctly', async () => {
      render(<AIChatPanel {...defaultProps} />)

      // Go to summary
      await userEvent.click(screen.getByText('Generate Summary'))
      expect(screen.getByText('Summary Type')).toBeInTheDocument()

      // Go to quick add
      await userEvent.click(screen.getByText('Quick Add'))
      expect(screen.getByText('Enter information in natural language:')).toBeInTheDocument()

      // Back to chat
      await userEvent.click(screen.getByText('Ask Questions'))
      expect(screen.getByText('Ask questions about your research')).toBeInTheDocument()
    })

    it('preserves chat messages when switching tabs', async () => {
      render(<AIChatPanel {...defaultProps} />)

      const input = screen.getByPlaceholderText('Ask a question...')
      await userEvent.type(input, 'Test question')
      await userEvent.click(screen.getByRole('button', { name: 'Send' }))

      await waitFor(() => {
        expect(screen.getByText('Test question')).toBeInTheDocument()
      })

      // Switch tabs and back
      await userEvent.click(screen.getByText('Generate Summary'))
      await userEvent.click(screen.getByText('Ask Questions'))

      expect(screen.getByText('Test question')).toBeInTheDocument()
    })
  })
})
