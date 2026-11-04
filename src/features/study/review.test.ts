import { describe, expect, it, vi } from 'vitest'
import { normalizeDraft } from '../decks/deck.ts'
import { getWeekRange, shiftWeek } from '../../shared/utils/format.ts'
import {
  collectReviewWords,
  collectUnfamiliarWords,
  createReviewSession,
  rateReview,
  reviewWordKey,
  selectWeeklyDecks,
  updateWordFamiliarity,
} from './review.ts'
import { parseDeckFile } from '../../services/transfer.ts'
import { parseHash } from '../../app/router.ts'
import type { Deck } from '../../shared/types.ts'

function deck(id: string, date: string, words = ['apple', 'book'], createdAt = 1): Deck {
  return {
    id,
    date,
    title: id,
    createdAt,
    updatedAt: createdAt,
    words: words.map((english, index) => ({
      id: `word-${index}`,
      english,
      chinese: `释义 ${english}`,
    })),
  }
}

describe('weekly collection', () => {
  it.each([
    ['2026-10-26', '2026-10-26', '2026-11-01'],
    ['2026-11-01', '2026-10-26', '2026-11-01'],
    ['2027-01-01', '2026-12-28', '2027-01-03'],
    ['2024-02-29', '2024-02-26', '2024-03-03'],
  ])('uses Monday–Sunday for %s, including month/year boundaries', (date, start, end) => {
    expect(getWeekRange(date)).toEqual({ start, end })
  })

  it('includes both boundaries and orders whole decks chronologically', () => {
    const decks = [
      deck('sunday', '2026-11-01'),
      deck('after', '2026-11-02'),
      deck('monday-later', '2026-10-26', ['cat'], 3),
      deck('before', '2026-10-25'),
      deck('monday', '2026-10-26', ['dog'], 2),
    ]
    const weekly = selectWeeklyDecks(decks, '2026-10-29')
    expect(weekly.map((item) => item.id)).toEqual(['monday', 'monday-later', 'sunday'])
    expect(collectReviewWords(weekly).map((word) => word.english)).toEqual([
      'dog',
      'cat',
      'apple',
      'book',
    ])
    expect(decks[0]?.id).toBe('sunday')
  })

  it('navigates across years and normalizes deep-linked weeks', () => {
    expect(shiftWeek('2026-12-28', 1)).toBe('2027-01-04')
    expect(shiftWeek('2027-01-04', -1)).toBe('2026-12-28')
    expect(parseHash('#/review-weekly/2027-01-01')).toEqual({
      name: 'review-weekly',
      weekStart: '2026-12-28',
    })
    expect(parseHash('#/weekly/2026-02-30')).toEqual({ name: 'list' })
  })
})

describe('recognition and one extra pass', () => {
  const words = collectReviewWords([deck('today', '2026-10-29', ['apple', 'book', 'cat'])])

  it('defers unknown words until all initial cards are rated, then repeats only once', () => {
    let session = createReviewSession(words, 'sequential')
    session = rateReview(session, 'unknown')
    expect(session.phase).toBe('initial')
    expect(session.sequence[session.cursor]?.english).toBe('book')
    session = rateReview(session, 'known')
    session = rateReview(session, 'unknown')
    expect(session.phase).toBe('retry')
    expect(session.sequence.map((word) => word.english)).toEqual(['apple', 'cat'])
    expect(session.retryCount).toBe(2)
    session = rateReview(session, 'known')
    session = rateReview(session, 'unknown')
    expect(session.phase).toBe('done')
    expect(Object.values(session.ratings).filter((rating) => rating === 'unknown')).toHaveLength(1)
    expect(rateReview(session, 'known')).toBe(session)
  })

  it('finishes immediately after an all-known first pass', () => {
    let session = createReviewSession(words, 'sequential')
    for (const _word of words) session = rateReview(session, 'known')
    expect(session.phase).toBe('done')
    expect(session.retryCount).toBe(0)
  })

  it('uses a corrected answer when revisiting an earlier card', () => {
    let session = createReviewSession(words, 'sequential')
    session = rateReview(session, 'unknown')
    session = rateReview({ ...session, cursor: 0 }, 'known')
    session = rateReview(session, 'known')
    session = rateReview(session, 'known')
    expect(session.phase).toBe('done')
    expect(session.retryCount).toBe(0)
  })

  it('keeps every word and source when shuffling the entire week', () => {
    const mixed = collectReviewWords([deck('monday', '2026-10-26'), deck('tuesday', '2026-10-27')])
    const random = vi.spyOn(Math, 'random').mockReturnValue(0)
    const session = createReviewSession(mixed, 'random')
    random.mockRestore()
    expect(session.sequence.map(reviewWordKey).sort()).toEqual(mixed.map(reviewWordKey).sort())
    expect(new Set(session.sequence.map(reviewWordKey)).size).toBe(4)
    expect(new Set(session.sequence.slice(0, 2).map((word) => word.deckId)).size).toBe(2)
    expect(mixed[0]?.english).toBe('apple')
  })

  it('handles an empty week or vocabulary book', () => {
    const empty = createReviewSession([], 'random')
    expect(empty.phase).toBe('done')
    expect(rateReview(empty, 'unknown')).toBe(empty)
  })
})

