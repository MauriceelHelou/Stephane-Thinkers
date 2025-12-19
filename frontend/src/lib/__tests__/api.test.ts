import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  thinkersApi,
  connectionsApi,
  publicationsApi,
  quotesApi,
  tagsApi,
  timelinesApi,
  timelineEventsApi,
  combinedViewsApi,
} from '../api'

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
