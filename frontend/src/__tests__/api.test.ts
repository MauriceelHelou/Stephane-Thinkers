/**
 * Tests for API client functions
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  timelinesApi,
  thinkersApi,
  connectionsApi,
  publicationsApi,
  quotesApi,
  tagsApi,
  aiApi,
  researchQuestionsApi,
  institutionsApi,
  notesApi,
  combinedViewsApi,
  timelineEventsApi,
} from '@/lib/api'
import { ConnectionType } from '@/types'

describe('API Client', () => {
  describe('timelinesApi', () => {
    it('should have getAll method', () => {
      expect(timelinesApi.getAll).toBeDefined()
      expect(typeof timelinesApi.getAll).toBe('function')
    })

    it('should have getOne method', () => {
      expect(timelinesApi.getOne).toBeDefined()
      expect(typeof timelinesApi.getOne).toBe('function')
    })

    it('should have create method', () => {
      expect(timelinesApi.create).toBeDefined()
      expect(typeof timelinesApi.create).toBe('function')
    })

    it('should have update method', () => {
      expect(timelinesApi.update).toBeDefined()
      expect(typeof timelinesApi.update).toBe('function')
    })

    it('should have delete method', () => {
      expect(timelinesApi.delete).toBeDefined()
      expect(typeof timelinesApi.delete).toBe('function')
    })

    it('should fetch all timelines', async () => {
      const timelines = await timelinesApi.getAll()
      expect(Array.isArray(timelines)).toBe(true)
    })

    it('should create a timeline', async () => {
      const timeline = await timelinesApi.create({
        name: 'New Timeline',
        description: 'Test description'
      })
      expect(timeline).toHaveProperty('id')
      expect(timeline.name).toBe('New Timeline')
    })
  })

  describe('thinkersApi', () => {
    it('should have getAll method with timeline filter support', () => {
      expect(thinkersApi.getAll).toBeDefined()
    })

    it('should have getOne method returning relations', () => {
      expect(thinkersApi.getOne).toBeDefined()
    })

    it('should fetch all thinkers', async () => {
      const thinkers = await thinkersApi.getAll()
      expect(Array.isArray(thinkers)).toBe(true)
    })

    it('should fetch thinkers by timeline', async () => {
      const thinkers = await thinkersApi.getAll('timeline-1')
      expect(Array.isArray(thinkers)).toBe(true)
    })

    it('should create a thinker', async () => {
      const thinker = await thinkersApi.create({
        name: 'New Thinker',
        birth_year: 1900,
        death_year: 1980,
        timeline_id: 'timeline-1'
      })
      expect(thinker).toHaveProperty('id')
    })

    it('should fetch thinker with relations', async () => {
      const thinker = await thinkersApi.getOne('thinker-1')
      expect(thinker).toHaveProperty('publications')
      expect(thinker).toHaveProperty('quotes')
      expect(thinker).toHaveProperty('tags')
    })
  })

  describe('connectionsApi', () => {
    it('should have CRUD methods', () => {
      expect(connectionsApi.getAll).toBeDefined()
      expect(connectionsApi.getOne).toBeDefined()
      expect(connectionsApi.create).toBeDefined()
      expect(connectionsApi.update).toBeDefined()
      expect(connectionsApi.delete).toBeDefined()
    })

    it('should fetch all connections', async () => {
      const connections = await connectionsApi.getAll()
      expect(Array.isArray(connections)).toBe(true)
    })

    it('should create a connection', async () => {
      const connection = await connectionsApi.create({
        from_thinker_id: 'thinker-1',
        to_thinker_id: 'thinker-2',
        connection_type: ConnectionType.influenced,
        strength: 3
      })
      expect(connection).toHaveProperty('id')
    })
  })

  describe('publicationsApi', () => {
    it('should have CRUD methods', () => {
      expect(publicationsApi.getAll).toBeDefined()
      expect(publicationsApi.create).toBeDefined()
    })

    it('should have getCitations method', () => {
      expect(publicationsApi.getCitations).toBeDefined()
    })

    it('should fetch publications by thinker', async () => {
      const publications = await publicationsApi.getAll('thinker-1')
      expect(Array.isArray(publications)).toBe(true)
    })
  })

  describe('quotesApi', () => {
    it('should have CRUD methods', () => {
      expect(quotesApi.getAll).toBeDefined()
      expect(quotesApi.create).toBeDefined()
    })

    it('should fetch quotes by thinker', async () => {
      const quotes = await quotesApi.getAll('thinker-1')
      expect(Array.isArray(quotes)).toBe(true)
    })
  })

  describe('tagsApi', () => {
    it('should have CRUD methods', () => {
      expect(tagsApi.getAll).toBeDefined()
      expect(tagsApi.getOne).toBeDefined()
      expect(tagsApi.create).toBeDefined()
      expect(tagsApi.update).toBeDefined()
      expect(tagsApi.delete).toBeDefined()
    })

    it('should fetch all tags', async () => {
      const tags = await tagsApi.getAll()
      expect(Array.isArray(tags)).toBe(true)
    })
  })

  describe('aiApi', () => {
    it('should have status method', () => {
      expect(aiApi.getStatus).toBeDefined()
    })

    it('should have suggestConnections method', () => {
      expect(aiApi.suggestConnections).toBeDefined()
    })

    it('should have getThinkerInsight method', () => {
      expect(aiApi.getThinkerInsight).toBeDefined()
    })

    it('should have suggestResearch method', () => {
      expect(aiApi.suggestResearch).toBeDefined()
    })

    it('should have validateConnection method', () => {
      expect(aiApi.validateConnection).toBeDefined()
    })

    it('should fetch AI status', async () => {
      const status = await aiApi.getStatus()
      expect(status).toHaveProperty('enabled')
      expect(status).toHaveProperty('message')
    })

    it('should fetch connection suggestions', async () => {
      const suggestions = await aiApi.suggestConnections(5)
      expect(Array.isArray(suggestions)).toBe(true)
    })

    it('should fetch research suggestions', async () => {
      const suggestions = await aiApi.suggestResearch(3)
      expect(Array.isArray(suggestions)).toBe(true)
    })
  })

  describe('researchQuestionsApi', () => {
    it('should have CRUD methods', () => {
      expect(researchQuestionsApi.getAll).toBeDefined()
      expect(researchQuestionsApi.getOne).toBeDefined()
      expect(researchQuestionsApi.create).toBeDefined()
      expect(researchQuestionsApi.update).toBeDefined()
      expect(researchQuestionsApi.delete).toBeDefined()
    })

    it('should have getStats method', () => {
      expect(researchQuestionsApi.getStats).toBeDefined()
    })

    it('should fetch research questions', async () => {
      const questions = await researchQuestionsApi.getAll()
      expect(Array.isArray(questions)).toBe(true)
    })

    it('should fetch stats', async () => {
      const stats = await researchQuestionsApi.getStats()
      expect(stats).toHaveProperty('total')
    })
  })

  describe('institutionsApi', () => {
    it('should have CRUD methods', () => {
      expect(institutionsApi.getAll).toBeDefined()
      expect(institutionsApi.create).toBeDefined()
    })

    it('should fetch institutions', async () => {
      const institutions = await institutionsApi.getAll()
      expect(Array.isArray(institutions)).toBe(true)
    })
  })

  describe('notesApi', () => {
    it('should have CRUD methods', () => {
      expect(notesApi.getAll).toBeDefined()
      expect(notesApi.getOne).toBeDefined()
      expect(notesApi.create).toBeDefined()
      expect(notesApi.update).toBeDefined()
      expect(notesApi.delete).toBeDefined()
    })

    it('should have getVersions method', () => {
      expect(notesApi.getVersions).toBeDefined()
    })

    it('should have getBacklinks method', () => {
      expect(notesApi.getBacklinks).toBeDefined()
    })

    it('should fetch notes', async () => {
      const notes = await notesApi.getAll()
      expect(Array.isArray(notes)).toBe(true)
    })
  })

  describe('combinedViewsApi', () => {
    it('should have CRUD methods', () => {
      expect(combinedViewsApi.getAll).toBeDefined()
      expect(combinedViewsApi.getOne).toBeDefined()
      expect(combinedViewsApi.create).toBeDefined()
    })

    it('should have getEvents method', () => {
      expect(combinedViewsApi.getEvents).toBeDefined()
    })

    it('should fetch combined views', async () => {
      const views = await combinedViewsApi.getAll()
      expect(Array.isArray(views)).toBe(true)
    })
  })

  describe('timelineEventsApi', () => {
    it('should have CRUD methods', () => {
      expect(timelineEventsApi.getAll).toBeDefined()
      expect(timelineEventsApi.create).toBeDefined()
    })

    it('should fetch timeline events', async () => {
      const events = await timelineEventsApi.getAll()
      expect(Array.isArray(events)).toBe(true)
    })
  })
})
