import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import { HelpGuide } from '../HelpGuide'

// Mock the PugEasterEgg component for isolated testing
vi.mock('../PugEasterEgg', () => ({
  PugEasterEgg: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? (
      <div data-testid="pug-easter-egg" onClick={onClose}>
        Easter Egg Active
      </div>
    ) : null,
}))

describe('HelpGuide', () => {
  describe('Rendering', () => {
    it('renders when isOpen is true', () => {
      render(<HelpGuide isOpen={true} onClose={vi.fn()} />)
      expect(screen.getByText('Help & Keyboard Shortcuts')).toBeInTheDocument()
    })

    it('does not render when isOpen is false', () => {
      render(<HelpGuide isOpen={false} onClose={vi.fn()} />)
      expect(screen.queryByText('Help & Keyboard Shortcuts')).not.toBeInTheDocument()
    })
  })

  describe('Content sections', () => {
    it('displays Navigation section', () => {
      render(<HelpGuide isOpen={true} onClose={vi.fn()} />)
      expect(screen.getByText('Navigation & Zoom')).toBeInTheDocument()
    })

    it('displays Adding Items section', () => {
      render(<HelpGuide isOpen={true} onClose={vi.fn()} />)
      expect(screen.getByText('Adding Thinkers')).toBeInTheDocument()
    })

    it('displays Creating Connections section', () => {
      render(<HelpGuide isOpen={true} onClose={vi.fn()} />)
      expect(screen.getByText('Creating Connections')).toBeInTheDocument()
    })

    it('displays Viewing Details section', () => {
      render(<HelpGuide isOpen={true} onClose={vi.fn()} />)
      expect(screen.getByText('Detail Panel')).toBeInTheDocument()
    })

    it('displays Timelines section', () => {
      render(<HelpGuide isOpen={true} onClose={vi.fn()} />)
      expect(screen.getByText('Timelines')).toBeInTheDocument()
    })

    it('displays Connection Types section', () => {
      render(<HelpGuide isOpen={true} onClose={vi.fn()} />)
      expect(screen.getByText('Connection Types')).toBeInTheDocument()
    })

    it('displays Event Symbols section', () => {
      render(<HelpGuide isOpen={true} onClose={vi.fn()} />)
      expect(screen.getByText('Event Symbols')).toBeInTheDocument()
    })
  })

  describe('Keyboard shortcuts', () => {
    it('shows keyboard shortcut instructions', () => {
      render(<HelpGuide isOpen={true} onClose={vi.fn()} />)
      // Should show Esc instruction
      expect(screen.getByText(/Esc/)).toBeInTheDocument()
    })

    it('shows zoom instructions', () => {
      render(<HelpGuide isOpen={true} onClose={vi.fn()} />)
      expect(screen.getByText(/Zoom in\/out on timeline/)).toBeInTheDocument()
      expect(screen.getByText(/Zoom \(trackpad\)/)).toBeInTheDocument()
    })

    it('shows pan instructions', () => {
      render(<HelpGuide isOpen={true} onClose={vi.fn()} />)
      expect(screen.getByText(/Click \+ Drag/)).toBeInTheDocument()
    })
  })

  describe('Connection types list', () => {
    it('shows Influenced connection type', () => {
      render(<HelpGuide isOpen={true} onClose={vi.fn()} />)
      expect(screen.getByText(/Influenced/)).toBeInTheDocument()
    })

    it('shows Critiqued connection type', () => {
      render(<HelpGuide isOpen={true} onClose={vi.fn()} />)
      expect(screen.getByText(/Critiqued/)).toBeInTheDocument()
    })

    it('shows Built Upon connection type', () => {
      render(<HelpGuide isOpen={true} onClose={vi.fn()} />)
      expect(screen.getByText(/Built Upon/)).toBeInTheDocument()
    })

    it('shows Synthesized connection type', () => {
      render(<HelpGuide isOpen={true} onClose={vi.fn()} />)
      expect(screen.getByText(/Synthesized/)).toBeInTheDocument()
    })
  })

  describe('Event symbols', () => {
    it('shows Council symbol', () => {
      render(<HelpGuide isOpen={true} onClose={vi.fn()} />)
      expect(screen.getByText('△ Council')).toBeInTheDocument()
    })

    it('shows Publication symbol', () => {
      render(<HelpGuide isOpen={true} onClose={vi.fn()} />)
      expect(screen.getByText('▢ Publication')).toBeInTheDocument()
    })

    it('shows War symbol', () => {
      render(<HelpGuide isOpen={true} onClose={vi.fn()} />)
      expect(screen.getByText('◇ War/Conflict')).toBeInTheDocument()
    })

    it('shows Invention symbol', () => {
      render(<HelpGuide isOpen={true} onClose={vi.fn()} />)
      expect(screen.getByText('★ Invention')).toBeInTheDocument()
    })
  })

  describe('Tips', () => {
    it('displays the zoom tip', () => {
      render(<HelpGuide isOpen={true} onClose={vi.fn()} />)
      expect(screen.getByText(/Zoom in deeply/)).toBeInTheDocument()
    })
  })

  describe('Modal close', () => {
    it('calls onClose when close button is clicked', () => {
      const onClose = vi.fn()
      render(<HelpGuide isOpen={true} onClose={onClose} />)

      const closeButton = screen.getByRole('button', { name: /close/i })
      fireEvent.click(closeButton)

      expect(onClose).toHaveBeenCalledTimes(1)
    })
  })

  describe('Easter Egg', () => {
    it('renders the secret "help" button at the bottom of the modal', () => {
      render(<HelpGuide isOpen={true} onClose={vi.fn()} />)

      // The bottom text contains the easter egg trigger
      const helpButton = screen.getByRole('button', { name: 'help' })
      expect(helpButton).toBeInTheDocument()
    })

    it('easter egg trigger is styled to look like normal text', () => {
      render(<HelpGuide isOpen={true} onClose={vi.fn()} />)

      const helpButton = screen.getByRole('button', { name: 'help' })

      // Should have subtle styling (looks like text, not a button)
      expect(helpButton).toHaveClass('text-gray-500')
      expect(helpButton).toHaveClass('cursor-default')
    })

    it('does not show easter egg initially', () => {
      render(<HelpGuide isOpen={true} onClose={vi.fn()} />)

      expect(screen.queryByTestId('pug-easter-egg')).not.toBeInTheDocument()
    })

    it('clicking the "help" button triggers the easter egg', () => {
      render(<HelpGuide isOpen={true} onClose={vi.fn()} />)

      // Easter egg should not be visible initially
      expect(screen.queryByTestId('pug-easter-egg')).not.toBeInTheDocument()

      // Click the secret trigger
      const helpButton = screen.getByRole('button', { name: 'help' })
      fireEvent.click(helpButton)

      // Easter egg should now be visible
      expect(screen.getByTestId('pug-easter-egg')).toBeInTheDocument()
    })

    it('clicking the easter egg closes it', () => {
      render(<HelpGuide isOpen={true} onClose={vi.fn()} />)

      // Open easter egg
      const helpButton = screen.getByRole('button', { name: 'help' })
      fireEvent.click(helpButton)
      expect(screen.getByTestId('pug-easter-egg')).toBeInTheDocument()

      // Close by clicking
      fireEvent.click(screen.getByTestId('pug-easter-egg'))

      // Should be closed
      expect(screen.queryByTestId('pug-easter-egg')).not.toBeInTheDocument()
    })

    it('help modal stays open while easter egg plays', () => {
      const onClose = vi.fn()
      render(<HelpGuide isOpen={true} onClose={onClose} />)

      // Open easter egg
      const helpButton = screen.getByRole('button', { name: 'help' })
      fireEvent.click(helpButton)

      // Help modal should still be visible (title still there)
      expect(screen.getByText('Help & Keyboard Shortcuts')).toBeInTheDocument()

      // Modal onClose should NOT have been called
      expect(onClose).not.toHaveBeenCalled()
    })

    it('easter egg can be triggered multiple times', () => {
      render(<HelpGuide isOpen={true} onClose={vi.fn()} />)

      const helpButton = screen.getByRole('button', { name: 'help' })

      // First trigger
      fireEvent.click(helpButton)
      expect(screen.getByTestId('pug-easter-egg')).toBeInTheDocument()

      // Close
      fireEvent.click(screen.getByTestId('pug-easter-egg'))
      expect(screen.queryByTestId('pug-easter-egg')).not.toBeInTheDocument()

      // Second trigger - should work again
      fireEvent.click(helpButton)
      expect(screen.getByTestId('pug-easter-egg')).toBeInTheDocument()
    })

    it('has subtle hover effect on trigger', () => {
      render(<HelpGuide isOpen={true} onClose={vi.fn()} />)

      const helpButton = screen.getByRole('button', { name: 'help' })

      // Should have hover class for subtle indication
      expect(helpButton).toHaveClass('hover:text-gray-400')
    })

    it('trigger button has empty title to avoid tooltip hints', () => {
      render(<HelpGuide isOpen={true} onClose={vi.fn()} />)

      const helpButton = screen.getByRole('button', { name: 'help' })

      // Should have empty title (no tooltip to spoil the surprise)
      expect(helpButton).toHaveAttribute('title', '')
    })

    it('easter egg trigger has smooth transition', () => {
      render(<HelpGuide isOpen={true} onClose={vi.fn()} />)

      const helpButton = screen.getByRole('button', { name: 'help' })

      // Should have transition for smooth hover effect
      expect(helpButton).toHaveClass('transition-colors')
    })
  })
})
