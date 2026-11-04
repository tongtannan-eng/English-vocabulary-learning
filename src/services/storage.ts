import { isPhrase } from '../features/phrases/phrases.ts'
import { isSentence } from '../features/sentences/sentences.ts'
import { isMistakeEntry, withMistakeHistory } from '../features/study/mistakes.ts'
import { isEditorDraft } from './drafts.ts'
import type { TrashEntry } from './trashTypes.ts'
import { APP_DATA_RESTORED } from './events.ts'
import type { Deck, ReviewPrefs, SpeechAccent, Word } from '../shared/types.ts'
import { parseISODate } from '../shared/utils/format.ts'
import { isCheckpoint, isLearningRecord } from '../features/study/learning.ts'
import type { StudyState } from '../features/study/learning.ts'

export const STUDY_STORAGE_KEY = 'english-daily-decks'
export const PREFS_KEY = 'english-daily-review-prefs'
export const SPEECH_KEY = 'english-daily-speech-accent'
const SPEECH_CHANGED = 'english-daily-speech-changed'

function isWord(value: unknown): value is Word {
  if (!value || typeof value !== 'object') return false
  const word = value as Record<string, unknown>
  return (
    typeof word.id === 'string' &&
    typeof word.english === 'string' &&
    typeof word.chinese === 'string' &&
    (word.notes === undefined || typeof word.notes === 'string') &&
    (word.collocations === undefined ||
      (Array.isArray(word.collocations) &&
        word.collocations.every((item) => typeof item === 'string'))) &&
    (word.familiarity === undefined ||
      word.familiarity === 'known' ||
      word.familiarity === 'unknown') &&
    (word.reviewedAt === undefined ||
      (typeof word.reviewedAt === 'number' && Number.isFinite(word.reviewedAt))) &&
    (word.reviewStage === undefined ||
      (Number.isInteger(word.reviewStage) &&
        Number(word.reviewStage) >= 0 &&
        Number(word.reviewStage) <= 6)) &&
    (word.nextReviewDate === undefined ||
      (typeof word.nextReviewDate === 'string' && Boolean(parseISODate(word.nextReviewDate)))) &&
    (word.scheduledOn === undefined ||
      (typeof word.scheduledOn === 'string' && Boolean(parseISODate(word.scheduledOn))))
  )
}

export function isDeck(value: unknown): value is Deck {
  if (!value || typeof value !== 'object') return false
  const deck = value as Record<string, unknown>
  return (
    typeof deck.id === 'string' &&
    typeof deck.date === 'string' &&
    typeof deck.title === 'string' &&
    typeof deck.createdAt === 'number' &&
    typeof deck.updatedAt === 'number' &&
    Array.isArray(deck.words) &&
    deck.words.every(isWord)
  )
}

export function loadDecks(): Deck[] {
  return loadStudyState().decks
}

export function loadStudyState(): StudyState {
  const empty: StudyState = { decks: [], records: [], sessions: {} }
  try {
    const raw = localStorage.getItem(STUDY_STORAGE_KEY)
    if (!raw) return empty
    const parsed: unknown = JSON.parse(raw)
    if (Array.isArray(parsed)) return withMistakeHistory({ ...empty, decks: parsed.filter(isDeck) })
    if (!parsed || typeof parsed !== 'object') return empty
    const saved = parsed as Record<string, unknown>
    if (saved.version !== 2 || !Array.isArray(saved.decks)) return empty
    return withMistakeHistory({
      decks: saved.decks.filter(isDeck),
      ...(Array.isArray(saved.mistakes) ? { mistakes: saved.mistakes.filter(isMistakeEntry) } : {}),
      ...(Array.isArray(saved.trash) ? { trash: saved.trash.filter(isTrashEntry) } : {}),
      records: Array.isArray(saved.records) ? saved.records.filter(isLearningRecord) : [],
      ...(Array.isArray(saved.sentences) ? { sentences: saved.sentences.filter(isSentence) } : {}),
      ...(Array.isArray(saved.phrases) ? { phrases: saved.phrases.filter(isPhrase) } : {}),
      sessions:
        saved.sessions && typeof saved.sessions === 'object' && !Array.isArray(saved.sessions)
          ? Object.fromEntries(
              Object.entries(saved.sessions).filter(
                ([key, checkpoint]) => isCheckpoint(checkpoint) && checkpoint.key === key,
              ),
            )
          : {},
    })
  } catch {
    return empty
  }
}

