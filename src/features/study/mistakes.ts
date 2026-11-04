import type { StudyState } from './learning.ts'
import type { Familiarity, ReviewWord } from '../../shared/types.ts'
import { parseISODate } from '../../shared/utils/format.ts'

export interface MistakeEntry {
  deckId: string
  wordId: string
  deckDate: string
  deckTitle: string
  english: string
  chinese: string
  lastUnknownAt?: number
}
const normalize = (value: string) =>
  value.normalize('NFC').trim().toLowerCase().replace(/\s+/g, ' ')
export const mistakeWordKey = (word: { english: string; chinese: string }) =>
  JSON.stringify([normalize(word.english), word.chinese.trim()])
export const mistakeSourceKey = (entry: MistakeEntry) =>
  JSON.stringify([entry.deckId, entry.wordId, mistakeWordKey(entry)])
export function isMistakeEntry(value: unknown): value is MistakeEntry {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const entry = value as Record<string, unknown>
  return (
    ['deckId', 'wordId', 'deckDate', 'deckTitle', 'english', 'chinese'].every(
      (key) => typeof entry[key] === 'string',
    ) &&
    Boolean(parseISODate(entry.deckDate as string)) &&
    (entry.lastUnknownAt === undefined ||
      (typeof entry.lastUnknownAt === 'number' &&
        Number.isFinite(entry.lastUnknownAt) &&
        Number.isFinite(new Date(entry.lastUnknownAt).getTime())))
  )
}
export function mergeMistakes(...sources: (readonly MistakeEntry[])[]): MistakeEntry[] {
  const entries = new Map<string, MistakeEntry>()
  for (const entry of sources.flat()) {
    const key = mistakeSourceKey(entry),
      previous = entries.get(key)
    if (!previous || (entry.lastUnknownAt ?? -Infinity) > (previous.lastUnknownAt ?? -Infinity))
      entries.set(key, { ...entry })
  }
  return [...entries.values()].sort(
    (a, b) =>
      (b.lastUnknownAt ?? 0) - (a.lastUnknownAt ?? 0) ||
      mistakeSourceKey(a).localeCompare(mistakeSourceKey(b)),
  )
}
export function unknownSnapshot(word: ReviewWord, at?: number): MistakeEntry {
  return {
    deckId: word.deckId,
    wordId: word.id,
    deckDate: word.deckDate,
    deckTitle: word.deckTitle,
    english: word.english,
    chinese: word.chinese,
    ...(at !== undefined ? { lastUnknownAt: at } : {}),
  }
}

/** Existing unknown ratings recover history without inventing any learning records. */
export function collectMistakeEntries(
  state: Pick<StudyState, 'decks' | 'records' | 'trash' | 'mistakes'>,
): MistakeEntry[] {
  const decks = [...state.decks, ...(state.trash ?? []).map((entry) => entry.deck)]
  const byId = new Map(decks.map((deck) => [deck.id, deck]))
  const recorded = state.records
    .filter((record) => record.kind === 'recognition' && record.rating === 'unknown')
    .map((record): MistakeEntry => {
      const deck = byId.get(record.deckId)
      return {
        deckId: record.deckId,
        wordId: record.wordId,
        english: record.english,
        chinese: record.chinese,
        deckDate: deck?.date ?? record.day,
        deckTitle: deck?.title ?? '',
        lastUnknownAt: record.at,
      }
    })
  const legacy = decks.flatMap((deck) =>
    deck.words
      .filter((word) => word.familiarity === 'unknown')
      .map((word) =>
        unknownSnapshot(
          { ...word, deckId: deck.id, deckDate: deck.date, deckTitle: deck.title },
          word.reviewedAt,
        ),
      ),
  )
  return mergeMistakes(state.mistakes ?? [], recorded, legacy)
}
export function withMistakeHistory(state: StudyState): StudyState {
  const mistakes = collectMistakeEntries(state)
  return mistakes.length ? { ...state, mistakes } : state
}
export function rememberRating(
  state: StudyState,
  word: ReviewWord,
  rating: Familiarity,
  at: number,
): MistakeEntry[] {
  return mergeMistakes(
    collectMistakeEntries(state),
    rating === 'unknown' ? [unknownSnapshot(word, at)] : [],
  )
}

export interface HistoricalMistake {
  key: string
  english: string
  chinese: string
  lastUnknownAt?: number
  sources: MistakeEntry[]
  words: ReviewWord[]
  status: 'unknown' | 'known' | 'unavailable'
}
export function historicalMistakes(state: StudyState): HistoricalMistake[] {
  const active = new Map(
    state.decks.flatMap((deck) =>
      deck.words.map(
        (word) =>
          [
            JSON.stringify([deck.id, word.id]),
            { ...word, deckId: deck.id, deckDate: deck.date, deckTitle: deck.title },
          ] as const,
      ),
    ),
  )
  const groups = new Map<string, HistoricalMistake>()
  for (const entry of collectMistakeEntries(state)) {
    const key = mistakeWordKey(entry)
    let group = groups.get(key)
    if (!group) {
      group = {
        key,
        english: entry.english,
        chinese: entry.chinese,
        lastUnknownAt: entry.lastUnknownAt,
        sources: [],
        words: [],
        status: 'unavailable',
      }
      groups.set(key, group)
    }
    group.sources.push(entry)
    const word = active.get(JSON.stringify([entry.deckId, entry.wordId]))
    if (word && mistakeWordKey(word) === key) group.words.push(word)
  }
  return [...groups.values()].map((entry) => ({
    ...entry,
    status: entry.words.some((word) => word.familiarity !== 'known')
      ? ('unknown' as const)
      : entry.words.some((word) => word.familiarity === 'known')
        ? ('known' as const)
        : ('unavailable' as const),
  }))
}
export function historicalReviewWords(state: StudyState): ReviewWord[] {
  return historicalMistakes(state).flatMap((entry) => {
    const word = entry.words.find((item) => item.familiarity === 'unknown') ?? entry.words[0]
    return word ? [word] : []
  })
}
