import { describe, expect, it } from 'vitest'
import { spellingErrors, spellingErrorWords } from './spellingErrors.ts'
import {
  appendLearningRecord,
  isCheckpoint,
  isLearningRecord,
  learningSummary,
  makeLearningRecord,
} from './learning.ts'
import { createReviewSession } from './review.ts'
import { parseHash } from '../../app/router.ts'
import type { LearningRecord, ReviewCheckpoint, StudyState } from './learning.ts'

const word = {
  id: 'w',
  deckId: 'd',
  deckDate: '2026-10-30',
  deckTitle: '错题',
  english: 'apple',
  chinese: '苹果',
}
function record(id: string, patch: Partial<LearningRecord> = {}): LearningRecord {
  return {
    id,
    sessionId: id,
    deckId: 'd',
    wordId: 'w',
    english: 'apple',
    chinese: '苹果',
    mode: 'chinese',
    kind: 'spelling',
    round: 'initial',
    correct: false,
    assisted: false,
    answer: 'aple',
    at: 1,
    day: '2026-10-30',
    ...patch,
  }
}
function state(records: LearningRecord[]): StudyState {
  return {
    decks: [
      {
        id: 'd',
        title: '错题',
        date: '2026-10-30',
        createdAt: 1,
        updatedAt: 1,
        words: [{ id: 'w', english: 'apple', chinese: '苹果', familiarity: 'known' }],
      },
    ],
    records,
    sessions: {},
  }
}
describe('spelling error history and targeted practice', () => {
  it('counts actual first-round unassisted wrong submissions, once per immutable record', () => {
    const wrong = record('wrong')
    const source = state([
      wrong,
      wrong,
      record('dictation', { mode: 'dictation', at: 2, answer: 'appel' }),
      record('retry', { round: 'retry' }),
      record('assisted', { assisted: true }),
      record('correct', { correct: true }),
    ])
    const entry = spellingErrors(source)[0]!
    expect(entry.counts).toEqual({ chinese: 1, dictation: 1 })
    expect(entry.latest.answer).toBe('appel')
    expect(spellingErrorWords(source, 'dictation')).toEqual([
      expect.objectContaining({ english: 'apple' }),
    ])
    expect(source.mistakes).toBeUndefined()
  })
  it('preserves old records without fabricating typed answers, including unavailable words', () => {
    const legacy = record('old')
    delete legacy.answer
    expect(isLearningRecord(legacy)).toBe(true)
    const entry = spellingErrors({ ...state([legacy]), decks: [] })[0]!
    expect(entry.latest.answer).toBeUndefined()
    expect(entry.available).toBeUndefined()
    expect(spellingErrorWords({ ...state([legacy]), decks: [] }, 'chinese')).toEqual([])
    const changed = state([legacy])
    changed.decks[0]!.words[0]!.chinese = '苹果公司'
    expect(spellingErrorWords(changed, 'chinese')).toEqual([])
  })
  it('stores the actual answer but keeps first-attempt scores immutable', () => {
    const checkpoint: ReviewCheckpoint = {
      id: 's',
      key: 'errors:chinese',
      path: '/review-errors/chinese',
      title: '错题重练',
      subtitle: '',
      backPath: '/spelling-errors',
      front: 'chinese',
      order: 'sequential',
      session: createReviewSession([word], 'sequential'),
      initialWords: [word],
      answer: 'aple',
      result: null,
      flipped: false,
      firstAttempts: {},
      shownAnswers: [],
      updatedAt: 1,
    }
    const wrong = makeLearningRecord(
      checkpoint,
      word,
      'spelling',
      { answer: 'aple', correct: false, assisted: false },
      new Date(2026, 9, 30, 9).getTime(),
    )
    const corrected = { ...wrong, answer: 'apple', correct: true }
    expect(appendLearningRecord([wrong], corrected)).toEqual([wrong])
    expect(isLearningRecord(wrong)).toBe(true)
    expect(isLearningRecord({ ...wrong, answer: 42 })).toBe(false)
    const { answer: _answer, ...oldShape } = wrong
    expect(learningSummary([wrong], '2026-10-30')).toEqual(
      learningSummary([oldShape], '2026-10-30'),
    )
    expect(isCheckpoint(checkpoint)).toBe(true)
    expect(parseHash('#/review-errors/chinese')).toEqual({ name: 'review-errors', mode: 'chinese' })
    expect(parseHash('#/spelling-errors')).toEqual({ name: 'spelling-errors' })
  })
  it('keeps separate meanings and selects only the requested error mode', () => {
    const source = state([
      record('one'),
      record('two', { chinese: '苹果公司', wordId: 'other', mode: 'dictation' }),
    ])
    expect(spellingErrors(source)).toHaveLength(2)
    expect(spellingErrorWords(source, 'chinese')).toHaveLength(1)
    expect(spellingErrorWords(source, 'dictation')).toHaveLength(0)
  })
})
