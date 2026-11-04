import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { parseHash } from '../../app/router.ts'
import { createBackup, importBackup } from '../../services/backup.ts'
import { backupSnapshot, compareBackup } from '../../services/backupStatus.ts'
import { loadStudyState, saveStudyState } from '../../services/storage.ts'
import { parseDeckFile } from '../../services/transfer.ts'
import { addPhrase } from './phrases.ts'
import type { Phrase } from '../../shared/types.ts'

const phrase: Phrase = {
  id: 'p1',
  english: 'look forward to',
  chinese: '期待',
  createdAt: 2,
  updatedAt: 2,
}

describe('phrase table', () => {
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

  it('keeps phrases in one table and out of daily cards', () => {
    expect(parseHash('#/phrases')).toEqual({ name: 'phrases' })
    const added = addPhrase([], '  look forward to  ', ' 期待 ', 2)
    expect(added?.[0]).toMatchObject({
      english: 'look forward to',
      chinese: '期待',
      createdAt: 2,
      updatedAt: 2,
    })
    expect(addPhrase([], '   ', '')).toBeNull()
  })

  it('round-trips phrases in a full backup and keeps local phrases for older files', () => {
    saveStudyState({ decks: [], records: [], sessions: {}, phrases: [phrase] })
    const file = createBackup()
    expect(file.phrases).toEqual([phrase])
    expect(file.sentences).toEqual([])
    saveStudyState({ decks: [], records: [], sessions: {}, phrases: [] })
    const parsed = parseDeckFile(JSON.stringify(file))
    if ('error' in parsed) throw new Error(parsed.error)
    expect(importBackup(parsed)).not.toHaveProperty('error')
    expect(loadStudyState().phrases).toEqual([phrase])
    const legacy = { ...file }
    delete legacy.phrases
    saveStudyState({
      decks: [],
      records: [],
      sessions: {},
      phrases: [{ ...phrase, english: 'local phrase' }],
    })
    const old = parseDeckFile(JSON.stringify(legacy))
    if ('error' in old) throw new Error(old.error)
    importBackup(old)
    expect(loadStudyState().phrases?.[0]?.english).toBe('local phrase')
    expect(
      parseDeckFile(JSON.stringify({ ...file, phrases: [{ english: 'missing id' }] })),
    ).toHaveProperty('error')
    expect(
      parseDeckFile(JSON.stringify({ ...createBackup(['none']), phrases: [phrase] })),
    ).toHaveProperty('error')
    const before = backupSnapshot(createBackup())
    saveStudyState({ ...loadStudyState(), phrases: [phrase] })
    expect(compareBackup(before, backupSnapshot(createBackup())).pending).toBe(true)
  })
})
