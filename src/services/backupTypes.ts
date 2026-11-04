import type { SpeechRate } from './speechRate.ts'
import type { MistakeEntry } from '../features/study/mistakes.ts'
import type { TrashEntry } from './trashTypes.ts'
import type { BackupStatus } from './backupStatus.ts'
import type { Deck, Phrase, ReviewPrefs, Sentence, SpeechAccent } from '../shared/types.ts'
import type { LearningRecord, ReviewCheckpoint } from '../features/study/learning.ts'
import type { EditorDraft } from './drafts.ts'
import type { DeckListView } from '../features/decks/deckList.ts'
import type { AppTheme } from '../shared/theme/theme.ts'
import type { UiPreferences } from './preferences.ts'
import type { Shortcuts } from './shortcuts.ts'

export interface BackupPreferences {
  theme: AppTheme
  speechAccent: SpeechAccent
  speechRate?: SpeechRate
  review: ReviewPrefs
  ui: UiPreferences
  shortcuts?: Shortcuts
  listView: DeckListView
}
export interface ParsedDeckFile {
  mistakes?: MistakeEntry[]
  trash?: TrashEntry[]
  backupStatus?: BackupStatus
  decks: Deck[]
  sentences?: Sentence[]
  phrases?: Phrase[]
  records?: LearningRecord[]
  scope?: 'full' | 'decks'
  sessions?: Record<string, ReviewCheckpoint>
  drafts?: Record<string, EditorDraft>
  preferences?: BackupPreferences
}
export interface BackupFile extends ParsedDeckFile {
  kind: 'english-daily-decks'
  version: 5
  mistakes: MistakeEntry[]
  exportedAt: string
  scope: 'full' | 'decks'
  records: LearningRecord[]
  sessions: Record<string, ReviewCheckpoint>
  drafts: Record<string, EditorDraft>
}
