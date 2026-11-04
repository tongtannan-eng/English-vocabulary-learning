import type { LearningRecord, StudyState } from './learning.ts'
import type { ReviewWord } from '../../shared/types.ts'
import { mistakeWordKey } from './mistakes.ts'

export type SpellingMode = 'chinese' | 'dictation'
export interface SpellingErrorGroup {
  key: string
  english: string
  chinese: string
  errors: LearningRecord[]
  latest: LearningRecord
  counts: { chinese: number; dictation: number }
  available?: ReviewWord
}
/** Count real, unassisted first-round submissions. Retries never inflate these counts. */
export function spellingErrors(state: Pick<StudyState, 'decks' | 'records'>): SpellingErrorGroup[] {
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
  const groups = new Map<string, SpellingErrorGroup>()
  const seen = new Set<string>()
  for (const record of [...state.records].sort((a, b) => b.at - a.at)) {
    if (seen.has(record.id)) continue
    seen.add(record.id)
    if (
      record.kind !== 'spelling' ||
      record.correct !== false ||
      record.assisted ||
      record.round !== 'initial' ||
      record.mode === 'english'
    )
      continue
    const key = mistakeWordKey(record)
    let group = groups.get(key)
    if (!group) {
      group = {
        key,
        english: record.english,
        chinese: record.chinese,
        errors: [],
        latest: record,
        counts: { chinese: 0, dictation: 0 },
      }
      groups.set(key, group)
    }
    group.errors.push(record)
    group.counts[record.mode] += 1
    const word = active.get(JSON.stringify([record.deckId, record.wordId]))
    if (!group.available && word && mistakeWordKey(word) === key) group.available = word
  }
  return [...groups.values()]
}
export function spellingErrorWords(
  state: Pick<StudyState, 'decks' | 'records'>,
  mode: SpellingMode,
): ReviewWord[] {
  return spellingErrors(state).flatMap((entry) =>
    entry.counts[mode] && entry.available ? [entry.available] : [],
  )
}
