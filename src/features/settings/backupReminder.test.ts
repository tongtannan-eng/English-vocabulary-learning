import { describe, expect, it } from 'vitest'
import { backupSnapshot } from '../../services/backupStatus.ts'
import type { ParsedDeckFile } from '../../services/backupTypes.ts'
import { backupReminder, dataOverview } from './backupReminder.ts'

const file: ParsedDeckFile = {
  decks: [
    {
      id: 'a',
      date: '2026-11-01',
      title: '',
      createdAt: 1,
      updatedAt: 1,
      words: [{ id: '1', english: 'apple', chinese: '苹果', familiarity: 'unknown' }],
    },
  ],
  phrases: [],
  sentences: [],
}
const now = Date.parse('2026-11-08T00:00:00Z')
const last = {
  exportedAt: '2026-11-01T00:00:00Z',
  origin: 'local' as const,
  snapshot: backupSnapshot(file),
}

describe('backup reminder and overview', () => {
  it('counts active content and supports old backup fields', () => {
    expect(dataOverview(file)).toEqual({
      decks: 1,
      words: 1,
      phrases: 0,
      sentences: 0,
      unfamiliar: 1,
      trash: 0,
    })
    expect(backupReminder('weekly', null, { decks: [] }, now)).toBeNull()
    expect(backupReminder('weekly', null, file, now)).toContain('还没有完整备份')
  })
  it('honors frequency, elapsed time, and substantial changes', () => {
    expect(backupReminder('off', last, file, now)).toBeNull()
    expect(backupReminder('weekly', last, file, now)).toContain('7 天')
    expect(backupReminder('monthly', last, file, now)).toBeNull()
    const changed = {
      ...file,
      decks: [
        {
          ...file.decks[0]!,
          words: Array.from({ length: 21 }, (_, i) => ({
            id: String(i),
            english: `word${i}`,
            chinese: '词',
          })),
        },
      ],
    }
    expect(backupReminder('monthly', last, changed, now)).toContain('较多数据变化')
  })
})
