import { rememberRating } from './mistakes.ts'
import type { MistakeEntry } from './mistakes.ts'
import type { TrashEntry } from '../../services/trashTypes.ts'
import { addDays, parseISODate, todayISO, toISODate } from '../../shared/utils/format.ts'
import { collectReviewWords, reviewWordKey, textReviewDeck } from './review.ts'
import type { ReviewSession } from './review.ts'
import type {
  Deck,
  Familiarity,
  FrontSide,
  Phrase,
  ReviewOrder,
  ReviewWord,
  Sentence,
  Word,
} from '../../shared/types.ts'

export interface SpellingAttempt {
  answer: string
  correct: boolean
  assisted: boolean
}

export interface ReviewCheckpoint {
  id: string
  key: string
  path: string
  title: string
  subtitle: string
  backPath: string
  front: FrontSide
  order: ReviewOrder
  session: ReviewSession
  initialWords: ReviewWord[]
  flipped: boolean
  answer: string
  result: SpellingAttempt | null
  firstAttempts: Record<string, SpellingAttempt>
  shownAnswers: string[]
  randomSeen?: string[]
  updatedAt: number
}

export interface LearningRecord {
  id: string
  sessionId: string
  deckId: string
  wordId: string
  english: string
  chinese: string
  mode: FrontSide
  kind: 'recognition' | 'spelling'
  round: 'initial' | 'retry'
  rating?: Familiarity
  correct?: boolean
  answer?: string
  assisted?: boolean
  at: number
  day: string
}

export interface StudyState {
  mistakes?: MistakeEntry[]
  trash?: TrashEntry[]
  decks: Deck[]
  sentences?: Sentence[]
  phrases?: Phrase[]
  records: LearningRecord[]
  sessions: Record<string, ReviewCheckpoint>
}

export interface ReviewRatingContext {
  before: ReviewCheckpoint
  after: ReviewCheckpoint | null
}

const INTERVALS = [1, 3, 7, 14, 30, 60] as const

export function scheduleWord(
  word: Word,
  rating: Familiarity,
  success: boolean,
  now = Date.now(),
): Word {
  const day = toISODate(new Date(now))
  const oldStage = Math.max(0, Math.min(INTERVALS.length, word.reviewStage ?? 0))
  const stage = success
    ? word.scheduledOn === day
      ? Math.max(1, oldStage)
      : Math.min(INTERVALS.length, oldStage + 1)
    : 0
  return {
    ...word,
    familiarity: rating,
    reviewedAt: now,
    reviewStage: stage,
    scheduledOn: day,
    nextReviewDate: addDays(day, stage === 0 ? 1 : INTERVALS[stage - 1]!),
  }
}

export function dueDate(word: Word): string | null {
  if (word.nextReviewDate) return word.nextReviewDate
  if (word.reviewedAt !== undefined) return addDays(toISODate(new Date(word.reviewedAt)), 1)
  return word.familiarity ? todayISO() : null
}

export function getTodayWords(decks: readonly Deck[], day = todayISO()) {
  const eligible = collectReviewWords(decks).filter((word) => word.deckDate <= day)
  const fresh = eligible
    .filter((word) => dueDate(word) === null)
    .sort((a, b) => a.deckDate.localeCompare(b.deckDate))
  const due = eligible
    .filter((word) => {
      const date = dueDate(word)
      return date !== null && date <= day
    })
    .sort((a, b) => dueDate(a)!.localeCompare(dueDate(b)!) || a.deckDate.localeCompare(b.deckDate))
  return {
    fresh,
    due,
    overdue: due.filter((word) => dueDate(word)! < day),
    words: [...due, ...fresh],
  }
}

export function attemptKey(checkpoint: ReviewCheckpoint, word: ReviewWord): string {
  return JSON.stringify([checkpoint.session.phase, checkpoint.front, word.deckId, word.id])
}

