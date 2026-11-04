import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { parseHash } from '../../app/router.ts'
import { createBackup, importBackup } from '../../services/backup.ts'
import { backupSnapshot, compareBackup } from '../../services/backupStatus.ts'
import { loadStudyState, saveStudyState } from '../../services/storage.ts'
import { parseDeckFile } from '../../services/transfer.ts'
import { addSentence, mergeSentences, removeSentence, updateSentence } from './sentences.ts'
import type { Sentence } from '../../shared/types.ts'

const sentence: Sentence = {
  id: 's1',
  english: 'I like apples.',
  chinese: '我喜欢苹果。',
  createdAt: 2,
  updatedAt: 2,
}

describe('sentence table', () => {
  it('keeps every sentence in one list and rejects a blank English sentence', () => {
    expect(parseHash('#/sentences')).toEqual({ name: 'sentences' })
    const added = addSentence([], '  I like apples.  ', ' 我喜欢苹果。 ', 2)
    expect(added?.[0]).toMatchObject({
      english: 'I like apples.',
      chinese: '我喜欢苹果。',
      createdAt: 2,
      updatedAt: 2,
    })
    expect(addSentence([], '   ', '')).toBeNull()
    const edited = updateSentence(
      added!,
      added![0]!.id,
      'I like green apples.',
      '我喜欢青苹果。',
      5,
    )
    expect(edited?.[0]).toMatchObject({
      id: added![0]!.id,
      english: 'I like green apples.',
      createdAt: 2,
      updatedAt: 5,
    })
    expect(updateSentence(added!, 'missing', 'Hello.', '')).toBeNull()
    expect(removeSentence(edited!, added![0]!.id)).toEqual([])
  })

  it('merges by id, keeps the newer copy, and leaves local sentences when a backup has none', () => {
    const older = { ...sentence, english: 'old', updatedAt: 1 }
    const newer = { ...sentence, english: 'new', updatedAt: 3 }
    expect(mergeSentences([older], [newer])).toEqual([newer])
    expect(mergeSentences([newer], [older])).toEqual([newer])
    expect(mergeSentences([sentence], undefined)).toEqual([sentence])
  })
})

describe('sentence backup', () => {
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

  it('round-trips the table in a full backup and keeps local sentences for older files', () => {
    saveStudyState({ decks: [], records: [], sessions: {}, sentences: [sentence] })
    const file = createBackup()
    expect(file.sentences).toEqual([sentence])
    saveStudyState({ decks: [], records: [], sessions: {}, sentences: [] })
    const parsed = parseDeckFile(JSON.stringify(file))
    if ('error' in parsed) throw new Error(parsed.error)
    expect(importBackup(parsed)).not.toHaveProperty('error')
    expect(loadStudyState().sentences).toEqual([sentence])
    const legacy = { ...file }
    delete legacy.sentences
    saveStudyState({
      decks: [],
      records: [],
      sessions: {},
      sentences: [{ ...sentence, english: 'local' }],
    })
    const old = parseDeckFile(JSON.stringify(legacy))
    if ('error' in old) throw new Error(old.error)
    importBackup(old)
    expect(loadStudyState().sentences?.[0]?.english).toBe('local')
    expect(
      parseDeckFile(JSON.stringify({ ...file, sentences: [{ english: 'missing id' }] })),
    ).toHaveProperty('error')
    expect(
      parseDeckFile(JSON.stringify({ ...createBackup(['none']), sentences: [sentence] })),
    ).toHaveProperty('error')
    const before = backupSnapshot(createBackup())
    saveStudyState({ ...loadStudyState(), sentences: [sentence] })
    expect(compareBackup(before, backupSnapshot(createBackup())).pending).toBe(true)
  })
})
