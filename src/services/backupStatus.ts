import { SPEECH_RATE_CHANGED } from './speechRate.ts'
import { DEFAULT_SHORTCUTS, SHORTCUTS_CHANGED } from './shortcuts.ts'
import { mistakeSourceKey } from '../features/study/mistakes.ts'
import type { ParsedDeckFile } from './backupTypes.ts'
import { APP_DATA_RESTORED } from './events.ts'

export const BACKUP_STATUS_KEY = 'english-daily-backup-status'
export const BACKUP_STATUS_CHANGED = 'english-daily-backup-status-changed'
type Signatures = Record<string, string>
export interface BackupSnapshot {
  mistakes?: Signatures
  sentences?: Signatures
  phrases?: Signatures
  words: Signatures
  cards: Signatures
  records: string[]
  drafts: Signatures
  sessions: Signatures
  trash: Signatures
  preferences: string
}
export interface BackupStatus {
  exportedAt: string
  origin: 'local' | 'imported'
  snapshot: BackupSnapshot
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  if (value && typeof value === 'object')
    return `{${Object.entries(value)
      .filter(([key]) => key !== 'updatedAt' && key !== 'reviewedAt')
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`)
      .join(',')}}`
  return JSON.stringify(value) ?? 'null'
}
function signature(value: unknown): string {
  const text = stable(value)
  let hash = 2166136261
  for (let index = 0; index < text.length; index++)
    hash = Math.imul(hash ^ text.charCodeAt(index), 16777619)
  return `${text.length}:${(hash >>> 0).toString(16)}`
}
export function backupSnapshot(file: ParsedDeckFile): BackupSnapshot {
  return {
    mistakes: Object.fromEntries(
      (file.mistakes ?? []).map((entry) => [mistakeSourceKey(entry), signature(entry)]),
    ),
    words: Object.fromEntries(
      file.decks.flatMap((deck) =>
        deck.words.map((word) => [JSON.stringify([deck.id, word.id]), signature(word)]),
      ),
    ),
    sentences: Object.fromEntries((file.sentences ?? []).map((item) => [item.id, signature(item)])),
    phrases: Object.fromEntries((file.phrases ?? []).map((item) => [item.id, signature(item)])),
    cards: Object.fromEntries(
      file.decks.map((deck) => [
        deck.id,
        signature({
          title: deck.title,
          date: deck.date,
          wordIds: deck.words.map((word) => word.id),
        }),
      ]),
    ),
    records: [...new Set((file.records ?? []).map((record) => record.id))].sort(),
    drafts: Object.fromEntries(
      Object.entries(file.drafts ?? {}).map(([key, draft]) => [key, signature(draft)]),
    ),
    sessions: Object.fromEntries(
      Object.entries(file.sessions ?? {}).map(([key, saved]) => [key, signature(saved)]),
    ),
    trash: Object.fromEntries((file.trash ?? []).map((entry) => [entry.id, signature(entry)])),
    // Navigation and scroll alone must not cause a constant backup warning.
    preferences: signature(
      file.preferences
        ? {
            theme: file.preferences.theme,
            speechAccent: file.preferences.speechAccent,
            speechRate: file.preferences.speechRate ?? 0.9,
            shortcuts: file.preferences.shortcuts ?? DEFAULT_SHORTCUTS,
            review: file.preferences.review,
            ui: file.preferences.ui,
          }
        : null,
    ),
  }
}
function changes(before: Signatures, after: Signatures) {
  return [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(
    (key) => before[key] !== after[key],
  ).length
}
export function compareBackup(before: BackupSnapshot, after: BackupSnapshot) {
  const addedWords = Object.keys(after.words).filter(
    (key) => !Object.hasOwn(before.words, key),
  ).length
  const removedWords = Object.keys(before.words).filter(
    (key) => !Object.hasOwn(after.words, key),
  ).length
  const editedWords = Object.keys(after.words).filter(
    (key) => Object.hasOwn(before.words, key) && before.words[key] !== after.words[key],
  ).length
  const oldRecords = new Set(before.records)
  const newRecords = after.records.filter((id) => !oldRecords.has(id)).length
  const otherChanges =
    changes(before.mistakes ?? {}, after.mistakes ?? {}) +
    changes(before.sentences ?? {}, after.sentences ?? {}) +
    changes(before.phrases ?? {}, after.phrases ?? {}) +
    changes(before.cards, after.cards) +
    changes(before.drafts, after.drafts) +
    changes(before.sessions, after.sessions) +
    changes(before.trash, after.trash) +
    Number(before.preferences !== after.preferences)
  return {
    addedWords,
    removedWords,
    editedWords,
    newRecords,
    otherChanges,
    pending: Boolean(addedWords || removedWords || editedWords || newRecords || otherChanges),
  }
}
export function isBackupStatus(value: unknown): value is BackupStatus {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  if (
    typeof record.exportedAt !== 'string' ||
    !Number.isFinite(Date.parse(record.exportedAt)) ||
    !['local', 'imported'].includes(String(record.origin)) ||
    !record.snapshot ||
    typeof record.snapshot !== 'object' ||
    Array.isArray(record.snapshot)
  )
    return false
  const snapshot = record.snapshot as Record<string, unknown>
  const map = (item: unknown) =>
    Boolean(
      item &&
      typeof item === 'object' &&
      !Array.isArray(item) &&
      Object.values(item).every((entry) => typeof entry === 'string'),
    )
  return (
    (snapshot.mistakes === undefined || map(snapshot.mistakes)) &&
    (snapshot.sentences === undefined || map(snapshot.sentences)) &&
    (snapshot.phrases === undefined || map(snapshot.phrases)) &&
    ['words', 'cards', 'drafts', 'sessions', 'trash'].every((key) => map(snapshot[key])) &&
    Array.isArray(snapshot.records) &&
    snapshot.records.every((id) => typeof id === 'string') &&
    new Set(snapshot.records).size === snapshot.records.length &&
    typeof snapshot.preferences === 'string'
  )
}
export function loadBackupStatus(): BackupStatus | null {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(BACKUP_STATUS_KEY) ?? 'null')
    return isBackupStatus(value) ? value : null
  } catch {
    return null
  }
}
export function saveBackupStatus(status: BackupStatus): boolean {
  try {
    localStorage.setItem(BACKUP_STATUS_KEY, JSON.stringify(status))
    window.dispatchEvent(new Event(BACKUP_STATUS_CHANGED))
    return true
  } catch {
    return false
  }
}
export function subscribeBackupSignals(listener: () => void) {
  const events = [
    SPEECH_RATE_CHANGED,
    SHORTCUTS_CHANGED,
    BACKUP_STATUS_CHANGED,
    APP_DATA_RESTORED,
    'storage',
    'english-daily-ui-changed',
    'english-daily-speech-changed',
    'english-daily-theme-changed',
    'english-daily-review-prefs-changed',
  ]
  events.forEach((event) => window.addEventListener(event, listener))
  return () => events.forEach((event) => window.removeEventListener(event, listener))
}
