import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  appendLearningRecord,
  applyReviewRating,
  attemptKey,
  getTodayWords,
  hydrateCheckpoint,
  isCheckpoint,
  learningSummary,
  makeLearningRecord,
  mergeLearningRecords,
  scheduleWord,
  withCheckpoint,
} from './learning.ts'
import type { ReviewCheckpoint, StudyState } from './learning.ts'
import { collectReviewWords, createReviewSession, rateReview } from './review.ts'
import { addDays, toISODate } from '../../shared/utils/format.ts'
import { loadStudyState, saveStudyState } from '../../services/storage.ts'
import { parseDeckFile } from '../../services/transfer.ts'
import { findDuplicates } from '../decks/duplicates.ts'
import { isEditorDraft, loadEditorDraft, saveEditorDraft } from '../../services/drafts.ts'
import { parseHash } from '../../app/router.ts'
import type { Deck, Word } from '../../shared/types.ts'

const today = '2026-10-29'
const now = new Date(2026, 9, 29, 12).getTime()
const baseWord: Word = { id: 'apple', english: 'apple', chinese: '苹果' }
const deck: Deck = {
  id: 'day',
  date: today,
  title: '',
  words: [baseWord, { id: 'book', english: 'book', chinese: '书' }],
  createdAt: 1,
  updatedAt: 1,
}

function checkpoint(front: ReviewCheckpoint['front'] = 'english'): ReviewCheckpoint {
  const words = collectReviewWords([deck])
  return {
    id: 'session',
    key: 'deck:day',
    path: '/review/day',
    title: '今日单词',
    subtitle: '',
    backPath: '/',
    front,
    order: 'sequential',
    session: createReviewSession(words, 'sequential'),
    initialWords: words,
    flipped: false,
    answer: '',
    result: null,
    firstAttempts: {},
    shownAnswers: [],
    updatedAt: now,
  }
}

describe('spaced review and daily tasks', () => {
  it('advances across days, never accelerates on same-day repetitions, and resets after forgetting', () => {
    const first = scheduleWord(baseWord, 'known', true, now)
    expect(first.reviewStage).toBe(1)
    expect(first.nextReviewDate).toBe('2026-10-30')
    expect(scheduleWord(first, 'known', true, now + 1000).reviewStage).toBe(1)
    const second = scheduleWord(first, 'known', true, new Date(2026, 9, 30, 12).getTime())
    expect(second.reviewStage).toBe(2)
    expect(second.nextReviewDate).toBe('2026-11-02')
    const forgotten = scheduleWord(second, 'unknown', false, new Date(2026, 9, 30, 13).getTime())
    expect(forgotten.reviewStage).toBe(0)
    expect(forgotten.nextReviewDate).toBe('2026-10-31')
    expect(
      scheduleWord(forgotten, 'known', true, new Date(2026, 9, 30, 14).getTime()).nextReviewDate,
    ).toBe('2026-10-31')
  })

  it('caps at 60 days and treats a failed spelling conservatively even when self-rated known', () => {
    const advanced = scheduleWord(
      { ...baseWord, reviewStage: 6, scheduledOn: '2026-10-28' },
      'known',
      true,
      now,
    )
    expect(advanced.reviewStage).toBe(6)
    expect(advanced.nextReviewDate).toBe(addDays(today, 60))
    const failed = scheduleWord(advanced, 'known', false, now)
    expect(failed.familiarity).toBe('known')
    expect(failed.nextReviewDate).toBe('2026-10-30')
    expect(failed.reviewStage).toBe(0)
  })

  it('includes due and overdue words, then new words; excludes future decks and future reviews', () => {
    const source: Deck = {
      ...deck,
      words: [
        { ...baseWord, nextReviewDate: '2026-10-28' },
        { id: 'today', english: 'cat', chinese: '猫', nextReviewDate: today },
        { id: 'future', english: 'dog', chinese: '狗', nextReviewDate: '2026-10-30' },
        { id: 'new', english: 'pear', chinese: '梨' },
      ],
    }
    const tasks = getTodayWords([source, { ...deck, id: 'tomorrow', date: '2026-10-30' }], today)
    expect(tasks.words.map((word) => word.id)).toEqual(['apple', 'today', 'new'])
    expect(tasks.overdue).toHaveLength(1)
    expect(tasks.due).toHaveLength(2)
    expect(tasks.fresh).toHaveLength(1)
  })

  it('uses old review timestamps without inventing historical learning records', () => {
    const old = {
      ...deck,
      words: [
        {
          ...baseWord,
          familiarity: 'known' as const,
          reviewedAt: new Date(2026, 9, 28, 12).getTime(),
        },
      ],
    }
    expect(getTodayWords([old], today).due).toHaveLength(1)
    expect(learningSummary([], today).words).toBe(0)
    expect(parseHash('#/review-today/2026-10-28')).toEqual({
      name: 'review-today',
      date: '2026-10-28',
    })
  })
})

