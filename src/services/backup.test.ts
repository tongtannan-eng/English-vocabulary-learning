import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createBackup, importBackup, mergeBackup } from './backup.ts'
import { parseDeckFile } from './transfer.ts'
import {
  loadStudyState,
  saveStudyState,
  STUDY_STORAGE_KEY,
  PREFS_KEY,
  SPEECH_KEY,
} from './storage.ts'
import { saveEditorDraft, loadAllDrafts } from './drafts.ts'
import { createReviewSession, collectReviewWords } from '../features/study/review.ts'
import { makeLearningRecord } from '../features/study/learning.ts'
import type { ReviewCheckpoint } from '../features/study/learning.ts'
import {
  defaultDeckListView,
  saveDeckListView,
  loadDeckListView,
  invalidateDeckListView,
  LIST_VIEW_KEY,
} from '../features/decks/deckList.ts'
import { UI_PREFERENCES_KEY } from './preferences.ts'
import type { Deck } from '../shared/types.ts'
import type { BackupFile, ParsedDeckFile } from './backupTypes.ts'

const deck: Deck = {
  id: 'today',
  title: '全部备份验收',
  date: '2026-10-29',
  createdAt: 1,
  updatedAt: 2,
  words: [
    {
      id: 'apple',
      english: 'apple',
      chinese: '苹果',
      collocations: ['an apple', 'apple juice'],
      notes: '备注',
      nextReviewDate: '2026-10-30',
      reviewStage: 1,
      scheduledOn: '2026-10-29',
    },
    { id: 'bank', english: 'bank', chinese: '河岸' },
  ],
}
function checkpoint(): ReviewCheckpoint {
  const words = collectReviewWords([deck]).reverse()
  return {
    id: 'session',
    key: 'deck:today',
    path: '/review/today',
    title: '全部备份验收',
    subtitle: '',
    backPath: '/',
    front: 'dictation',
    order: 'random',
    session: createReviewSession(words, 'sequential'),
    initialWords: words,
    flipped: false,
    answer: 'ba',
    result: null,
    firstAttempts: {},
    shownAnswers: [],
    updatedAt: 10,
  }
}
function parse(file: unknown): ParsedDeckFile {
  const parsed = parseDeckFile(JSON.stringify(file))
  if ('error' in parsed) throw new Error(parsed.error)
  return parsed
}
function memoryStorage(values: Map<string, string>): Storage {
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value)
    },
    removeItem: (key: string) => {
      values.delete(key)
    },
  } as Storage
}

