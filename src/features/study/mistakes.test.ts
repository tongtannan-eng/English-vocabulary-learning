import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { applyReviewRating, isCheckpoint, makeLearningRecord } from './learning.ts'
import type { StudyState, ReviewCheckpoint } from './learning.ts'
import { collectReviewWords, createReviewSession } from './review.ts'
import { historicalMistakes, historicalReviewWords, mergeMistakes } from './mistakes.ts'
import { loadStudyState, saveStudyState, STUDY_STORAGE_KEY } from '../../services/storage.ts'
import { createBackup, importBackup, mergeBackup } from '../../services/backup.ts'
import { parseDeckFile } from '../../services/transfer.ts'
import { backupSnapshot, compareBackup, isBackupStatus } from '../../services/backupStatus.ts'
import { trashDeck, purgeTrash } from '../../services/trash.ts'
import type { Deck } from '../../shared/types.ts'

const deck: Deck = {
  id: 'd',
  title: '历史错题测试',
  date: '2026-10-29',
  createdAt: 1,
  updatedAt: 1,
  words: [{ id: 'w', english: 'apple', chinese: '苹果' }],
}
const word = collectReviewWords([deck])[0]!
const initial = (): StudyState => ({ decks: structuredClone([deck]), records: [], sessions: {} })
function checkpoint(): ReviewCheckpoint {
  return {
    id: 's',
    key: 'mistakes',
    path: '/review-mistakes',
    title: '历史错题复习',
    subtitle: '',
    backPath: '/mistakes',
    front: 'english',
    order: 'sequential',
    session: createReviewSession([word], 'sequential'),
    initialWords: [word],
    answer: '',
    result: null,
    flipped: true,
    firstAttempts: {},
    shownAnswers: [],
    updatedAt: 1,
  }
}
describe('permanent historical mistake collection', () => {
  let values: Map<string, string>
  beforeEach(() => {
    values = new Map()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value)
      },
      removeItem: (key: string) => {
        values.delete(key)
      },
    })
    vi.stubGlobal('sessionStorage', {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    })
    vi.stubGlobal('window', new EventTarget())
  })
  afterEach(() => vi.unstubAllGlobals())
  it('records unknown words once and retains them after marking known and reloading', () => {
    const unknown = applyReviewRating(initial(), word, 'unknown', undefined, 100)!
    const known = applyReviewRating(unknown, word, 'known', undefined, 200)!
    expect(saveStudyState(known)).toBe(true)
    const restored = loadStudyState()
    expect(restored.records).toEqual([])
    expect(historicalMistakes(restored)).toMatchObject([
      { english: 'apple', status: 'known', lastUnknownAt: 100 },
    ])
    const again = applyReviewRating(restored, word, 'unknown', undefined, 300)!
    expect(again.mistakes).toHaveLength(1)
    expect(historicalMistakes(again)).toMatchObject([{ status: 'unknown', lastUnknownAt: 300 }])
  })
  it('captures a later unknown even when the first immutable answer was known', () => {
    const saved = checkpoint()
    const known = applyReviewRating(initial(), word, 'known', { before: saved, after: null }, 100)!
    const unknown = applyReviewRating(known, word, 'unknown', { before: saved, after: null }, 200)!
    expect(unknown.records).toHaveLength(1)
    expect(unknown.records[0]!.rating).toBe('known')
    expect(historicalMistakes(unknown)).toMatchObject([{ status: 'unknown', lastUnknownAt: 200 }])
  })
  it('recovers existing unknown records even if the word is already known or deleted', () => {
    const record = makeLearningRecord(checkpoint(), word, 'recognition', 'unknown', 100)
    expect(historicalMistakes({ ...initial(), decks: [], records: [record] })).toMatchObject([
      { english: 'apple', status: 'unavailable' },
    ])
    const state = initial()
    state.decks[0]!.words[0]!.familiarity = 'known'
    state.records = [record]
    expect(historicalMistakes(state)[0]!.status).toBe('known')
    values.set(
      STUDY_STORAGE_KEY,
      JSON.stringify([{ ...deck, words: [{ ...deck.words[0]!, familiarity: 'unknown' }] }]),
    )
    const legacy = loadStudyState()
    expect(legacy.mistakes).toHaveLength(1)
    expect(legacy.mistakes![0]!.lastUnknownAt).toBeUndefined()
    expect(legacy.records).toEqual([])
  })
  it('groups identical terms across cards, retains different meanings, and reviews current words only', () => {
    const state = initial()
    state.decks[0]!.words[0]!.familiarity = 'unknown'
    state.decks.push({
      ...deck,
      id: 'second',
      words: [
        { ...deck.words[0]!, english: ' APPLE ', familiarity: 'unknown' },
        { id: 'company', english: 'apple', chinese: '苹果公司', familiarity: 'unknown' },
      ],
    })
    const groups = historicalMistakes(state)
    expect(groups).toHaveLength(2)
    expect(groups.find((entry) => entry.chinese === '苹果')!.sources).toHaveLength(2)
    expect(historicalReviewWords(state)).toHaveLength(2)
  })
  it('keeps the historical snapshot when a word is edited, deleted, or its card is purged', () => {
    const unknown = applyReviewRating(initial(), word, 'unknown', undefined, 100)!
    const changed = {
      ...unknown,
      decks: [{ ...deck, words: [{ ...deck.words[0]!, english: 'pear', chinese: '梨' }] }],
    }
    expect(historicalMistakes(changed)).toMatchObject([
      { english: 'apple', chinese: '苹果', status: 'unavailable' },
    ])
    expect(historicalReviewWords(changed)).toEqual([])
    saveStudyState(unknown)
    const removed = trashDeck('d')
    if ('error' in removed) throw new Error(removed.error)
    expect(purgeTrash(removed.entryId!)).not.toHaveProperty('error')
    expect(historicalMistakes(loadStudyState())).toMatchObject([
      { english: 'apple', status: 'unavailable' },
    ])
  })
  it('round-trips a history-only v5 backup, deduplicates import and accepts v4 without history', () => {
    saveStudyState({
      ...initial(),
      decks: [],
      mistakes: [
        {
          deckId: 'removed',
          wordId: 'w',
          deckDate: deck.date,
          deckTitle: '',
          english: 'apple',
          chinese: '苹果',
          lastUnknownAt: 100,
        },
      ],
    })
    const file = createBackup()
    expect(file.version).toBe(5)
    const parsed = parseDeckFile(JSON.stringify(file))
    if ('error' in parsed) throw new Error(parsed.error)
    values.clear()
    expect(importBackup(parsed)).not.toHaveProperty('error')
    expect(importBackup(parsed)).not.toHaveProperty('error')
    expect(loadStudyState().mistakes).toHaveLength(1)
    const { mistakes: _history, ...legacy } = file
    expect(parseDeckFile(JSON.stringify({ ...legacy, version: 4 }))).not.toHaveProperty('error')
    expect(mergeBackup(loadStudyState(), { decks: [] }, {}).state.mistakes).toHaveLength(1)
  })
  it('scopes exported history and rejects malformed or foreign history before import', () => {
    saveStudyState(applyReviewRating(initial(), word, 'unknown', undefined, 100)!)
    const file = createBackup(['d'])
    expect(file.mistakes).toHaveLength(1)
    expect(file.preferences).toBeUndefined()
    expect(parseDeckFile(JSON.stringify(file))).not.toHaveProperty('error')
    for (const mistakes of [
      undefined,
      [{ ...file.mistakes[0]!, lastUnknownAt: 'wrong' }],
      [{ ...file.mistakes[0]!, deckId: 'foreign' }],
    ])
      expect(parseDeckFile(JSON.stringify({ ...file, mistakes }))).toHaveProperty('error')
  })
  it('does not commit a new history entry if storage fails and detects history-only backup changes', () => {
    saveStudyState(initial())
    const before = createBackup()
    const next = applyReviewRating(initial(), word, 'unknown', undefined, 100)!
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: () => {
        throw new Error('quota')
      },
    })
    expect(saveStudyState(next)).toBe(false)
    expect(loadStudyState().mistakes).toBeUndefined()
    const after = { ...before, mistakes: next.mistakes! }
    expect(compareBackup(backupSnapshot(before), backupSnapshot(after)).pending).toBe(true)
    const { mistakes: _history, ...legacySnapshot } = backupSnapshot(before)
    expect(
      isBackupStatus({ origin: 'local', exportedAt: before.exportedAt, snapshot: legacySnapshot }),
    ).toBe(true)
    expect(mergeMistakes(next.mistakes!, next.mistakes!)).toHaveLength(1)
    expect(isCheckpoint(checkpoint())).toBe(true)
  })
})
