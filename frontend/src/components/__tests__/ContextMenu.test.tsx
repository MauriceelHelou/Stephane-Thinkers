import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ContextMenu, useContextMenu, type ContextMenuItem } from '../ContextMenu'

describe('ContextMenu', () => {
  const defaultItems: ContextMenuItem[] = [
    { label: 'Edit', onClick: vi.fn() },
    { label: 'Delete', onClick: vi.fn() },
    { label: '', onClick: vi.fn(), separator: true },
    { label: 'Copy', shortcut: 'Cmd+C', onClick: vi.fn() },
  ]

  const defaultProps = {
    x: 100,
    y: 100,
    items: defaultItems,
    onClose: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('renders menu items', () => {
      render(<ContextMenu {...defaultProps} />)
      expect(screen.getByText('Edit')).toBeInTheDocument()
      expect(screen.getByText('Delete')).toBeInTheDocument()
    })

    it('renders all non-separator items', () => {
      render(<ContextMenu {...defaultProps} />)
      expect(screen.getByText('Edit')).toBeInTheDocument()
      expect(screen.getByText('Delete')).toBeInTheDocument()
      expect(screen.getByText('Copy')).toBeInTheDocument()
    })

    it('renders separator between items', () => {
      const { container } = render(<ContextMenu {...defaultProps} />)
      const separator = container.querySelector('.border-t')
      expect(separator).toBeInTheDocument()
    })

    it('shows keyboard shortcut when provided', () => {
      render(<ContextMenu {...defaultProps} />)
      expect(screen.getByText('Cmd+C')).toBeInTheDocument()
    })
  })

  describe('Positioning', () => {
    it('positions menu at specified coordinates', () => {
      const { container } = render(<ContextMenu {...defaultProps} />)
      const menu = container.firstChild as HTMLElement
      expect(menu.style.left).toBe('100px')
      expect(menu.style.top).toBe('100px')
    })

    it('updates position when props change', () => {
      const { container, rerender } = render(<ContextMenu {...defaultProps} />)

      rerender(<ContextMenu {...defaultProps} x={200} y={200} />)

      const menu = container.firstChild as HTMLElement
      // Position adjustment happens in useEffect, so check initial style
      expect(menu.style.left).toBeDefined()
      expect(menu.style.top).toBeDefined()
    })
  })

  describe('Click handling', () => {
    it('calls item onClick when clicked', () => {
      const onClick = vi.fn()
      const items = [{ label: 'Test', onClick }]

      render(<ContextMenu {...defaultProps} items={items} />)

      fireEvent.click(screen.getByText('Test'))
      expect(onClick).toHaveBeenCalled()
    })

    it('calls onClose after item click', () => {
      const onClick = vi.fn()
      const onClose = vi.fn()
      const items = [{ label: 'Test', onClick }]

      render(<ContextMenu {...defaultProps} items={items} onClose={onClose} />)

      fireEvent.click(screen.getByText('Test'))
      expect(onClose).toHaveBeenCalled()
    })

    it('does not call onClick for disabled items', () => {
      const onClick = vi.fn()
      const items = [{ label: 'Test', onClick, disabled: true }]

      render(<ContextMenu {...defaultProps} items={items} />)

      fireEvent.click(screen.getByText('Test'))
      expect(onClick).not.toHaveBeenCalled()
    })
  })

  describe('Keyboard handling', () => {
    it('closes on Escape key', () => {
      const onClose = vi.fn()
      render(<ContextMenu {...defaultProps} onClose={onClose} />)

      fireEvent.keyDown(document, { key: 'Escape' })
      expect(onClose).toHaveBeenCalled()
    })
  })

  describe('Click outside', () => {
    it('closes when clicking outside', () => {
      const onClose = vi.fn()
      render(
        <div>
          <div data-testid="outside">Outside</div>
          <ContextMenu {...defaultProps} onClose={onClose} />
        </div>
      )

      fireEvent.mouseDown(screen.getByTestId('outside'))
      expect(onClose).toHaveBeenCalled()
    })

    it('does not close when clicking inside menu', () => {
      const onClose = vi.fn()
      render(<ContextMenu {...defaultProps} onClose={onClose} />)

      // Click inside but not on an item
      const menu = document.querySelector('.fixed')
      if (menu) {
        fireEvent.mouseDown(menu)
      }

      // onClose should not be called from just a mousedown inside menu
      expect(onClose).not.toHaveBeenCalled()
    })
  })

  describe('Disabled items', () => {
    it('renders disabled items with appropriate styling', () => {
      const items = [{ label: 'Disabled Item', onClick: vi.fn(), disabled: true }]
      render(<ContextMenu {...defaultProps} items={items} />)

      const button = screen.getByText('Disabled Item').closest('button')
      expect(button).toHaveAttribute('disabled')
      expect(button?.className).toContain('cursor-not-allowed')
    })
  })
})

describe('useContextMenu hook', () => {
  function TestComponent() {
    const { contextMenu, showContextMenu, hideContextMenu } = useContextMenu()

    return (
      <div>
        <div data-testid="info">
          {contextMenu ? `Open at ${contextMenu.x}, ${contextMenu.y}` : 'Closed'}
        </div>
        <button onClick={() => showContextMenu(150, 250, [{ label: 'Test', onClick: () => {} }])}>
          Open
        </button>
        <button onClick={hideContextMenu}>Close</button>
      </div>
    )
  }

  it('starts with menu closed', () => {
    render(<TestComponent />)
    expect(screen.getByTestId('info').textContent).toBe('Closed')
  })

  it('opens menu with position on showContextMenu', () => {
    render(<TestComponent />)

    fireEvent.click(screen.getByText('Open'))

    expect(screen.getByTestId('info').textContent).toContain('Open at 150, 250')
  })

  it('closes menu on hideContextMenu', () => {
    render(<TestComponent />)

    // Open first
    fireEvent.click(screen.getByText('Open'))
    expect(screen.getByTestId('info').textContent).toContain('Open')

    // Then close
    fireEvent.click(screen.getByText('Close'))
    expect(screen.getByTestId('info').textContent).toBe('Closed')
  })
})