export function makeLearningRecord(
  checkpoint: ReviewCheckpoint,
  word: ReviewWord,
  kind: LearningRecord['kind'],
  result: Familiarity | SpellingAttempt,
  now = Date.now(),
): LearningRecord {
  return {
    id: JSON.stringify([checkpoint.id, attemptKey(checkpoint, word), kind]),
    sessionId: checkpoint.id,
    deckId: word.deckId,
    wordId: word.id,
    english: word.english,
    chinese: word.chinese,
    mode: checkpoint.front,
    kind,
    round: checkpoint.session.phase === 'retry' ? 'retry' : 'initial',
    ...(typeof result === 'string'
      ? { rating: result }
      : { correct: result.correct, assisted: result.assisted, answer: result.answer }),
    at: now,
    day: toISODate(new Date(now)),
  }
}

export function appendLearningRecord(
  records: readonly LearningRecord[],
  record: LearningRecord,
): LearningRecord[] {
  return records.some((item) => item.id === record.id) ? [...records] : [...records, record]
}

export function mergeLearningRecords(
  current: readonly LearningRecord[],
  incoming: readonly LearningRecord[],
): LearningRecord[] {
  const byId = new Map(current.map((record) => [record.id, record]))
  for (const record of incoming) if (!byId.has(record.id)) byId.set(record.id, record)
  return [...byId.values()].sort((a, b) => a.at - b.at)
}

export function hydrateCheckpoint(
  checkpoint: ReviewCheckpoint | undefined,
  decks: readonly Deck[],
  texts?: Pick<StudyState, 'sentences' | 'phrases'>,
): ReviewCheckpoint | null {
  if (!checkpoint || checkpoint.session.phase === 'done') return null
  const textKind = /^\/review-random\/(phrases|sentences)\//.exec(checkpoint.path)?.[1] as
    'phrases' | 'sentences' | undefined
  const source = textKind && texts ? [textReviewDeck(textKind, texts[textKind] ?? [])] : decks
  const current = new Map(collectReviewWords(source).map((word) => [reviewWordKey(word), word]))
  function hydrate(words: ReviewWord[]): ReviewWord[] | null {
    const hydrated: ReviewWord[] = []
    for (const word of words) {
      const latest = current.get(reviewWordKey(word))
      if (!latest || latest.english !== word.english || latest.chinese !== word.chinese) return null
      hydrated.push(latest)
    }
    return hydrated
  }
  const sequence = hydrate(checkpoint.session.sequence)
  const initialWords = hydrate(checkpoint.initialWords)
  if (!sequence || !initialWords) return null
  return { ...checkpoint, initialWords, session: { ...checkpoint.session, sequence } }
}

export function pruneCheckpoints(state: StudyState): StudyState {
  return {
    ...state,
    sessions: Object.fromEntries(
      Object.entries(state.sessions).flatMap(([key, saved]) => {
        const hydrated = hydrateCheckpoint(saved, state.decks, state)
        return hydrated ? [[key, hydrated]] : []
      }),
    ),
  }
}

export function updateReviewWordDetails(
  state: StudyState,
  word: ReviewWord,
  checkpoint: ReviewCheckpoint,
  details: { collocations: string[]; notes: string },
  now = Date.now(),
): StudyState | null {
  const deck = state.decks.find((item) => item.id === word.deckId)
  const current = deck?.words.find((item) => item.id === word.id)
  if (
    !deck ||
    !current ||
    current.english !== word.english ||
    current.chinese !== word.chinese ||
    (current.notes ?? '') !== (word.notes ?? '') ||
    JSON.stringify(current.collocations ?? []) !== JSON.stringify(word.collocations ?? [])
  )
    return null
  const updated = {
    ...deck,
    updatedAt: Math.max(now, deck.updatedAt + 1),
    words: deck.words.map((item) =>
      item.id === word.id
        ? { ...item, collocations: details.collocations, notes: details.notes }
        : item,
    ),
  }
  return pruneCheckpoints({
    ...state,
    decks: state.decks.map((item) => (item.id === deck.id ? updated : item)),
    sessions: { ...state.sessions, [checkpoint.key]: checkpoint },
  })
}

