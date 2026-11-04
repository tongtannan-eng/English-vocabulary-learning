import type { DeletedDraftWord, DraftWord } from '../../shared/types.ts'

export const EDITOR_PAGE_SIZE = 10
export function filterEditorWords(
  words: readonly DraftWord[],
  query: string,
  incompleteOnly: boolean,
) {
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean)
  return words
    .map((word, index) => ({ word, index }))
    .filter(({ word }) => {
      if (incompleteOnly && word.english.trim() && word.chinese.trim()) return false
      const text = [word.english, word.chinese, word.collocations ?? '', word.notes ?? '']
        .join(' ')
        .toLowerCase()
      return terms.every((term) => text.includes(term))
    })
}

/** Keep neighbouring IDs so undo still finds its place after other row edits. */
export function deleteEditorWord(words: readonly DraftWord[], id: string) {
  const index = words.findIndex((word) => word.id === id)
  if (index < 0) return null
  return {
    words: words.filter((word) => word.id !== id),
    deleted: {
      word: { ...words[index]! },
      index,
      beforeId: words[index - 1]?.id,
      afterId: words[index + 1]?.id,
    },
  }
}

export function restoreEditorWord(words: readonly DraftWord[], deleted: DeletedDraftWord) {
  const existing = words.findIndex((word) => word.id === deleted.word.id)
  if (existing >= 0) return { words: [...words], index: existing }
  const after = words.findIndex((word) => word.id === deleted.afterId)
  const before = words.findIndex((word) => word.id === deleted.beforeId)
  const index =
    after >= 0 ? after : before >= 0 ? before + 1 : Math.min(deleted.index, words.length)
  const restored = [...words]
  restored.splice(index, 0, { ...deleted.word })
  return { words: restored, index }
}
