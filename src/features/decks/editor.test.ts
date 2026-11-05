import { describe, expect, it } from 'vitest'
import {
  filterEditorWords,
  EDITOR_PAGE_SIZE,
  deleteEditorWord,
  restoreEditorWord,
  updateEditorEnglish,
} from './editor.ts'
import { normalizeDraft } from './deck.ts'
import { isEditorDraft } from '../../services/drafts.ts'

describe('large-card editing', () => {
  it('accepts a draft with a cleared date while rejecting malformed dates', () => {
    const draft = {
      date: '',
      title: '',
      words: [{ id: 'a', english: 'hello', chinese: '' }],
      updatedAt: 1,
    }
    expect(isEditorDraft(draft)).toBe(true)
    expect(isEditorDraft({ ...draft, date: '2026-02-30' })).toBe(false)
  })
  it('clears the previous meaning when English changes, while preserving other fields', () => {
    const word = { id: 'a', english: 'apple', chinese: '苹果', notes: '备注' }
    expect(updateEditorEnglish(word, 'apples')).toEqual({ ...word, english: 'apples', chinese: '' })
    expect(updateEditorEnglish(word, 'apple')).toEqual(word)
  })
  const words = Array.from({ length: 27 }, (_, index) => ({
    id: `w-${index}`,
    english: `word${index}`,
    chinese: index === 25 ? '' : `释义${index}`,
    collocations: index === 24 ? 'special collocation' : '',
    notes: index === 26 ? '特殊备注' : '',
  }))
  it('finds words beyond the current page while retaining original row numbers and data', () => {
    expect(EDITOR_PAGE_SIZE).toBe(10)
    expect(filterEditorWords(words, 'special', false).map((item) => item.index)).toEqual([24])
    expect(filterEditorWords(words, '特殊备注', false).map((item) => item.index)).toEqual([26])
    expect(filterEditorWords(words, '', true).map((item) => item.index)).toEqual([25])
    expect(words).toHaveLength(27)
  })
  it('validates the full card and identifies an incomplete row hidden on another page', () => {
    expect(normalizeDraft(words)).toMatchObject({
      index: 25,
      error: '第 26 行需要同时填写英文和中文释义',
    })
    const complete = words.map((word) => ({ ...word, chinese: word.chinese || '补全' }))
    const result = normalizeDraft(complete)
    if ('error' in result) throw new Error(result.error)
    expect(result.words).toHaveLength(27)
    expect(result.words[26]!.notes).toBe('特殊备注')
    expect(result.words[24]!.collocations).toEqual(['special collocation'])
  })
})

describe('deleted editor row undo', () => {
  const rows = [
    { id: 'a', english: 'apple', chinese: '苹果' },
    {
      id: 'b',
      english: 'bank',
      chinese: '',
      collocations: 'river bank\nbank account',
      notes: '未完成备注',
    },
    { id: 'c', english: 'cat', chinese: '猫' },
  ]
  it('restores the complete raw row in place and does not mutate the source', () => {
    const removed = deleteEditorWord(rows, 'b')!
    expect(removed.words.map((row) => row.id)).toEqual(['a', 'c'])
    expect(restoreEditorWord(removed.words, removed.deleted).words).toEqual(rows)
    expect(rows).toHaveLength(3)
  })
  it('supports consecutive deletions and undo even after inserting another row', () => {
    const first = deleteEditorWord(rows, 'b')!
    const second = deleteEditorWord(first.words, 'a')!
    const edited = [{ id: 'new', english: '', chinese: '' }, ...second.words]
    const undoA = restoreEditorWord(edited, second.deleted)
    expect(restoreEditorWord(undoA.words, first.deleted).words.map((row) => row.id)).toEqual([
      'new',
      'a',
      'b',
      'c',
    ])
  })
  it('restores a deleted last row into an empty list and never duplicates a restored ID', () => {
    const removed = deleteEditorWord([rows[1]!], 'b')!
    expect(restoreEditorWord([], removed.deleted)).toEqual({ words: [rows[1]], index: 0 })
    expect(restoreEditorWord(rows, removed.deleted).words).toEqual(rows)
    expect(deleteEditorWord(rows, 'missing')).toBeNull()
  })
  it('validates deletion history in drafts while accepting old drafts', () => {
    const removed = deleteEditorWord(rows, 'b')!
    const draft = { date: '2026-10-29', title: '', words: removed.words, updatedAt: 1 }
    expect(isEditorDraft(draft)).toBe(true)
    expect(isEditorDraft({ ...draft, deletedWords: [removed.deleted] })).toBe(true)
    expect(isEditorDraft({ ...draft, deletedWords: [{ ...removed.deleted, index: -1 }] })).toBe(
      false,
    )
    expect(
      isEditorDraft({ ...draft, deletedWords: [{ ...removed.deleted, word: { id: 'bad' } }] }),
    ).toBe(false)
  })
})
