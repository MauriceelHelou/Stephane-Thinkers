import { describe, it, expect, vi, beforeEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import {
  thinkersApi,
  connectionsApi,
  publicationsApi,
  quotesApi,
  tagsApi,
  noteTagsApi,
  notesApi,
  timelinesApi,
  timelineEventsApi,
  combinedViewsApi,
} from '../api'
import { server } from '../../test/setup'

const API_URL = 'http://localhost:8010'

describe('API Client', () => {
  describe('thinkersApi', () => {
    it('should fetch all thinkers', async () => {
      const thinkers = await thinkersApi.getAll()
      expect(thinkers).toBeInstanceOf(Array)
      expect(thinkers.length).toBeGreaterThan(0)
      expect(thinkers[0]).toHaveProperty('name')
    })

    it('should fetch thinkers with timeline filter', async () => {
      const thinkers = await thinkersApi.getAll('1')
      expect(thinkers).toBeInstanceOf(Array)
    })

    it('should fetch a single thinker with relations', async () => {
      const thinker = await thinkersApi.getOne('1')
      expect(thinker).toHaveProperty('name')
      expect(thinker).toHaveProperty('publications')
      expect(thinker).toHaveProperty('quotes')
      expect(thinker).toHaveProperty('tags')
    })

    it('should create a thinker', async () => {
      const newThinker = await thinkersApi.create({
        name: 'Socrates',
        birth_year: -470,
        death_year: -399,
      })
      expect(newThinker).toHaveProperty('id')
      expect(newThinker.name).toBe('Socrates')
    })
  })

  describe('connectionsApi', () => {
    it('should fetch all connections', async () => {
      const connections = await connectionsApi.getAll()
      expect(connections).toBeInstanceOf(Array)
    })
  })

  describe('tagsApi', () => {
    it('should fetch all tags', async () => {
      const tags = await tagsApi.getAll()
      expect(tags).toBeInstanceOf(Array)
      expect(tags[0]).toHaveProperty('name')
      expect(tags[0]).toHaveProperty('color')
    })
  })

  describe('noteTagsApi', () => {
    it('should fetch all note tags', async () => {
      const tags = await noteTagsApi.getAll()
      expect(tags).toBeInstanceOf(Array)
      expect(tags[0]).toHaveProperty('name')
    })

    it('should paginate through all note tag pages', async () => {
      let callCount = 0
      server.use(
        http.get(`${API_URL}/api/tags/`, ({ request }) => {
          const url = new URL(request.url)
          const skip = Number(url.searchParams.get('skip') || '0')
          callCount += 1

          if (skip === 0) {
            return HttpResponse.json(
              Array.from({ length: 200 }, (_, index) => ({
                id: `tag-${index}`,
                name: `Tag ${index}`,
                color: '#64748b',
                created_at: new Date().toISOString(),
              }))
            )
          }

          return HttpResponse.json([
            {
              id: 'tag-200',
              name: 'Tag 200',
              color: '#64748b',
              created_at: new Date().toISOString(),
            },
          ])
        })
      )

      const tags = await noteTagsApi.getAll()
      expect(tags).toHaveLength(201)
      expect(callCount).toBe(2)
    })
  })

  describe('notesApi', () => {
    it('should fetch notes with tag filters', async () => {
      const notes = await notesApi.getAll(undefined, undefined, undefined, undefined, ['note-tag-1'])
      expect(notes).toBeInstanceOf(Array)
    })
  })

  describe('timelinesApi', () => {
    it('should fetch all timelines', async () => {
      const timelines = await timelinesApi.getAll()
      expect(timelines).toBeInstanceOf(Array)
      expect(timelines[0]).toHaveProperty('name')
    })
  })

  describe('timelineEventsApi', () => {
    it('should fetch all timeline events', async () => {
      const events = await timelineEventsApi.getAll()
      expect(events).toBeInstanceOf(Array)
    })
  })

  describe('combinedViewsApi', () => {
    it('should fetch all combined views', async () => {
      const views = await combinedViewsApi.getAll()
      expect(views).toBeInstanceOf(Array)
    })
  })
})