describe('persistent vocabulary and backup compatibility', () => {
  it('adds unknown words and removes only the matching occurrence when recognised', () => {
    const original = [deck('first', '2026-10-26'), deck('second', '2026-10-27')]
    const firstWord = collectReviewWords(original)[0]!
    let next = updateWordFamiliarity(original, firstWord, 'unknown', 100)!
    const secondWord = collectReviewWords(next)[2]!
    next = updateWordFamiliarity(next, secondWord, 'unknown', 101)!
    expect(collectUnfamiliarWords(next)).toHaveLength(2)
    next = updateWordFamiliarity(next, firstWord, 'known', 102)!
    expect(collectUnfamiliarWords(next).map((word) => word.deckId)).toEqual(['second'])
    expect(original[0]?.words[0]?.familiarity).toBeUndefined()
    expect(next[0]?.updatedAt).toBe(102)
    expect(updateWordFamiliarity([], firstWord, 'known')).toBeNull()
  })

  it('preserves learning state when editing a title, but resets changed word content', () => {
    const previous = [
      {
        id: 'a',
        english: 'apple',
        chinese: '苹果',
        familiarity: 'unknown' as const,
        reviewedAt: 10,
      },
    ]
    expect(normalizeDraft([{ id: 'a', english: ' apple ', chinese: '苹果' }], previous)).toEqual({
      words: previous,
    })
    expect(normalizeDraft([{ id: 'a', english: 'pear', chinese: '梨' }], previous)).toEqual({
      words: [{ id: 'a', english: 'pear', chinese: '梨' }],
    })
  })

  it('reads old backups and round-trips new recognition records without dropping them', () => {
    const original = [deck('today', '2026-10-29')]
    const file = (decks: Deck[]) =>
      JSON.stringify({ kind: 'english-daily-decks', version: 1, decks })
    expect(parseDeckFile(file(original))).toEqual({ decks: original })
    const marked = updateWordFamiliarity(
      original,
      collectReviewWords(original)[0]!,
      'unknown',
      123,
    )!
    expect(parseDeckFile(file(marked))).toEqual({ decks: marked })
    const invalid = JSON.parse(file(marked))
    invalid.decks[0].words[0].familiarity = 'invalid'
    expect(parseDeckFile(JSON.stringify(invalid))).toHaveProperty('error')
  })

  it('saves multiple optional sentences and notes while preserving recognition', () => {
    const original = {
      id: 'a',
      english: 'apple',
      chinese: '苹果',
      familiarity: 'unknown' as const,
      reviewedAt: 10,
    }
    const result = normalizeDraft(
      [
        {
          ...original,
          collocations: ' an apple a day \r\n\n I eat an apple every morning. ',
          notes: ' 容易与 apply 混淆。\n注意词尾。 ',
        },
      ],
      [original],
    )
    expect(result).toEqual({
      words: [
        {
          ...original,
          collocations: ['an apple a day', 'I eat an apple every morning.'],
          notes: '容易与 apply 混淆。\n注意词尾。',
        },
      ],
    })
  })

  it('allows clearing optional fields and rejects notes with no word', () => {
    const original = {
      id: 'a',
      english: 'apple',
      chinese: '苹果',
      collocations: ['an apple a day'],
      notes: '备注',
    }
    expect(
      normalizeDraft(
        [{ id: 'a', english: 'apple', chinese: '苹果', collocations: '', notes: '' }],
        [original],
      ),
    ).toEqual({
      words: [{ id: 'a', english: 'apple', chinese: '苹果' }],
    })
    expect(
      normalizeDraft([{ id: 'a', english: '', chinese: '', notes: '不要静默丢失这条备注' }]),
    ).toHaveProperty('error')
  })

  it('round-trips collocations and notes in backups and validates their types', () => {
    const entry = deck('today', '2026-10-29', ['apple'])
    entry.words[0] = {
      ...entry.words[0]!,
      collocations: ['an apple a day', 'an apple tree'],
      notes: '记忆备注',
    }
    const backup = { kind: 'english-daily-decks', version: 1, decks: [entry] }
    expect(parseDeckFile(JSON.stringify(backup))).toEqual({ decks: [entry] })
    const invalid = JSON.parse(JSON.stringify(backup))
    invalid.decks[0].words[0].collocations = ['a sentence', 5]
    expect(parseDeckFile(JSON.stringify(invalid))).toHaveProperty('error')
  })
})
