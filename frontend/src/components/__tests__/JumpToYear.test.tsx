import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { JumpToYear } from '../JumpToYear'

describe('JumpToYear', () => {
  const defaultProps = {
    scale: 1,
    canvasWidth: 800,
    onNavigate: vi.fn(),
    startYear: 1700,
    endYear: 2000,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Closed state', () => {
    it('renders button when closed', () => {
      render(<JumpToYear {...defaultProps} />)
      expect(screen.getByText('Jump to Year')).toBeInTheDocument()
    })

    it('opens when button is clicked', async () => {
      const user = userEvent.setup()
      render(<JumpToYear {...defaultProps} />)

      await user.click(screen.getByText('Jump to Year'))

      expect(screen.getByPlaceholderText(/1700 to 2000/)).toBeInTheDocument()
    })
  })

  describe('Open state', () => {
    it('shows input field when open', async () => {
      const user = userEvent.setup()
      render(<JumpToYear {...defaultProps} />)

      await user.click(screen.getByText('Jump to Year'))

      expect(screen.getByRole('textbox')).toBeInTheDocument()
    })

    it('shows Go button', async () => {
      const user = userEvent.setup()
      render(<JumpToYear {...defaultProps} />)

      await user.click(screen.getByText('Jump to Year'))

      expect(screen.getByText('Go')).toBeInTheDocument()
    })

    it('shows quick navigation buttons', async () => {
      const user = userEvent.setup()
      render(<JumpToYear {...defaultProps} />)

      await user.click(screen.getByText('Jump to Year'))

      expect(screen.getByText('Start')).toBeInTheDocument()
      expect(screen.getByText('Mid')).toBeInTheDocument()
      expect(screen.getByText('End')).toBeInTheDocument()
    })

    it('shows BCE hint', async () => {
      const user = userEvent.setup()
      render(<JumpToYear {...defaultProps} />)

      await user.click(screen.getByText('Jump to Year'))

      expect(screen.getByText(/Use negative for BCE/)).toBeInTheDocument()
    })
  })

  describe('Navigation', () => {
    it('calls onNavigate with valid year', async () => {
      const user = userEvent.setup()
      const onNavigate = vi.fn()
      render(<JumpToYear {...defaultProps} onNavigate={onNavigate} />)

      await user.click(screen.getByText('Jump to Year'))
      await user.type(screen.getByRole('textbox'), '1850')
      await user.click(screen.getByText('Go'))

      expect(onNavigate).toHaveBeenCalled()
    })

    it('shows error for invalid year', async () => {
      const user = userEvent.setup()
      render(<JumpToYear {...defaultProps} />)

      await user.click(screen.getByText('Jump to Year'))
      await user.type(screen.getByRole('textbox'), 'abc')
      await user.click(screen.getByText('Go'))

      expect(screen.getByText('Please enter a valid year')).toBeInTheDocument()
    })

    it('shows error for out of range year', async () => {
      const user = userEvent.setup()
      render(<JumpToYear {...defaultProps} />)

      await user.click(screen.getByText('Jump to Year'))
      await user.type(screen.getByRole('textbox'), '3000')
      await user.click(screen.getByText('Go'))

      expect(screen.getByText(/Year must be between/)).toBeInTheDocument()
    })

    it('closes after successful navigation', async () => {
      const user = userEvent.setup()
      render(<JumpToYear {...defaultProps} />)

      await user.click(screen.getByText('Jump to Year'))
      await user.type(screen.getByRole('textbox'), '1850')
      await user.click(screen.getByText('Go'))

      expect(screen.getByText('Jump to Year')).toBeInTheDocument()
    })
  })

  describe('Quick jumps', () => {
    it('fills input when Start is clicked', async () => {
      const user = userEvent.setup()
      render(<JumpToYear {...defaultProps} />)

      await user.click(screen.getByText('Jump to Year'))
      await user.click(screen.getByText('Start'))

      expect(screen.getByRole('textbox')).toHaveValue('1700')
    })

    it('fills input when End is clicked', async () => {
      const user = userEvent.setup()
      render(<JumpToYear {...defaultProps} />)

      await user.click(screen.getByText('Jump to Year'))
      await user.click(screen.getByText('End'))

      expect(screen.getByRole('textbox')).toHaveValue('2000')
    })
  })

  describe('Keyboard interactions', () => {
    it('navigates on Enter key', async () => {
      const user = userEvent.setup()
      const onNavigate = vi.fn()
      render(<JumpToYear {...defaultProps} onNavigate={onNavigate} />)

      await user.click(screen.getByText('Jump to Year'))
      await user.type(screen.getByRole('textbox'), '1850{Enter}')

      expect(onNavigate).toHaveBeenCalled()
    })

    it('closes on Escape key', async () => {
      const user = userEvent.setup()
      render(<JumpToYear {...defaultProps} />)

      await user.click(screen.getByText('Jump to Year'))
      await user.type(screen.getByRole('textbox'), '{Escape}')

      expect(screen.getByText('Jump to Year')).toBeInTheDocument()
    })
  })

  describe('Close button', () => {
    it('closes when X is clicked', async () => {
      const user = userEvent.setup()
      render(<JumpToYear {...defaultProps} />)

      await user.click(screen.getByText('Jump to Year'))
      await user.click(screen.getByText('×'))

      expect(screen.getByText('Jump to Year')).toBeInTheDocument()
    })
  })
})