export function saveDecks(decks: readonly Deck[]): boolean {
  return saveStudyState({ ...loadStudyState(), decks: [...decks] })
}

export function saveStudyState(state: StudyState): boolean {
  try {
    // One write keeps queue advancement, learning records and scheduling atomic.
    localStorage.setItem(
      STUDY_STORAGE_KEY,
      JSON.stringify({ version: 2, ...withMistakeHistory(state) }),
    )
    return true
  } catch {
    return false
  }
}

export function upsertDeck(decks: readonly Deck[], deck: Deck): Deck[] {
  return [...decks.filter((item) => item.id !== deck.id), deck]
}

export function loadPrefs(): ReviewPrefs {
  const fallback: ReviewPrefs = { front: 'english', order: 'sequential' }
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as Partial<ReviewPrefs>
    return {
      front: parsed.front === 'chinese' || parsed.front === 'dictation' ? parsed.front : 'english',
      order: parsed.order === 'random' ? 'random' : 'sequential',
    }
  } catch {
    return fallback
  }
}

export function savePrefs(prefs: ReviewPrefs): boolean {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
    window.dispatchEvent(new Event('english-daily-review-prefs-changed'))
    return true
  } catch {
    return false
  }
}

export function loadSpeechAccent(): SpeechAccent {
  try {
    const accent = localStorage.getItem(SPEECH_KEY)
    return accent === 'en-GB' || accent === 'en-AU' ? accent : 'en-US'
  } catch {
    return 'en-US'
  }
}

export function saveSpeechAccent(accent: SpeechAccent): boolean {
  try {
    localStorage.setItem(SPEECH_KEY, accent)
    window.dispatchEvent(new Event(SPEECH_CHANGED))
    return true
  } catch {
    return false
  }
}

export function subscribeSpeechAccent(listener: () => void): () => void {
  function onStorage(event: StorageEvent) {
    if (event.key === SPEECH_KEY || event.key === null) listener()
  }
  window.addEventListener(APP_DATA_RESTORED, listener)
  window.addEventListener(SPEECH_CHANGED, listener)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(APP_DATA_RESTORED, listener)
    window.removeEventListener(SPEECH_CHANGED, listener)
    window.removeEventListener('storage', onStorage)
  }
}

export function isTrashEntry(value: unknown): value is TrashEntry {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const entry = value as Record<string, unknown>
  return (
    typeof entry.id === 'string' &&
    entry.id.length > 0 &&
    isDeck(entry.deck) &&
    typeof entry.deletedAt === 'number' &&
    Number.isFinite(entry.deletedAt) &&
    (entry.draft === undefined || isEditorDraft(entry.draft)) &&
    Boolean(
      entry.sessions &&
      typeof entry.sessions === 'object' &&
      !Array.isArray(entry.sessions) &&
      Object.entries(entry.sessions).every(
        ([key, saved]) =>
          !['__proto__', 'constructor', 'prototype'].includes(key) &&
          isCheckpoint(saved) &&
          saved.key === key,
      ),
    )
  )
}

export function subscribeReviewPrefs(listener: () => void): () => void {
  const storage = (event: StorageEvent) => {
    if (event.key === PREFS_KEY || event.key === null) listener()
  }
  window.addEventListener('english-daily-review-prefs-changed', listener)
  window.addEventListener(APP_DATA_RESTORED, listener)
  window.addEventListener('storage', storage)
  return () => {
    window.removeEventListener('english-daily-review-prefs-changed', listener)
    window.removeEventListener(APP_DATA_RESTORED, listener)
    window.removeEventListener('storage', storage)
  }
}