describe('honest learning records', () => {
  it('deduplicates an answer when a resumed queue or repeated click submits it again', () => {
    const saved = checkpoint()
    const record = makeLearningRecord(saved, saved.initialWords[0]!, 'recognition', 'unknown', now)
    expect(appendLearningRecord([record], { ...record, rating: 'known' })).toEqual([record])
    expect(mergeLearningRecords([record], [record])).toEqual([record])
  })

  it('counts each word meaning once across decks and keeps the first result across sessions', () => {
    const saved = checkpoint('chinese')
    const word = saved.initialWords[0]!
    const wrong = makeLearningRecord(
      saved,
      word,
      'spelling',
      { answer: 'aple', correct: false, assisted: false },
      now,
    )
    const later = makeLearningRecord(
      { ...saved, id: 'later' },
      { ...word, deckId: 'another-day' },
      'spelling',
      { answer: 'apple', correct: true, assisted: false },
      now + 1000,
    )
    const result = learningSummary([wrong, later], today)
    expect(result.words).toBe(1)
    expect(result.spellingTotal).toBe(1)
    expect(result.spellingCorrect).toBe(0)
    expect(learningSummary([wrong, { ...later, chinese: '苹果公司' }], today).words).toBe(2)
  })

  it('separates dictation and spelling and excludes answers seen or retried from first accuracy', () => {
    const spelling = checkpoint('chinese')
    const dictation = checkpoint('dictation')
    const word = spelling.initialWords[0]!
    const records = [
      makeLearningRecord(
        spelling,
        word,
        'spelling',
        { answer: 'apple', correct: true, assisted: false },
        now,
      ),
      makeLearningRecord(
        dictation,
        word,
        'spelling',
        { answer: 'apple', correct: true, assisted: true },
        now + 1,
      ),
      makeLearningRecord(
        { ...dictation, id: 'retry', session: { ...dictation.session, phase: 'retry' } },
        word,
        'spelling',
        { answer: 'apple', correct: true, assisted: false },
        now + 2,
      ),
    ]
    const result = learningSummary(records, today)
    expect(result.words).toBe(1)
    expect(result.spellingCorrect).toBe(1)
    expect(result.dictationTotal).toBe(0)
    expect(result.assisted).toBe(1)
  })

  it('keeps recognition self-assessment distinct from spelling correctness', () => {
    const saved = checkpoint('chinese')
    const word = saved.initialWords[0]!
    const result = learningSummary(
      [
        makeLearningRecord(
          saved,
          word,
          'spelling',
          { answer: 'aple', correct: false, assisted: false },
          now,
        ),
        makeLearningRecord(saved, word, 'recognition', 'known', now + 1),
      ],
      today,
    )
    expect(result.known).toBe(1)
    expect(result.spellingCorrect).toBe(0)
    expect(result.words).toBe(1)
  })
})