export function withCheckpoint(
  state: StudyState,
  key: string,
  checkpoint: ReviewCheckpoint | null,
): StudyState {
  if (checkpoint && state.sessions[key] && state.sessions[key]!.updatedAt > checkpoint.updatedAt)
    return state
  const sessions = { ...state.sessions }
  if (checkpoint && checkpoint.session.phase !== 'done') sessions[key] = checkpoint
  else delete sessions[key]
  // Bound saved queues while retaining the ten most recent unfinished sessions.
  const recent = Object.values(sessions)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 10)
  return { ...state, sessions: Object.fromEntries(recent.map((item) => [item.key, item])) }
}

export function applyReviewRating(
  state: StudyState,
  item: ReviewWord,
  rating: Familiarity,
  context?: ReviewRatingContext,
  now = Date.now(),
): StudyState | null {
  const deck = state.decks.find((entry) => entry.id === item.deckId)
  const word = deck?.words.find((entry) => entry.id === item.id)
  if (!deck || !word || word.english !== item.english || word.chinese !== item.chinese) return null
  const record = context
    ? makeLearningRecord(context.before, item, 'recognition', rating, now)
    : null
  const firstRecord = record
    ? (state.records.find((entry) => entry.id === record.id) ?? record)
    : null
  const spelling = context?.before.firstAttempts[attemptKey(context.before, item)]
  const successful =
    (firstRecord?.rating ?? rating) === 'known' &&
    (!context ||
      context.before.front === 'english' ||
      Boolean(spelling?.correct && !spelling.assisted))
  const mistakes = rememberRating(state, item, rating, now)
  let next: StudyState = {
    ...state,
    ...(mistakes.length ? { mistakes } : {}),
    decks: state.decks.map((entry) =>
      entry.id !== deck.id
        ? entry
        : {
            ...entry,
            updatedAt: now,
            words: entry.words.map((entry) =>
              entry.id !== word.id ? entry : scheduleWord(entry, rating, successful, now),
            ),
          },
    ),
    records: record ? appendLearningRecord(state.records, record) : state.records,
  }
  if (
    context &&
    (context.after ||
      !state.sessions[context.before.key] ||
      state.sessions[context.before.key]!.id === context.before.id)
  ) {
    next = withCheckpoint(next, context.before.key, context.after)
  }
  return next
}

export function learningSummary(records: readonly LearningRecord[], day = todayISO()) {
  const daily = records.filter((record) => record.day === day).sort((a, b) => a.at - b.at)
  const itemKey = (record: LearningRecord) =>
    JSON.stringify([
      record.english.trim().toLowerCase().replace(/\s+/g, ' '),
      record.chinese.trim(),
    ])
  const uniqueWords = new Set(daily.map(itemKey))
  const first = new Map<string, LearningRecord>()
  for (const record of daily) {
    if (record.round !== 'initial') continue
    const key = JSON.stringify([itemKey(record), record.mode, record.kind])
    if (!first.has(key)) first.set(key, record)
  }
  const attempts = [...first.values()]
  const recognition = attempts.filter((record) => record.kind === 'recognition')
  const spelling = attempts.filter(
    (record) => record.kind === 'spelling' && record.mode === 'chinese' && !record.assisted,
  )
  const dictation = attempts.filter(
    (record) => record.kind === 'spelling' && record.mode === 'dictation' && !record.assisted,
  )
  return {
    day,
    words: uniqueWords.size,
    known: recognition.filter((record) => record.rating === 'known').length,
    unknown: recognition.filter((record) => record.rating === 'unknown').length,
    spellingTotal: spelling.length,
    spellingCorrect: spelling.filter((record) => record.correct).length,
    dictationTotal: dictation.length,
    dictationCorrect: dictation.filter((record) => record.correct).length,
    assisted: attempts.filter((record) => record.kind === 'spelling' && record.assisted).length,
  }
}

