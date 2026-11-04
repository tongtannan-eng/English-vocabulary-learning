import { afterEach, describe, expect, it, vi } from 'vitest'
import { moveDeckToTrash, reconcileTrash, restoreDeletedDeck } from './trash.ts'
import { trashDeck, restoreTrash, purgeTrash } from '../../services/trash.ts'
import { createBackup, importBackup, mergeBackup } from '../../services/backup.ts'
import { parseDeckFile } from '../../services/transfer.ts'
import { loadStudyState, saveStudyState, STUDY_STORAGE_KEY } from '../../services/storage.ts'
import { loadAllDrafts, saveEditorDraft } from '../../services/drafts.ts'
import { collectReviewWords, createReviewSession } from '../study/review.ts'
import type { StudyState, ReviewCheckpoint } from '../study/learning.ts'
import type { Deck } from '../../shared/types.ts'

const deck: Deck = {
  id: 'one',
  date: '2026-10-29',
  title: '原词组',
  createdAt: 1,
  updatedAt: 2,
  words: [
    {
      id: 'w',
      english: 'apple',
      chinese: '苹果',
      collocations: ['an apple'],
      notes: '备注',
      reviewStage: 1,
      nextReviewDate: '2026-10-30',
    },
  ],
}
const draft = {
  date: deck.date,
  title: '草稿',
  words: [{ id: 'w', english: 'app', chinese: '', notes: '未完成' }],
  updatedAt: 3,
}
const words = collectReviewWords([deck])
const saved: ReviewCheckpoint = {
  id: 's',
  key: 'deck:one',
  path: '/review/one',
  title: '词组',
  subtitle: '',
  backPath: '/',
  front: 'dictation',
  order: 'random',
  initialWords: words,
  session: createReviewSession(words, 'sequential'),
  flipped: false,
  answer: 'ap',
  result: null,
  firstAttempts: {},
  shownAnswers: [],
  updatedAt: 3,
}
const initial: StudyState = { decks: [deck], records: [], sessions: { [saved.key]: saved } }

describe('reversible deck deletion', () => {
  afterEach(() => vi.unstubAllGlobals())
  it('archives the full card, raw draft and queue without mutating the source', () => {
    const moved = moveDeckToTrash(initial, deck.id, draft, 10)!
    expect(moved.state.decks).toEqual([])
    expect(moved.state.sessions).toEqual({})
    expect(moved.entry).toMatchObject({
      deck,
      draft,
      sessions: { [saved.key]: saved },
      deletedAt: 10,
    })
    expect(initial.decks).toHaveLength(1)
    const restored = restoreDeletedDeck(moved.state, moved.entry.id, 20)!
    expect(restored.deck.words).toEqual(deck.words)
    expect(restored.state.sessions[saved.key]!.answer).toBe('ap')
    expect(restored.state.trash).toEqual([])
  })
  it('restores a copy when an active card already has the original ID', () => {
    const moved = moveDeckToTrash(initial, deck.id, draft, 10)!
    const state = { ...moved.state, decks: [{ ...deck, title: '不要覆盖' }] }
    const restored = restoreDeletedDeck(state, moved.entry.id, 20)!
    expect(restored.copied).toBe(true)
    expect(restored.deck.id).not.toBe(deck.id)
    expect(restored.state.decks[0]!.title).toBe('不要覆盖')
  })
  it('honors deletion tombstones and a newer restoration when merging backups', () => {
    const moved = moveDeckToTrash(initial, deck.id, undefined, 10)!
    expect(mergeBackup(moved.state, { decks: [deck] }, {}).state.decks).toEqual([])
    const imported = mergeBackup(initial, { decks: [], trash: [moved.entry] }, {})
    expect(imported.state.decks).toEqual([])
    const restored = restoreDeletedDeck(moved.state, moved.entry.id, 20)!
    expect(reconcileTrash([restored.deck], [moved.entry]).trash).toEqual([])
  })
  it('stores trash and drafts atomically, restores them, and keeps records when purging', () => {
    const values = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    })
    saveStudyState(initial)
    saveEditorDraft(deck.id, draft)
    const removed = trashDeck(deck.id)
    if ('error' in removed) throw new Error(removed.error)
    expect(loadAllDrafts()[deck.id]).toBeUndefined()
    expect(loadStudyState().trash).toHaveLength(1)
    const restored = restoreTrash(removed.entryId!)
    expect(restored).not.toHaveProperty('error')
    expect(loadAllDrafts()[deck.id]).toEqual(draft)
    const removedAgain = trashDeck(deck.id)
    if ('error' in removedAgain) throw new Error(removedAgain.error)
    expect(purgeTrash(removedAgain.entryId!)).not.toHaveProperty('error')
    expect(loadStudyState().trash).toEqual([])
  })
  it('rolls back draft removal if the learning-state write is refused', () => {
    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    }
    vi.stubGlobal('localStorage', storage)
    saveStudyState(initial)
    saveEditorDraft(deck.id, draft)
    const before = new Map(values)
    vi.stubGlobal('localStorage', {
      ...storage,
      setItem: (key: string, value: string) => {
        if (key === STUDY_STORAGE_KEY) throw new Error('quota')
        storage.setItem(key, value)
      },
    })
    expect(trashDeck(deck.id)).toHaveProperty('error')
    expect(values).toEqual(before)
  })
  it('round-trips a trash-only full backup with its archived draft and progress', () => {
    const local = new Map<string, string>(),
      session = new Map<string, string>()
    const storage = (data: Map<string, string>) => ({
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => data.set(key, value),
      removeItem: (key: string) => data.delete(key),
    })
    vi.stubGlobal('localStorage', storage(local))
    vi.stubGlobal('sessionStorage', storage(session))
    vi.stubGlobal('window', new EventTarget())
    const moved = moveDeckToTrash(initial, deck.id, draft, 10)!
    saveStudyState(moved.state)
    const file = createBackup()
    expect(file.version).toBe(5)
    expect(file.trash?.[0]!.draft).toEqual(draft)
    const parsed = parseDeckFile(JSON.stringify(file))
    if ('error' in parsed) throw new Error(parsed.error)
    local.clear()
    session.clear()
    expect(importBackup(parsed)).not.toHaveProperty('error')
    expect(loadStudyState().trash![0]!.sessions[saved.key]!.answer).toBe('ap')
    expect(
      parseDeckFile(JSON.stringify({ ...file, trash: [{ ...moved.entry, deck: null }] })),
    ).toHaveProperty('error')
  })
})
