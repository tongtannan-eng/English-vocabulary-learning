import { orderWords } from '../decks/deck.ts'
import { getMonthRange, getWeekRange } from '../../shared/utils/format.ts'
import type {
  Deck,
  Familiarity,
  Phrase,
  ReviewOrder,
  ReviewWord,
  Sentence,
} from '../../shared/types.ts'

export type TextReviewKind = 'phrases' | 'sentences'
export function textReviewDeck(kind: TextReviewKind, items: readonly (Phrase | Sentence)[]): Deck {
  return {
    id: `__text_review_${kind}`,
    date: '1970-01-01',
    title: kind === 'phrases' ? '词组' : '语句',
    createdAt: 0,
    updatedAt: 0,
    words: items.map(({ id, english, chinese }) => ({ id, english, chinese })),
  }
}

export function collectReviewWords(decks: readonly Deck[]): ReviewWord[] {
  return decks.flatMap((deck) =>
    deck.words.map((word) => ({
      ...word,
      deckId: deck.id,
      deckDate: deck.date,
      deckTitle: deck.title,
    })),
  )
}

export function collectUnfamiliarWords(decks: readonly Deck[]): ReviewWord[] {
  return collectReviewWords(decks).filter((word) => word.familiarity === 'unknown')
}

export function selectWeeklyDecks(decks: readonly Deck[], date: string): Deck[] {
  const { start, end } = getWeekRange(date)
  return decks
    .filter((deck) => deck.date >= start && deck.date <= end)
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt)
}

export function selectMonthlyDecks(decks: readonly Deck[], date: string): Deck[] {
  const { start, end } = getMonthRange(date)
  return decks
    .filter((deck) => deck.date >= start && deck.date <= end)
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt)
}

export function randomReviewBatch(
  words: readonly ReviewWord[],
  limit: number,
  seen: readonly string[] = [],
): ReviewWord[] {
  const excluded = new Set(seen)
  return orderWords(
    words.filter((word) => !excluded.has(reviewWordKey(word))),
    'random',
  ).slice(0, limit)
}

export function reviewWordKey(word: ReviewWord): string {
  return JSON.stringify([word.deckId, word.id])
}

export interface ReviewSession {
  phase: 'initial' | 'retry' | 'done'
  sequence: ReviewWord[]
  cursor: number
  ratings: Record<string, Familiarity>
  initialCount: number
  retryCount: number
}

export function createReviewSession(
  words: readonly ReviewWord[],
  order: ReviewOrder,
): ReviewSession {
  return {
    phase: words.length > 0 ? 'initial' : 'done',
    sequence: orderWords(words, order),
    cursor: 0,
    ratings: {},
    initialCount: words.length,
    retryCount: 0,
  }
}

export function rateReview(session: ReviewSession, familiarity: Familiarity): ReviewSession {
  const word = session.sequence[session.cursor]
  if (!word || session.phase !== 'initial') return session
  const ratings = { ...session.ratings, [reviewWordKey(word)]: familiarity }
  if (session.cursor < session.sequence.length - 1) {
    return { ...session, ratings, cursor: session.cursor + 1 }
  }

  const retry = session.sequence.filter((item) => ratings[reviewWordKey(item)] === 'unknown')
  if (retry.length > 0) {
    return {
      ...session,
      phase: 'retry',
      sequence: retry,
      cursor: 0,
      ratings,
      retryCount: retry.length,
    }
  }
  return { ...session, phase: 'done', ratings }
}

/** Reviewing an answer again must not change its first rating. */
export function advanceRetry(session: ReviewSession): ReviewSession {
  if (session.phase !== 'retry' || !session.sequence[session.cursor]) return session
  return session.cursor < session.sequence.length - 1
    ? { ...session, cursor: session.cursor + 1 }
    : { ...session, phase: 'done' }
}

export function updateWordFamiliarity(
  decks: readonly Deck[],
  item: ReviewWord,
  familiarity: Familiarity,
  now = Date.now(),
): Deck[] | null {
  const deck = decks.find((entry) => entry.id === item.deckId)
  if (!deck?.words.some((word) => word.id === item.id)) return null
  return decks.map((entry) =>
    entry.id !== item.deckId
      ? entry
      : {
          ...entry,
          updatedAt: now,
          words: entry.words.map((word) =>
            word.id !== item.id ? word : { ...word, familiarity, reviewedAt: now },
          ),
        },
  )
}