function object(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
const modes = new Set(['english', 'chinese', 'dictation'])
function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

export function isLearningRecord(value: unknown): value is LearningRecord {
  if (!object(value)) return false
  return (
    ['id', 'sessionId', 'deckId', 'wordId', 'english', 'chinese'].every(
      (key) => typeof value[key] === 'string',
    ) &&
    modes.has(String(value.mode)) &&
    (value.round === 'initial' || value.round === 'retry') &&
    finite(value.at) &&
    typeof value.day === 'string' &&
    Boolean(parseISODate(value.day)) &&
    Number.isFinite(new Date(value.at).getTime()) &&
    ((value.kind === 'recognition' && (value.rating === 'known' || value.rating === 'unknown')) ||
      (value.kind === 'spelling' &&
        value.mode !== 'english' &&
        typeof value.correct === 'boolean' &&
        typeof value.assisted === 'boolean' &&
        (value.answer === undefined || typeof value.answer === 'string')))
  )
}

function isAttempt(value: unknown): value is SpellingAttempt {
  return (
    object(value) &&
    typeof value.answer === 'string' &&
    typeof value.correct === 'boolean' &&
    typeof value.assisted === 'boolean'
  )
}
function isReviewWord(value: unknown): value is ReviewWord {
  return (
    object(value) &&
    ['id', 'english', 'chinese', 'deckId', 'deckDate', 'deckTitle'].every(
      (key) => typeof value[key] === 'string',
    )
  )
}

export function isCheckpoint(value: unknown): value is ReviewCheckpoint {
  if (!object(value) || !object(value.session)) return false
  const session = value.session
  return (
    ['id', 'key', 'path', 'title', 'subtitle', 'backPath', 'answer'].every(
      (key) => typeof value[key] === 'string',
    ) &&
    /^\/(review\/[^/]+|review-weekly\/\d{4}-\d{2}-\d{2}|review-monthly\/\d{4}-\d{2}-\d{2}|review-random\/(?:phrases\/|sentences\/)?(5|10|20)|review-quick\/\d{4}-\d{2}-\d{2}\/(5|10|20)|review-unfamiliar|review-mistakes|review-errors\/(chinese|dictation)|review-today(?:\/\d{4}-\d{2}-\d{2})?)$/.test(
      String(value.path),
    ) &&
    modes.has(String(value.front)) &&
    (value.order === 'sequential' || value.order === 'random') &&
    typeof value.flipped === 'boolean' &&
    finite(value.updatedAt) &&
    Array.isArray(value.initialWords) &&
    value.initialWords.length > 0 &&
    value.initialWords.every(isReviewWord) &&
    (value.result === null || isAttempt(value.result)) &&
    object(value.firstAttempts) &&
    Object.values(value.firstAttempts).every(isAttempt) &&
    Array.isArray(value.shownAnswers) &&
    value.shownAnswers.every((key) => typeof key === 'string') &&
    (value.randomSeen === undefined ||
      (Array.isArray(value.randomSeen) &&
        value.randomSeen.every((key) => typeof key === 'string'))) &&
    (session.phase === 'initial' || session.phase === 'retry') &&
    Array.isArray(session.sequence) &&
    session.sequence.length > 0 &&
    session.sequence.every(isReviewWord) &&
    Number.isInteger(session.cursor) &&
    Number(session.cursor) >= 0 &&
    Number(session.cursor) < session.sequence.length &&
    object(session.ratings) &&
    Object.values(session.ratings).every((rating) => rating === 'known' || rating === 'unknown') &&
    Number.isInteger(session.initialCount) &&
    Number(session.initialCount) === value.initialWords.length &&
    Number.isInteger(session.retryCount) &&
    Number(session.retryCount) >= 0 &&
    Number(session.retryCount) <= Number(session.initialCount)
  )
}
