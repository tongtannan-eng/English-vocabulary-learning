import { pruneCheckpoints } from '../study/learning.ts'
import type { StudyState } from '../study/learning.ts'
import type { TrashEntry } from '../../services/trashTypes.ts'
import type { EditorDraft } from '../../services/drafts.ts'

export function moveDeckToTrash(
  state: StudyState,
  id: string,
  draft?: EditorDraft,
  now = Date.now(),
) {
  const deck = state.decks.find((item) => item.id === id)
  if (!deck) return null
  const entry: TrashEntry = {
    id: crypto.randomUUID(),
    deck,
    deletedAt: Math.max(now, deck.updatedAt),
    sessions: Object.fromEntries(
      Object.entries(state.sessions).filter(([, saved]) =>
        saved.initialWords.some((word) => word.deckId === id),
      ),
    ),
    ...(draft ? { draft } : {}),
  }
  return {
    entry,
    state: pruneCheckpoints({
      ...state,
      decks: state.decks.filter((item) => item.id !== id),
      trash: [entry, ...(state.trash ?? []).filter((item) => item.deck.id !== id)],
    }),
  }
}

export function restoreDeletedDeck(state: StudyState, id: string, now = Date.now()) {
  const entry = state.trash?.find((item) => item.id === id)
  if (!entry) return null
  const copied = state.decks.some((deck) => deck.id === entry.deck.id)
  const deck = {
    ...entry.deck,
    id: copied ? crypto.randomUUID() : entry.deck.id,
    updatedAt: Math.max(now, entry.deletedAt + 1),
    ...(copied
      ? {
          title: entry.deck.title ? `${entry.deck.title}（恢复副本）` : '恢复的单词卡',
          createdAt: now,
        }
      : {}),
  }
  const sessions = { ...state.sessions }
  if (!copied)
    for (const [key, saved] of Object.entries(entry.sessions)) {
      if (!sessions[key] || saved.updatedAt > sessions[key].updatedAt) sessions[key] = saved
    }
  return {
    entry,
    deck,
    copied,
    state: pruneCheckpoints({
      ...state,
      decks: [...state.decks, deck],
      sessions,
      trash: state.trash!.filter((item) => item.id !== id),
    }),
  }
}

// Deletion timestamps act as tombstones, so an older backup cannot silently resurrect a card.
export function reconcileTrash(decks: StudyState['decks'], ...sources: (readonly TrashEntry[])[]) {
  const byDeck = new Map<string, TrashEntry>()
  for (const entry of sources.flat()) {
    const current = byDeck.get(entry.deck.id)
    if (!current || entry.deletedAt > current.deletedAt)
      byDeck.set(entry.deck.id, { ...entry, sessions: { ...entry.sessions } })
  }
  const active = decks.filter((deck) => {
    const removed = byDeck.get(deck.id)
    if (!removed) return true
    if (deck.updatedAt > removed.deletedAt) {
      byDeck.delete(deck.id)
      return true
    }
    return false
  })
  return { decks: active, trash: [...byDeck.values()].sort((a, b) => b.deletedAt - a.deletedAt) }
}
