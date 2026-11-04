import { describe, expect, it } from 'vitest'
import { backupSnapshot, compareBackup, isBackupStatus } from './backupStatus.ts'
import { defaultDeckListView } from '../features/decks/deckList.ts'
import type { BackupFile } from './backupTypes.ts'

const file: BackupFile = {
  kind: 'english-daily-decks',
  version: 5,
  scope: 'full',
  exportedAt: '2026-10-29T00:00:00Z',
  decks: [
    {
      id: 'd',
      title: '',
      date: '2026-10-29',
      createdAt: 1,
      updatedAt: 2,
      words: [{ id: 'w', english: 'apple', chinese: '苹果' }],
    },
  ],
  mistakes: [],
  records: [],
  sessions: {},
  drafts: {},
  trash: [],
  preferences: {
    theme: 'classic',
    speechAccent: 'en-US',
    review: { front: 'english', order: 'sequential' },
    ui: { collapsedPanels: ['today'] },
    listView: defaultDeckListView(),
  },
}
describe('truthful backup status', () => {
  it('counts new, edited and removed rows separately from new immutable records', () => {
    const before = backupSnapshot(file)
    const changed = structuredClone(file)
    changed.decks[0]!.words[0]!.chinese = '苹果公司'
    changed.decks[0]!.words.push({ id: 'new', english: 'bank', chinese: '银行' })
    changed.records.push({
      id: 'new-record',
      sessionId: 's',
      deckId: 'd',
      wordId: 'w',
      english: 'apple',
      chinese: '苹果',
      mode: 'english',
      kind: 'recognition',
      round: 'initial',
      rating: 'known',
      at: 1,
      day: '2026-10-29',
    })
    const delta = compareBackup(before, backupSnapshot(changed))
    expect(delta).toMatchObject({
      addedWords: 1,
      editedWords: 1,
      removedWords: 0,
      newRecords: 1,
      pending: true,
    })
    expect(compareBackup(before, backupSnapshot({ ...file, decks: [] })).removedWords).toBe(1)
  })
  it('does not warn merely for navigation, scroll, or a persistence timestamp refresh', () => {
    const changed = structuredClone(file)
    changed.decks[0]!.updatedAt = 1000
    changed.preferences!.listView = {
      ...defaultDeckListView(),
      query: 'apple',
      page: 4,
      scrollY: 500,
    }
    expect(compareBackup(backupSnapshot(file), backupSnapshot(changed)).pending).toBe(false)
  })
  it('detects draft text, resume input, trash, and meaningful settings changes', () => {
    const changed = structuredClone(file)
    changed.drafts.new = {
      date: '2026-10-29',
      title: '',
      words: [{ id: 'x', english: 'app', chinese: '' }],
      updatedAt: 3,
    }
    expect(compareBackup(backupSnapshot(file), backupSnapshot(changed)).pending).toBe(true)
    changed.preferences!.theme = 'vivid'
    expect(backupSnapshot(changed).preferences).not.toBe(backupSnapshot(file).preferences)
  })
  it('validates imported status metadata and never treats a corrupt timestamp as a backup', () => {
    const status = { exportedAt: file.exportedAt, origin: 'local', snapshot: backupSnapshot(file) }
    expect(isBackupStatus(status)).toBe(true)
    expect(isBackupStatus({ ...status, exportedAt: 'broken' })).toBe(false)
    expect(
      isBackupStatus({ ...status, snapshot: { ...status.snapshot, words: ['wrong shape'] } }),
    ).toBe(false)
    expect(compareBackup(status.snapshot, backupSnapshot(file)).pending).toBe(false)
  })
})
