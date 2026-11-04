import { orderWords } from '../decks/deck.ts'
import { getWeekRange } from '../../shared/utils/format.ts'
import type { Deck, Familiarity, ReviewOrder, ReviewWord } from '../../shared/types.ts'

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
  if (!word || session.phase === 'done') return session
  const ratings = { ...session.ratings, [reviewWordKey(word)]: familiarity }
  if (session.cursor < session.sequence.length - 1) {
    return { ...session, ratings, cursor: session.cursor + 1 }
  }

  // Only one extra pass: words still unknown after it remain in the vocabulary book.
  if (session.phase === 'initial') {
    const retry = session.sequence.filter((item) => ratings[reviewWordKey(item)] === 'unknown')
    if (retry.length > 0) {
      return {
        ...session,
        phase: 'retry',
        sequence: retry,
        cursor: 0,
        ratings: {},
        retryCount: retry.length,
      }
    }
  }
  return { ...session, phase: 'done', ratings }
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
