import type { Deck, DraftWord } from '../../shared/types.ts'

export interface DuplicateMatch {
  english: string
  chinese: string
  row?: number
  date?: string
  title?: string
}

export function normalizedEnglish(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function findDuplicates(
  words: readonly DraftWord[],
  decks: readonly Deck[],
  editingDeckId?: string,
): Map<string, DuplicateMatch[]> {
  const history = new Map<string, DuplicateMatch[]>()
  for (const deck of decks) {
    if (deck.id === editingDeckId) continue
    for (const word of deck.words) {
      const key = normalizedEnglish(word.english)
      const matches = history.get(key) ?? []
      matches.push({
        english: word.english,
        chinese: word.chinese,
        date: deck.date,
        title: deck.title,
      })
      history.set(key, matches)
    }
  }
  const result = new Map<string, DuplicateMatch[]>()
  words.forEach((word, index) => {
    const key = normalizedEnglish(word.english)
    if (!key) return
    const current = words.flatMap((other, row) =>
      row !== index && normalizedEnglish(other.english) === key
        ? [{ english: other.english, chinese: other.chinese, row: row + 1 }]
        : [],
    )
    const matches = [...current, ...(history.get(key) ?? [])]
    if (matches.length > 0) result.set(word.id, matches)
  })
  return result
}
