import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '../../test/test-utils'
import userEvent from '@testing-library/user-event'
import { ConnectionLegend } from '../ConnectionLegend'
import { CONNECTION_STYLES, ConnectionStyleType } from '@/lib/constants'

describe('ConnectionLegend', () => {
  const allTypes = Object.keys(CONNECTION_STYLES) as ConnectionStyleType[]

  const defaultProps = {
    visibleTypes: allTypes,
    onToggleType: vi.fn(),
    onToggleAll: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders all connection types', () => {
    render(<ConnectionLegend {...defaultProps} />)

    expect(screen.getByText('Influenced')).toBeInTheDocument()
    expect(screen.getByText('Critiqued')).toBeInTheDocument()
    expect(screen.getByText('Built Upon')).toBeInTheDocument()
    expect(screen.getByText('Synthesized')).toBeInTheDocument()
  })

  it('shows checkboxes for each connection type', () => {
    render(<ConnectionLegend {...defaultProps} />)

    const checkboxes = screen.getAllByRole('checkbox')
    expect(checkboxes.length).toBeGreaterThanOrEqual(4)
  })

  it('calls onToggleType when checkbox clicked', async () => {
    const onToggleType = vi.fn()
    render(<ConnectionLegend {...defaultProps} onToggleType={onToggleType} />)

    const checkboxes = screen.getAllByRole('checkbox')
    await userEvent.click(checkboxes[0])

    expect(onToggleType).toHaveBeenCalled()
  })

  it('shows correct checked state for visible types', () => {
    render(<ConnectionLegend {...defaultProps} visibleTypes={['influenced', 'critiqued']} />)

    const checkboxes = screen.getAllByRole('checkbox')
    // First two should be checked, others unchecked
    const checkedCount = checkboxes.filter(cb => (cb as HTMLInputElement).checked).length
    expect(checkedCount).toBeGreaterThanOrEqual(2)
  })

  it('shows unchecked state for hidden types', () => {
    render(<ConnectionLegend {...defaultProps} visibleTypes={[]} />)

    const checkboxes = screen.getAllByRole('checkbox')
    const uncheckedCount = checkboxes.filter(cb => !(cb as HTMLInputElement).checked).length
    expect(uncheckedCount).toBe(checkboxes.length)
  })

  it('displays connection type line previews', () => {
    render(<ConnectionLegend {...defaultProps} />)

    // Check that SVG line previews are present
    const svgLines = document.querySelectorAll('svg line')
    expect(svgLines.length).toBeGreaterThan(0)
  })

  it('has All and None toggle buttons', () => {
    render(<ConnectionLegend {...defaultProps} />)

    expect(screen.getByRole('button', { name: /all/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /none/i })).toBeInTheDocument()
  })

  it('calls onToggleAll with true when All button clicked', async () => {
    const onToggleAll = vi.fn()
    render(<ConnectionLegend {...defaultProps} visibleTypes={[]} onToggleAll={onToggleAll} />)

    const allButton = screen.getByRole('button', { name: /all/i })
    await userEvent.click(allButton)

    expect(onToggleAll).toHaveBeenCalledWith(true)
  })

  it('calls onToggleAll with false when None button clicked', async () => {
    const onToggleAll = vi.fn()
    render(<ConnectionLegend {...defaultProps} onToggleAll={onToggleAll} />)

    const noneButton = screen.getByRole('button', { name: /none/i })
    await userEvent.click(noneButton)

    expect(onToggleAll).toHaveBeenCalledWith(false)
  })
})
