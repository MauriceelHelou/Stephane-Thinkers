import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '../../test/test-utils'
import userEvent from '@testing-library/user-event'
import { ExportModal } from '../ExportModal'

describe('ExportModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the modal when open', () => {
    render(<ExportModal {...defaultProps} />)
    expect(screen.getByText(/export timeline/i)).toBeInTheDocument()
  })

  it('does not render when closed', () => {
    render(<ExportModal {...defaultProps} isOpen={false} />)
    expect(screen.queryByText(/export timeline/i)).not.toBeInTheDocument()
  })

  it('shows PNG export option', () => {
    render(<ExportModal {...defaultProps} />)
    expect(screen.getByText(/PNG \(Raster Image\)/i)).toBeInTheDocument()
  })

  it('shows SVG export option', () => {
    render(<ExportModal {...defaultProps} />)
    expect(screen.getByText(/SVG \(Vector Image\)/i)).toBeInTheDocument()
  })

  it('has cancel button', () => {
    render(<ExportModal {...defaultProps} />)
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
  })

  it('calls onClose when cancel button clicked', async () => {
    const onClose = vi.fn()
    render(<ExportModal {...defaultProps} onClose={onClose} />)

    const cancelButton = screen.getByRole('button', { name: /cancel/i })
    await userEvent.click(cancelButton)

    expect(onClose).toHaveBeenCalled()
  })

  it('has export button', () => {
    render(<ExportModal {...defaultProps} />)
    expect(screen.getByRole('button', { name: /export as/i })).toBeInTheDocument()
  })

  it('allows selecting export format', async () => {
    render(<ExportModal {...defaultProps} />)

    // Find and click PNG radio
    const pngRadio = screen.getByLabelText(/png/i)
    await userEvent.click(pngRadio)
    expect(pngRadio).toBeChecked()

    // Switch to SVG
    const svgRadio = screen.getByLabelText(/svg/i)
    await userEvent.click(svgRadio)
    expect(svgRadio).toBeChecked()
  })

  it('shows dimension inputs', () => {
    render(<ExportModal {...defaultProps} />)
    expect(screen.getByText(/width/i)).toBeInTheDocument()
    expect(screen.getByText(/height/i)).toBeInTheDocument()
  })

  it('shows export options checkboxes', () => {
    render(<ExportModal {...defaultProps} />)
    expect(screen.getByLabelText(/include connections/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/include timeline events/i)).toBeInTheDocument()
  })
})
