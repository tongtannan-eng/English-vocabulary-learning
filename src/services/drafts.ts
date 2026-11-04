import { parseISODate } from '../shared/utils/format.ts'
import type { DeletedDraftWord, DraftWord } from '../shared/types.ts'

export interface EditorDraft {
  date: string
  title: string
  words: DraftWord[]
  deletedWords?: DeletedDraftWord[]
  baseUpdatedAt?: number
  baseSignature?: string
  updatedAt: number
}

export const DRAFTS_KEY = 'english-daily-editor-drafts'

export function isEditorDraft(value: unknown): value is EditorDraft {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const draft = value as Record<string, unknown>
  const validWord = (value: unknown) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false
    const word = value as Record<string, unknown>
    return (
      ['id', 'english', 'chinese'].every((key) => typeof word[key] === 'string') &&
      (word.collocations === undefined || typeof word.collocations === 'string') &&
      (word.notes === undefined || typeof word.notes === 'string')
    )
  }
  return (
    typeof draft.date === 'string' &&
    Boolean(parseISODate(draft.date)) &&
    typeof draft.title === 'string' &&
    typeof draft.updatedAt === 'number' &&
    Number.isFinite(draft.updatedAt) &&
    (draft.baseUpdatedAt === undefined ||
      (typeof draft.baseUpdatedAt === 'number' && Number.isFinite(draft.baseUpdatedAt))) &&
    (draft.baseSignature === undefined || typeof draft.baseSignature === 'string') &&
    Array.isArray(draft.words) &&
    draft.words.every(validWord) &&
    (draft.deletedWords === undefined ||
      (Array.isArray(draft.deletedWords) &&
        draft.deletedWords.every((item) => {
          if (!item || typeof item !== 'object' || Array.isArray(item)) return false
          const row = item as Record<string, unknown>
          return (
            validWord(row.word) &&
            Number.isInteger(row.index) &&
            Number(row.index) >= 0 &&
            (row.beforeId === undefined || typeof row.beforeId === 'string') &&
            (row.afterId === undefined || typeof row.afterId === 'string')
          )
        })))
  )
}

export function loadAllDrafts(): Record<string, EditorDraft> {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(DRAFTS_KEY) ?? '{}')
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
    return Object.fromEntries(Object.entries(value).filter(([, draft]) => isEditorDraft(draft)))
  } catch {
    return {}
  }
}

export function loadEditorDraft(key: string): EditorDraft | undefined {
  return loadAllDrafts()[key]
}

export function saveEditorDraft(key: string, draft: EditorDraft | null): boolean {
  try {
    const all = loadAllDrafts()
    if (draft) all[key] = draft
    else delete all[key]
    localStorage.setItem(DRAFTS_KEY, JSON.stringify(all))
    return true
  } catch {
    return false
  }
}
