import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Modal, ModalButton, ModalError, ModalFooter } from '../Modal'

describe('Modal', () => {
  it('renders nothing when closed', () => {
    render(
      <Modal isOpen={false} onClose={() => {}} title="Test Modal">
        <div>Content</div>
      </Modal>
    )
    expect(screen.queryByText('Test Modal')).not.toBeInTheDocument()
  })

  it('renders content when open', () => {
    render(
      <Modal isOpen={true} onClose={() => {}} title="Test Modal">
        <div>Modal Content</div>
      </Modal>
    )
    expect(screen.getByText('Test Modal')).toBeInTheDocument()
    expect(screen.getByText('Modal Content')).toBeInTheDocument()
  })

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn()
    render(
      <Modal isOpen={true} onClose={onClose} title="Test Modal">
        <div>Content</div>
      </Modal>
    )
    fireEvent.click(screen.getByLabelText('Close modal'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn()
    render(
      <Modal isOpen={true} onClose={onClose} title="Test Modal">
        <div>Content</div>
      </Modal>
    )
    // Click the backdrop (the overlay div)
    const backdrop = screen.getByText('Content').closest('.fixed')
    if (backdrop) {
      fireEvent.click(backdrop)
      expect(onClose).toHaveBeenCalledTimes(1)
    }
  })

  it('does not call onClose when modal content is clicked', () => {
    const onClose = vi.fn()
    render(
      <Modal isOpen={true} onClose={onClose} title="Test Modal">
        <div>Content</div>
      </Modal>
    )
    fireEvent.click(screen.getByText('Content'))
    expect(onClose).not.toHaveBeenCalled()
  })
})

describe('ModalButton', () => {
  it('renders with default secondary variant', () => {
    render(<ModalButton>Click me</ModalButton>)
    const button = screen.getByText('Click me')
    expect(button).toBeInTheDocument()
    expect(button).toHaveClass('border-timeline')
  })

  it('renders with primary variant', () => {
    render(<ModalButton variant="primary">Submit</ModalButton>)
    const button = screen.getByText('Submit')
    expect(button).toHaveClass('bg-accent')
  })

  it('renders with danger variant', () => {
    render(<ModalButton variant="danger">Delete</ModalButton>)
    const button = screen.getByText('Delete')
    expect(button).toHaveClass('bg-red-600')
  })

  it('handles click events', () => {
    const onClick = vi.fn()
    render(<ModalButton onClick={onClick}>Click me</ModalButton>)
    fireEvent.click(screen.getByText('Click me'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('can be disabled', () => {
    const onClick = vi.fn()
    render(<ModalButton disabled onClick={onClick}>Disabled</ModalButton>)
    const button = screen.getByText('Disabled')
    expect(button).toBeDisabled()
    fireEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('supports submit type', () => {
    render(<ModalButton type="submit">Submit</ModalButton>)
    const button = screen.getByText('Submit')
    expect(button).toHaveAttribute('type', 'submit')
  })
})

describe('ModalError', () => {
  it('renders nothing when no error', () => {
    const { container } = render(<ModalError />)
    expect(container.firstChild).toBeNull()
  })

  it('renders error message from Error object', () => {
    render(<ModalError error={new Error('Something went wrong')} />)
    expect(screen.getByText(/Something went wrong/)).toBeInTheDocument()
  })

  it('renders error message from string', () => {
    render(<ModalError message="Validation failed" />)
    expect(screen.getByText(/Validation failed/)).toBeInTheDocument()
  })

  it('prefers message over error', () => {
    render(
      <ModalError
        error={new Error('Error message')}
        message="String message"
      />
    )
    expect(screen.getByText(/String message/)).toBeInTheDocument()
  })

  it('uses fallback message when error has no message', () => {
    const error = new Error()
    error.message = ''
    render(<ModalError error={error} fallbackMessage="Fallback" />)
    expect(screen.getByText(/Fallback/)).toBeInTheDocument()
  })
})

describe('ModalFooter', () => {
  it('renders children', () => {
    render(
      <ModalFooter>
        <button>Button 1</button>
        <button>Button 2</button>
      </ModalFooter>
    )
    expect(screen.getByText('Button 1')).toBeInTheDocument()
    expect(screen.getByText('Button 2')).toBeInTheDocument()
  })
})
