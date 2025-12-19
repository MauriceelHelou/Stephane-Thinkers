import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CommandPalette, Command } from '../CommandPalette'

describe('CommandPalette', () => {
  const mockCommands: Command[] = [
    { id: '1', label: 'Add Thinker', description: 'Add a new thinker', shortcut: '⌘T', category: 'Edit', action: vi.fn() },
    { id: '2', label: 'Add Connection', description: 'Connect two thinkers', shortcut: '⌘K', category: 'Edit', action: vi.fn() },
    { id: '3', label: 'Zoom In', description: 'Zoom in on timeline', category: 'View', action: vi.fn() },
    { id: '4', label: 'Zoom Out', description: 'Zoom out of timeline', category: 'View', action: vi.fn() },
    { id: '5', label: 'Help', description: 'Show help guide', shortcut: '?', category: 'General', action: vi.fn() },
  ]

  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    commands: mockCommands,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockCommands.forEach(cmd => (cmd.action as ReturnType<typeof vi.fn>).mockClear())
  })

  describe('Rendering', () => {
    it('renders when isOpen is true', () => {
      render(<CommandPalette {...defaultProps} />)
      expect(screen.getByPlaceholderText(/Type a command/)).toBeInTheDocument()
    })

    it('does not render when isOpen is false', () => {
      render(<CommandPalette {...defaultProps} isOpen={false} />)
      expect(screen.queryByPlaceholderText(/Type a command/)).not.toBeInTheDocument()
    })

    it('shows all commands when no search query', () => {
      render(<CommandPalette {...defaultProps} />)
      expect(screen.getByText('Add Thinker')).toBeInTheDocument()
      expect(screen.getByText('Zoom In')).toBeInTheDocument()
      expect(screen.getByText('Help')).toBeInTheDocument()
    })

    it('groups commands by category', () => {
      render(<CommandPalette {...defaultProps} />)
      expect(screen.getByText('Edit')).toBeInTheDocument()
      expect(screen.getByText('View')).toBeInTheDocument()
      expect(screen.getByText('General')).toBeInTheDocument()
    })

    it('shows command shortcuts', () => {
      render(<CommandPalette {...defaultProps} />)
      expect(screen.getByText('⌘T')).toBeInTheDocument()
      expect(screen.getByText('⌘K')).toBeInTheDocument()
      expect(screen.getByText('?')).toBeInTheDocument()
    })

    it('shows command descriptions', () => {
      render(<CommandPalette {...defaultProps} />)
      expect(screen.getByText('Add a new thinker')).toBeInTheDocument()
      expect(screen.getByText('Connect two thinkers')).toBeInTheDocument()
    })
  })

  describe('Search', () => {
    it('filters commands based on search query', async () => {
      const user = userEvent.setup()
      render(<CommandPalette {...defaultProps} />)

      const input = screen.getByPlaceholderText(/Type a command/)
      await user.type(input, 'zoom')

      expect(screen.getByText('Zoom In')).toBeInTheDocument()
      expect(screen.getByText('Zoom Out')).toBeInTheDocument()
      expect(screen.queryByText('Add Thinker')).not.toBeInTheDocument()
    })

    it('shows no commands found message', async () => {
      const user = userEvent.setup()
      render(<CommandPalette {...defaultProps} />)

      const input = screen.getByPlaceholderText(/Type a command/)
      await user.type(input, 'nonexistent')

      expect(screen.getByText('No commands found')).toBeInTheDocument()
    })

    it('searches by description', async () => {
      const user = userEvent.setup()
      render(<CommandPalette {...defaultProps} />)

      const input = screen.getByPlaceholderText(/Type a command/)
      await user.type(input, 'connect')

      expect(screen.getByText('Add Connection')).toBeInTheDocument()
    })
  })

  describe('Keyboard navigation', () => {
    it('first item is selected by default', () => {
      render(<CommandPalette {...defaultProps} />)
      const firstItem = screen.getByText('Add Thinker').closest('button')
      expect(firstItem).toHaveClass('bg-accent')
    })

    it('navigates down with arrow key', async () => {
      const user = userEvent.setup()
      render(<CommandPalette {...defaultProps} />)

      const input = screen.getByPlaceholderText(/Type a command/)
      await user.type(input, '{ArrowDown}')

      const secondItem = screen.getByText('Add Connection').closest('button')
      expect(secondItem).toHaveClass('bg-accent')
    })

    it('navigates up with arrow key', async () => {
      const user = userEvent.setup()
      render(<CommandPalette {...defaultProps} />)

      const input = screen.getByPlaceholderText(/Type a command/)
      await user.type(input, '{ArrowDown}{ArrowUp}')

      const firstItem = screen.getByText('Add Thinker').closest('button')
      expect(firstItem).toHaveClass('bg-accent')
    })

    it('executes command on Enter', async () => {
      const user = userEvent.setup()
      render(<CommandPalette {...defaultProps} />)

      const input = screen.getByPlaceholderText(/Type a command/)
      await user.type(input, '{Enter}')

      expect(mockCommands[0].action).toHaveBeenCalled()
    })

    it('closes on Escape', async () => {
      const user = userEvent.setup()
      const onClose = vi.fn()
      render(<CommandPalette {...defaultProps} onClose={onClose} />)

      const input = screen.getByPlaceholderText(/Type a command/)
      await user.type(input, '{Escape}')

      expect(onClose).toHaveBeenCalled()
    })
  })

  describe('Click interaction', () => {
    it('executes command when clicked', async () => {
      const user = userEvent.setup()
      render(<CommandPalette {...defaultProps} />)

      await user.click(screen.getByText('Add Thinker'))

      expect(mockCommands[0].action).toHaveBeenCalled()
    })

    it('closes after executing command', async () => {
      const user = userEvent.setup()
      const onClose = vi.fn()
      render(<CommandPalette {...defaultProps} onClose={onClose} />)

      await user.click(screen.getByText('Add Thinker'))

      expect(onClose).toHaveBeenCalled()
    })
  })

  describe('Footer', () => {
    it('shows navigation instructions', () => {
      render(<CommandPalette {...defaultProps} />)
      expect(screen.getByText('Navigate')).toBeInTheDocument()
      expect(screen.getByText('Execute')).toBeInTheDocument()
      expect(screen.getByText('Close')).toBeInTheDocument()
    })
  })
})
