import { describe, expect, it } from 'vitest'
import { hasReviewWork } from './reset.ts'
import { createReviewSession } from './review.ts'
import type { ReviewCheckpoint } from './learning.ts'

function fresh(): ReviewCheckpoint {
  const words = [
    {
      id: 'a',
      english: 'apple',
      chinese: '苹果',
      deckId: 'deck',
      deckDate: '2026-10-29',
      deckTitle: '',
    },
  ]
  return {
    id: 'session',
    key: 'deck:deck',
    path: '/review/deck',
    title: '',
    subtitle: '',
    backPath: '/',
    front: 'dictation',
    order: 'random',
    initialWords: words,
    session: createReviewSession(words, 'random'),
    answer: '',
    result: null,
    flipped: false,
    firstAttempts: {},
    shownAnswers: [],
    updatedAt: 1,
  }
}
describe('review reset protection', () => {
  it('does not interrupt a fresh session or a completed round', () => {
    expect(hasReviewWork(fresh())).toBe(false)
    const completed = fresh()
    completed.session.phase = 'done'
    completed.answer = 'apple'
    expect(hasReviewWork(completed)).toBe(false)
  })
  it('protects raw input, a revealed answer, submitted work and revisited questions', () => {
    for (const patch of [
      { answer: ' ' },
      { flipped: true },
      { shownAnswers: ['exposed'] },
      { result: { answer: 'aple', correct: false, assisted: false } },
      { firstAttempts: { attempt: { answer: 'aple', correct: false, assisted: false } } },
    ])
      expect(hasReviewWork({ ...fresh(), ...patch })).toBe(true)
    const rated = fresh()
    rated.session.ratings.a = 'known'
    expect(hasReviewWork(rated)).toBe(true)
    const moved = fresh()
    moved.session.cursor = 1
    expect(hasReviewWork(moved)).toBe(true)
    const retry = fresh()
    retry.session.phase = 'retry'
    expect(hasReviewWork(retry)).toBe(true)
  })
})
