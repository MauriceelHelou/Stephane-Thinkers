import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '../../test/test-utils'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'

import { NotesList } from '../notes/NotesList'
import { server } from '../../test/setup'

const API_URL = 'http://localhost:8010'

describe('NotesList', () => {
  it('applies a tag filter from the tag selector', async () => {
    const onTagFilterIdsChange = vi.fn()
    server.use(
      http.get(`${API_URL}/api/tags/`, () => {
        return HttpResponse.json([
          { id: 'note-tag-1', name: 'Exam: General 1', color: '#64748b', created_at: new Date().toISOString() },
        ])
      }),
      http.get(`${API_URL}/api/notes/`, () => {
        return HttpResponse.json([])
      })
    )

    render(
      <NotesList
        folderId={null}
        selectedNoteId={null}
        selectedTagFilterIds={[]}
        onTagFilterIdsChange={onTagFilterIdsChange}
        onSelectNote={vi.fn()}
        onCreateNote={vi.fn()}
      />
    )

    const filterInput = await screen.findByPlaceholderText('Filter by tags...')
    await userEvent.type(filterInput, 'Exam: General 1{enter}')

    await waitFor(() => {
      expect(onTagFilterIdsChange).toHaveBeenCalledWith(['note-tag-1'])
    })
  })

  it('clears tag filters', async () => {
    const onTagFilterIdsChange = vi.fn()
    server.use(
      http.get(`${API_URL}/api/tags/`, () => {
        return HttpResponse.json([
          { id: 'note-tag-1', name: 'Exam: General 1', color: '#64748b', created_at: new Date().toISOString() },
        ])
      }),
      http.get(`${API_URL}/api/notes/`, () => {
        return HttpResponse.json([])
      })
    )

    render(
      <NotesList
        folderId={null}
        selectedNoteId={null}
        selectedTagFilterIds={['note-tag-1']}
        onTagFilterIdsChange={onTagFilterIdsChange}
        onSelectNote={vi.fn()}
        onCreateNote={vi.fn()}
      />
    )

    await userEvent.click(await screen.findByRole('button', { name: /clear/i }))
    expect(onTagFilterIdsChange).toHaveBeenCalledWith([])
  })

  it('keeps unknown selected tag filters visible so they can be cleared', async () => {
    const onTagFilterIdsChange = vi.fn()
    server.use(
      http.get(`${API_URL}/api/tags/`, () => HttpResponse.json([])),
      http.get(`${API_URL}/api/notes/`, () => HttpResponse.json([]))
    )

    render(
      <NotesList
        folderId={null}
        selectedNoteId={null}
        selectedTagFilterIds={['missing-tag-id']}
        onTagFilterIdsChange={onTagFilterIdsChange}
        onSelectNote={vi.fn()}
        onCreateNote={vi.fn()}
      />
    )

    expect(await screen.findByText(/Missing tag/i)).toBeInTheDocument()
    await userEvent.click(await screen.findByRole('button', { name: /clear/i }))
    expect(onTagFilterIdsChange).toHaveBeenCalledWith([])
  })

})