describe('complete backup import/export', () => {
  let local: Map<string, string>
  let session: Map<string, string>
  beforeEach(() => {
    local = new Map()
    session = new Map()
    vi.stubGlobal('localStorage', memoryStorage(local))
    vi.stubGlobal('sessionStorage', memoryStorage(session))
    vi.stubGlobal('window', new EventTarget())
    invalidateDeckListView()
  })
  afterEach(() => {
    invalidateDeckListView()
    vi.unstubAllGlobals()
  })

  function populate(): BackupFile {
    const saved = checkpoint()
    const record = makeLearningRecord(saved, saved.initialWords[0]!, 'spelling', {
      answer: 'bak',
      correct: false,
      assisted: false,
    })
    saveStudyState({ decks: [deck], records: [record], sessions: { [saved.key]: saved } })
    saveEditorDraft('new', {
      date: deck.date,
      title: '未完成',
      words: [
        { id: 'draft', english: 'pear', chinese: '', collocations: 'one\ntwo', notes: '未填完' },
      ],
      updatedAt: 12,
    })
    saveEditorDraft(deck.id, {
      date: deck.date,
      title: deck.title,
      words: [{ id: 'edit', english: 'bank', chinese: '银行' }],
      deletedWords: [
        {
          word: {
            id: 'removed',
            english: 'rope',
            chinese: '',
            collocations: 'a rope',
            notes: '删除后待撤销',
          },
          index: 1,
          beforeId: 'edit',
        },
      ],
      updatedAt: 11,
    })
    local.set('english-daily-theme', 'vivid')
    local.set(SPEECH_KEY, 'en-AU')
    local.set(PREFS_KEY, JSON.stringify({ front: 'dictation', order: 'random' }))
    local.set(UI_PREFERENCES_KEY, JSON.stringify({ collapsedPanels: ['weekly', 'search'] }))
    saveDeckListView({
      ...defaultDeckListView(),
      query: 'apple',
      page: 2,
      expandedDeckIds: ['today'],
      collapsedMonths: ['2026-09'],
      scrollY: 432,
    })
    return createBackup()
  }

  it('round-trips all persisted data to an empty browser, including raw drafts and actual random queues', () => {
    const file = populate()
    const parsed = parse(file)
    local.clear()
    session.clear()
    invalidateDeckListView()
    const imported = importBackup(parsed)
    expect(imported).not.toHaveProperty('error')
    expect(createBackup()).toEqual({ ...file, exportedAt: expect.any(String) })
    expect(loadStudyState().sessions['deck:today']!.answer).toBe('ba')
    expect(loadAllDrafts().new!.words[0]!.chinese).toBe('')
    expect(loadDeckListView().scrollY).toBe(432)
    expect(local.get('english-daily-theme')).toBe('vivid')
  })

  it('keeps newer local cards, drafts and queues, and importing the same file is idempotent', () => {
    const file = populate()
    const latest = { ...checkpoint(), answer: 'bank', updatedAt: 50 }
    saveStudyState({
      ...loadStudyState(),
      decks: [{ ...deck, title: '较新正文', updatedAt: 50 }],
      sessions: { [latest.key]: latest },
    })
    saveEditorDraft('new', { ...loadAllDrafts().new!, title: '较新草稿', updatedAt: 50 })
    const imported = importBackup(parse(file))
    expect(imported).not.toHaveProperty('error')
    expect(loadStudyState().decks[0]!.title).toBe('较新正文')
    expect(loadStudyState().sessions[latest.key]!.answer).toBe('bank')
    expect(loadAllDrafts().new!.title).toBe('较新草稿')
    importBackup(parse(file))
    expect(loadStudyState().records).toHaveLength(1)
    expect(loadStudyState().decks).toHaveLength(1)
  })

  it('supports an empty full backup and old v1/v2 files without resetting unrelated settings', () => {
    const empty = createBackup()
    expect(parse(empty).preferences).toBeDefined()
    expect(importBackup(parse(empty))).not.toHaveProperty('error')
    local.set('english-daily-theme', 'vivid')
    const legacy = parse({ kind: 'english-daily-decks', version: 1, decks: [deck] })
    expect(importBackup(legacy)).not.toHaveProperty('error')
    expect(local.get('english-daily-theme')).toBe('vivid')
    expect(parse({ kind: 'english-daily-decks', version: 2, decks: [deck], records: [] })).toEqual({
      decks: [deck],
      records: [],
    })
  })

  it('scopes a single-card export to its own records, drafts and complete queues without global settings', () => {
    populate()
    const file = createBackup([deck.id])
    expect(file.scope).toBe('decks')
    expect(file.preferences).toBeUndefined()
    expect(Object.keys(file.drafts)).toEqual([deck.id])
    expect(parse(file)).not.toHaveProperty('error')
    expect(
      parseDeckFile(JSON.stringify({ ...file, drafts: { new: loadAllDrafts().new } })),
    ).toHaveProperty('error')
  })

  it('rejects corrupt progress or preferences before writing anything', () => {
    const file = populate()
    const before = new Map(local)
    for (const changed of [
      { ...file, sessions: { bad: checkpoint() } },
      { ...file, preferences: { ...file.preferences, theme: 'pink' } },
      {
        ...file,
        preferences: { ...file.preferences, listView: { ...defaultDeckListView(), page: -5 } },
      },
      { ...file, drafts: { new: { ...loadAllDrafts().new, words: [{ english: 'missing-id' }] } } },
    ])
      expect(parseDeckFile(JSON.stringify(changed))).toHaveProperty('error')
    expect(local).toEqual(before)
  })

  it('rolls back successful preference and draft writes if the final learning-state write fails', () => {
    const file = populate()
    local.set('english-daily-theme', 'classic')
    session.set(LIST_VIEW_KEY, JSON.stringify(defaultDeckListView()))
    const beforeLocal = new Map(local),
      beforeSession = new Map(session)
    const storage = memoryStorage(local)
    vi.stubGlobal('localStorage', {
      ...storage,
      setItem: (key: string, value: string) => {
        if (key === STUDY_STORAGE_KEY) throw new Error('quota')
        storage.setItem(key, value)
      },
    })
    expect(importBackup(parse(file))).toHaveProperty('error')
    expect(local).toEqual(beforeLocal)
    expect(session).toEqual(beforeSession)
  })

  it('rolls back local writes if sessionStorage refuses the restored page state', () => {
    const file = populate()
    local.set('english-daily-theme', 'classic')
    const before = new Map(local)
    vi.stubGlobal('sessionStorage', {
      ...memoryStorage(session),
      setItem: () => {
        throw new Error('blocked')
      },
    })
    expect(importBackup(parse(file))).toHaveProperty('error')
    expect(local).toEqual(before)
  })

  it('prunes incompatible resumed queues when a newer local word has changed', () => {
    const file = populate()
    const current = {
      decks: [
        {
          ...deck,
          updatedAt: 50,
          words: deck.words.map((word) => ({ ...word, chinese: '已修改' })),
        },
      ],
      records: [],
      sessions: {},
    }
    expect(mergeBackup(current, parse(file), {}).state.sessions).toEqual({})
  })
})
