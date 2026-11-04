import type { Deck, DraftWord, ReviewOrder, Word } from '../../shared/types.ts'

export function sortDecks(decks: readonly Deck[]): Deck[] {
  return [...decks].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1
    return b.updatedAt - a.updatedAt
  })
}

export function wordPreview(words: readonly Word[], limit = 4): string {
  if (words.length === 0) return '还没有单词'
  const text = words
    .slice(0, limit)
    .map((word) => `${word.english} ${word.chinese}`)
    .join(' · ')
  return words.length > limit ? `${text} …` : text
}

export function shuffle<T>(items: readonly T[]): T[] {
  const next = [...items]
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    const current = next[index]
    next[index] = next[swapIndex] as T
    next[swapIndex] = current as T
  }
  return next
}

export function orderWords<T extends Word>(words: readonly T[], order: ReviewOrder): T[] {
  return order === 'random' ? shuffle(words) : [...words]
}

export function normalizeDraft(
  words: readonly DraftWord[],
  previousWords: readonly Word[] = [],
): { words: Word[] } | { error: string; index?: number } {
  const kept: Word[] = []
  const previousById = new Map(previousWords.map((word) => [word.id, word]))
  for (let index = 0; index < words.length; index += 1) {
    const draft = words[index]
    if (!draft) continue
    const english = draft.english.trim()
    const chinese = draft.chinese.trim()
    const collocations = (draft.collocations ?? '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
    const notes = draft.notes?.trim() ?? ''
    if (!english && !chinese && collocations.length === 0 && !notes) continue
    if (!english || !chinese) {
      return { error: `第 ${index + 1} 行需要同时填写英文和中文释义`, index }
    }
    const previous = previousById.get(draft.id)
    const word: Word =
      previous?.english === english && previous.chinese === chinese
        ? { ...previous, english, chinese }
        : { id: draft.id, english, chinese }
    delete word.collocations
    delete word.notes
    if (collocations.length > 0) word.collocations = collocations
    if (notes) word.notes = notes
    kept.push(word)
  }
  if (kept.length === 0) return { error: '请至少添加一个单词' }
  return { words: kept }
}

export function createDraftWord(): DraftWord {
  return { id: crypto.randomUUID(), english: '', chinese: '' }
}