describe('queue continuation and atomic learning state', () => {
  it('saves rating, record, schedule and next cursor together without mutating the previous state', () => {
    const before = checkpoint('chinese')
    const word = before.initialWords[0]!
    before.firstAttempts[attemptKey(before, word)] = {
      answer: 'aple',
      correct: false,
      assisted: false,
    }
    const after = { ...before, session: rateReview(before.session, 'known') }
    const initial: StudyState = { decks: [deck], records: [], sessions: {} }
    const next = applyReviewRating(initial, word, 'known', { before, after }, now)!
    expect(next.sessions[before.key]!.session.cursor).toBe(1)
    expect(next.records).toHaveLength(1)
    expect(next.decks[0]!.words[0]!.nextReviewDate).toBe('2026-10-30')
    expect(next.decks[0]!.words[0]!.reviewStage).toBe(0)
    expect(initial.records).toHaveLength(0)
    expect(initial.decks[0]!.words[0]!.reviewedAt).toBeUndefined()
    const repeated = applyReviewRating(next, word, 'known', { before, after }, now + 1)!
    expect(repeated.records).toHaveLength(1)
  })

  it('does not count a manual vocabulary-book change as a recall test', () => {
    const next = applyReviewRating(
      { decks: [deck], records: [], sessions: {} },
      collectReviewWords([deck])[0]!,
      'known',
      undefined,
      now,
    )!
    expect(next.records).toHaveLength(0)
    expect(next.decks[0]!.words[0]!.familiarity).toBe('known')
  })

  it('restores actual shuffled order, input and flipped state while refreshing word metadata', () => {
    const saved = checkpoint('dictation')
    saved.order = 'random'
    saved.session.sequence.reverse()
    saved.answer = 'app'
    saved.flipped = false
    expect(isCheckpoint(JSON.parse(JSON.stringify(saved)))).toBe(true)
    const latest = { ...deck, words: deck.words.map((word) => ({ ...word, notes: '最新备注' })) }
    const restored = hydrateCheckpoint(saved, [latest])!
    expect(restored.session.sequence.map((word) => word.id)).toEqual(['book', 'apple'])
    expect(restored.answer).toBe('app')
    expect(restored.front).toBe('dictation')
    expect(restored.session.sequence[0]!.notes).toBe('最新备注')
  })

  it('rejects stale queues after editing or deleting a word and validates malformed positions', () => {
    const saved = checkpoint()
    expect(hydrateCheckpoint(saved, [])).toBeNull()
    expect(
      hydrateCheckpoint(saved, [{ ...deck, words: [{ ...baseWord, english: 'pear' }] }]),
    ).toBeNull()
    expect(isCheckpoint({ ...saved, session: { ...saved.session, cursor: 99 } })).toBe(false)
    const done = { ...saved, session: { ...saved.session, phase: 'done' as const } }
    expect(hydrateCheckpoint(done, [deck])).toBeNull()
    expect(
      withCheckpoint(
        { decks: [deck], records: [], sessions: { [saved.key]: saved } },
        saved.key,
        null,
      ).sessions,
    ).toEqual({})
  })

  it('does not let an older queue flush replace a newer checkpoint, or finish another active session', () => {
    const previous = checkpoint()
    const latest = { ...previous, id: 'new-session', answer: 'fresh', updatedAt: now + 1000 }
    const state: StudyState = { decks: [deck], records: [], sessions: { [latest.key]: latest } }
    expect(withCheckpoint(state, previous.key, previous).sessions[previous.key]).toBe(latest)
    const completed = applyReviewRating(
      state,
      previous.initialWords[0]!,
      'known',
      { before: previous, after: null },
      now + 2000,
    )!
    expect(completed.sessions[latest.key]!.id).toBe('new-session')
    expect(completed.records).toHaveLength(1)
  })
})

