import { describe, expect, it } from 'vitest'
import { quickWords, quickKey, quickPath } from './quick.ts'
import { parseHash } from '../../app/router.ts'
import { createReviewSession } from './review.ts'
import { isCheckpoint } from './learning.ts'
import type { Deck } from '../../shared/types.ts'

const today = '2026-10-29'
const deck: Deck = {
  id: 'day',
  date: today,
  title: '',
  createdAt: 1,
  updatedAt: 1,
  words: [
    ...Array.from({ length: 25 }, (_, index) => ({
      id: `n${index}`,
      english: `new${index}`,
      chinese: `新词${index}`,
    })),
    { id: 'due', english: 'due', chinese: '到期', nextReviewDate: today },
    { id: 'late', english: 'late', chinese: '逾期', nextReviewDate: '2026-10-27' },
  ],
}
describe('short practice queues', () => {
  it('selects overdue/due words before new words and respects all three limits', () => {
    for (const limit of [5, 10, 20] as const) {
      const words = quickWords([deck], limit, today)
      expect(words).toHaveLength(limit)
      expect(words.slice(0, 2).map((word) => word.id)).toEqual(['late', 'due'])
    }
    expect(deck.words).toHaveLength(27)
  })
  it('deduplicates the same English/meaning across cards and retains distinct meanings', () => {
    const first = { ...deck, words: [{ id: 'a', english: 'Bank', chinese: '银行' }] }
    const second = {
      ...deck,
      id: 'next',
      words: [
        { id: 'b', english: ' BANK ', chinese: '银行' },
        { id: 'c', english: 'bank', chinese: '河岸' },
      ],
    }
    expect(quickWords([first, second], 10, today).map((word) => word.chinese)).toEqual([
      '银行',
      '河岸',
    ])
  })
  it('uses only available eligible words and excludes future cards and reviews', () => {
    const source = {
      ...deck,
      words: [
        { id: 'a', english: 'one', chinese: '一' },
        { id: 'b', english: 'two', chinese: '二', nextReviewDate: '2026-11-01' },
      ],
    }
    expect(
      quickWords([source, { ...deck, id: 'future', date: '2026-10-30' }], 5, today),
    ).toHaveLength(1)
  })
  it('round-trips distinct dated routes and accepts checkpoints for backup/resume', () => {
    const words = quickWords([deck], 5, today)
    const path = quickPath(today, 5)
    expect(parseHash(`#${path}`)).toEqual({ name: 'review-quick', date: today, limit: 5 })
    expect(parseHash('#/review-quick/2026-02-30/5')).toEqual({ name: 'list' })
    expect(parseHash('#/review-quick/2026-10-29/500')).toEqual({ name: 'list' })
    expect(quickKey(today, 5)).not.toBe(quickKey(today, 10))
    expect(
      isCheckpoint({
        id: 'quick',
        key: quickKey(today, 5),
        path,
        title: '短时',
        subtitle: '',
        backPath: '/',
        front: 'dictation',
        order: 'random',
        initialWords: words,
        session: createReviewSession(words, 'random'),
        flipped: false,
        answer: 'unfinished',
        result: null,
        firstAttempts: {},
        shownAnswers: [],
        updatedAt: 1,
      }),
    ).toBe(true)
  })
})
