import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '../../test/test-utils'
import userEvent from '@testing-library/user-event'

import { NoteTagSelector } from '../notes/NoteTagSelector'

describe('NoteTagSelector', () => {
  it('selects an existing tag with Enter', async () => {
    const onChange = vi.fn()
    render(<NoteTagSelector value={[]} onChange={onChange} />)

    const input = await screen.findByPlaceholderText('Add tags...')
    await userEvent.type(input, 'exam: general 1{enter}')

    await waitFor(() => {
      expect(onChange).toHaveBeenCalled()
    })

    const nextTags = onChange.mock.calls[0][0]
    expect(nextTags[0].name).toBe('Exam: General 1')
  })

  it('creates a new tag inline when no exact match exists', async () => {
    const onChange = vi.fn()
    render(<NoteTagSelector value={[]} onChange={onChange} />)

    const input = await screen.findByPlaceholderText('Add tags...')
    await userEvent.type(input, 'Diss: Ch 1{enter}')

    await waitFor(() => {
      expect(onChange).toHaveBeenCalled()
    })

    const createdTag = onChange.mock.calls[0][0][0]
    expect(createdTag.id).toBe('new-tag-id')
    expect(createdTag.name).toBe('Diss: Ch 1')
    expect(createdTag.color).toBe('#64748b')
  })

  it('clears selected tags when clear button is enabled', async () => {
    const onChange = vi.fn()
    render(
      <NoteTagSelector
        value={[
          { id: 'note-tag-1', name: 'Exam: General 1', color: '#64748b', created_at: new Date().toISOString() },
        ]}
        onChange={onChange}
        showClearButton
      />
    )

    await userEvent.click(screen.getByRole('button', { name: /clear/i }))
    expect(onChange).toHaveBeenCalledWith([])
  })
})