describe('local persistence, backup and draft compatibility', () => {
  let values: Map<string, string>
  beforeEach(() => {
    values = new Map()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('loads the old deck array and upgrades on a single successful write without dropping words', () => {
    values.set('english-daily-decks', JSON.stringify([deck]))
    const legacy = loadStudyState()
    expect(legacy).toEqual({ decks: [deck], records: [], sessions: {} })
    const saved = checkpoint()
    const record = makeLearningRecord(saved, saved.initialWords[0]!, 'recognition', 'known', now)
    const next = { ...legacy, records: [record], sessions: { [saved.key]: saved } }
    expect(saveStudyState(next)).toBe(true)
    expect(loadStudyState()).toEqual(next)
    expect(JSON.parse(values.get('english-daily-decks')!).version).toBe(2)
  })

  it('leaves the entire previous state untouched when storage refuses a write', () => {
    const state = { decks: [deck], records: [], sessions: {} }
    saveStudyState(state)
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: () => {
        throw new Error('quota')
      },
    })
    expect(saveStudyState({ ...state, decks: [] })).toBe(false)
    expect(loadStudyState()).toEqual(state)
  })

  it('round-trips schedules and learning records in version 2 backups and preserves version 1 parsing', () => {
    const saved = checkpoint()
    const record = makeLearningRecord(saved, saved.initialWords[0]!, 'recognition', 'known', now)
    const scheduled = { ...deck, words: [scheduleWord(baseWord, 'known', true, now)] }
    expect(
      parseDeckFile(
        JSON.stringify({
          kind: 'english-daily-decks',
          version: 2,
          decks: [scheduled],
          records: [record],
        }),
      ),
    ).toEqual({ decks: [scheduled], records: [record] })
    expect(
      parseDeckFile(JSON.stringify({ kind: 'english-daily-decks', version: 1, decks: [deck] })),
    ).toEqual({ decks: [deck] })
    expect(
      parseDeckFile(
        JSON.stringify({ kind: 'english-daily-decks', version: 2, decks: [], records: [record] }),
      ),
    ).toEqual({ decks: [], records: [record] })
  })

  it('retains incomplete words and multiple sentences in drafts and clears only the selected draft', () => {
    const draft = {
      date: today,
      title: '',
      words: [
        { id: 'new', english: 'app', chinese: '', collocations: 'one\ntwo', notes: '未写完' },
      ],
      updatedAt: now,
    }
    expect(isEditorDraft(draft)).toBe(true)
    expect(saveEditorDraft('new', draft)).toBe(true)
    expect(saveEditorDraft('existing', draft)).toBe(true)
    expect(loadEditorDraft('new')).toEqual(draft)
    saveEditorDraft('new', null)
    expect(loadEditorDraft('new')).toBeUndefined()
    expect(loadEditorDraft('existing')).toEqual(draft)
    expect(isEditorDraft({ ...draft, words: [{ english: 'broken' }] })).toBe(false)
  })
})

describe('non-blocking duplicate reminders', () => {
  it('finds duplicates across case/spacing, retains distinct meanings, and shows source information', () => {
    const history = {
      ...deck,
      title: '历史来源',
      words: [{ id: 'bank', english: 'bank', chinese: '银行' }],
    }
    const result = findDuplicates(
      [
        { id: 'one', english: ' BANK ', chinese: '河岸' },
        { id: 'two', english: 'bank', chinese: '银行' },
      ],
      [history],
    )
    expect(result.get('one')).toEqual([
      { english: 'bank', chinese: '银行', row: 2 },
      { english: 'bank', chinese: '银行', date: today, title: '历史来源' },
    ])
  })

  it('does not warn about the current word itself or words deleted from the edited draft', () => {
    expect(
      findDuplicates([{ id: 'apple', english: 'apple', chinese: '苹果' }], [deck], deck.id).size,
    ).toBe(0)
    expect(findDuplicates([{ id: 'apple', english: 'apple', chinese: '苹果' }], [deck]).size).toBe(
      1,
    )
    expect(toISODate(new Date(now))).toBe(today)
  })
})
