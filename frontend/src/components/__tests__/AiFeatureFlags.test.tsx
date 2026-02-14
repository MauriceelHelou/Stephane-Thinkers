import { describe, expect, it } from 'vitest'

import { notesAiFlags } from '@/lib/notesAiFlags'

describe('notesAiFlags', () => {
  it('exposes all phase flags', () => {
    expect(typeof notesAiFlags.phaseA).toBe('boolean')
    expect(typeof notesAiFlags.phaseB).toBe('boolean')
    expect(typeof notesAiFlags.phaseC).toBe('boolean')
    expect(typeof notesAiFlags.phaseD).toBe('boolean')
    expect(typeof notesAiFlags.phaseE).toBe('boolean')
    expect(typeof notesAiFlags.phaseF).toBe('boolean')
  })
})
