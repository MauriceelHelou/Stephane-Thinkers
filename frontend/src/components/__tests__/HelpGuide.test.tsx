import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { HelpGuide } from '../HelpGuide'

describe('HelpGuide', () => {
  describe('Rendering', () => {
    it('renders when isOpen is true', () => {
      render(<HelpGuide isOpen={true} onClose={vi.fn()} />)
      expect(screen.getByText('How to Use')).toBeInTheDocument()
    })

    it('does not render when isOpen is false', () => {
      render(<HelpGuide isOpen={false} onClose={vi.fn()} />)
      expect(screen.queryByText('How to Use')).not.toBeInTheDocument()
    })
  })

  describe('Content sections', () => {
    it('displays Navigation section', () => {
      render(<HelpGuide isOpen={true} onClose={vi.fn()} />)
      expect(screen.getByText('Navigation')).toBeInTheDocument()
    })

    it('displays Adding Items section', () => {
      render(<HelpGuide isOpen={true} onClose={vi.fn()} />)
      expect(screen.getByText('Adding Items')).toBeInTheDocument()
    })

    it('displays Creating Connections section', () => {
      render(<HelpGuide isOpen={true} onClose={vi.fn()} />)
      expect(screen.getByText('Creating Connections')).toBeInTheDocument()
    })

    it('displays Viewing Details section', () => {
      render(<HelpGuide isOpen={true} onClose={vi.fn()} />)
      expect(screen.getByText('Viewing Details')).toBeInTheDocument()
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
      expect(screen.getByText(/Scroll\/Pinch/)).toBeInTheDocument()
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
      expect(screen.getByText('◇ War')).toBeInTheDocument()
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
})
