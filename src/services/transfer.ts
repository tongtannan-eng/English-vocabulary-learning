import { isSpeechRate } from './speechRate.ts'
import { isMistakeEntry } from '../features/study/mistakes.ts'
import { isEditorDraft } from './drafts.ts'
import { isUiPreferences } from './preferences.ts'
import { isShortcuts } from './shortcuts.ts'
import { parseDeckListView } from '../features/decks/deckList.ts'
import { isCheckpoint } from '../features/study/learning.ts'
import type { BackupPreferences, ParsedDeckFile } from './backupTypes.ts'
import { isPhraseList } from '../features/phrases/phrases.ts'
import { isSentenceList } from '../features/sentences/sentences.ts'
import { isDeck, isTrashEntry } from './storage.ts'
import { isBackupStatus } from './backupStatus.ts'
import type { Deck } from '../shared/types.ts'
import { isLearningRecord } from '../features/study/learning.ts'
import type { LearningRecord } from '../features/study/learning.ts'

const FILE_KIND = 'english-daily-decks'

export interface MergeResult {
  decks: Deck[]
  added: number
  updated: number
  skipped: number
}

export function parseDeckFile(text: string): ParsedDeckFile | { error: string } {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { error: '文件内容不是有效的 JSON。' }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { error: '这个文件不是单词卡备份。' }
  }
  const file = parsed as Record<string, unknown>
  if (
    file.kind !== FILE_KIND ||
    (file.version !== 1 &&
      file.version !== 2 &&
      file.version !== 3 &&
      file.version !== 4 &&
      file.version !== 5) ||
    !Array.isArray(file.decks)
  ) {
    return { error: '这个文件不是单词卡备份。' }
  }
  let records: LearningRecord[] | undefined
  if (file.version === 2 || file.version === 3 || file.version === 4 || file.version === 5) {
    if (!Array.isArray(file.records) || !file.records.every(isLearningRecord))
      return { error: '学习记录格式有误，已取消导入。' }
    records = file.records
  }
  if (
    file.version !== 3 &&
    file.version !== 4 &&
    file.version !== 5 &&
    file.decks.length === 0 &&
    !records?.length
  )
    return { error: '文件里没有单词卡或学习记录。' }

  const decks: Deck[] = []
  for (const item of file.decks) {
    if (!isDeck(item)) return { error: '文件里有无法识别的单词卡，已取消导入。' }
    decks.push({
      id: item.id,
      date: item.date,
      title: item.title,
      words: item.words.map((word) => ({
        id: word.id,
        english: word.english,
        chinese: word.chinese,
        ...(word.collocations ? { collocations: [...word.collocations] } : {}),
        ...(word.notes !== undefined ? { notes: word.notes } : {}),
        ...(word.familiarity ? { familiarity: word.familiarity } : {}),
        ...(word.reviewedAt !== undefined ? { reviewedAt: word.reviewedAt } : {}),
        ...(word.reviewStage !== undefined ? { reviewStage: word.reviewStage } : {}),
        ...(word.nextReviewDate ? { nextReviewDate: word.nextReviewDate } : {}),
        ...(word.scheduledOn ? { scheduledOn: word.scheduledOn } : {}),
      })),
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    })
  }
  if (file.version === 3 || file.version === 4 || file.version === 5) {
    if (
      (file.version === 4 || file.version === 5) &&
      (!Array.isArray(file.trash) || !file.trash.every(isTrashEntry))
    )
      return { error: '回收站数据格式有误，已取消导入。' }
    if (
      (file.version === 5 && !Array.isArray(file.mistakes)) ||
      (file.mistakes !== undefined &&
        (!Array.isArray(file.mistakes) || !file.mistakes.every(isMistakeEntry)))
    )
      return { error: '历史错题数据格式有误，已取消导入。' }
    if (file.backupStatus !== undefined && !isBackupStatus(file.backupStatus))
      return { error: '备份记录格式有误，已取消导入。' }
    if (
      file.scope === 'decks' &&
      ((Array.isArray(file.trash) && file.trash.length) ||
        file.backupStatus !== undefined ||
        file.sentences !== undefined ||
        file.phrases !== undefined)
    )
      return { error: '单组备份不能包含回收站、句子、词组或全局备份记录。' }
    if (file.scope !== 'full' && file.scope !== 'decks')
      return { error: '备份范围无法识别，已取消导入。' }
    if (
      !validMap(file.sessions, (value, key) => isCheckpoint(value) && value.key === key) ||
      !validMap(file.drafts, (value) => isEditorDraft(value))
    )
      return { error: '复习进度或草稿格式有误，已取消导入。' }
    if (file.version === 5 && file.sentences !== undefined && !isSentenceList(file.sentences))
      return { error: '句子数据格式有误，已取消导入。' }
    if (file.version === 5 && file.phrases !== undefined && !isPhraseList(file.phrases))
      return { error: '词组数据格式有误，已取消导入。' }
    if (file.scope === 'decks' && file.preferences !== undefined)
      return { error: '单组备份不能包含全局偏好，已取消导入。' }
    if (file.scope === 'decks') {
      const ids = new Set(decks.map((deck) => deck.id))
      const sessions = file.sessions as NonNullable<ParsedDeckFile['sessions']>
      if (
        (Array.isArray(file.mistakes) && file.mistakes.some((entry) => !ids.has(entry.deckId))) ||
        records!.some((record) => !ids.has(record.deckId)) ||
        Object.keys(file.drafts as object).some((key) => !ids.has(key)) ||
        Object.values(sessions).some((saved) =>
          saved.initialWords.some((word) => !ids.has(word.deckId)),
        )
      )
        return { error: '单组备份包含其他词组的数据，已取消导入。' }
    }
    if (file.scope === 'full' && !isBackupPreferences(file.preferences))
      return { error: '偏好或页面状态格式有误，已取消导入。' }
    return {
      decks,
      records: records!,
      scope: file.scope,
      ...(Array.isArray(file.mistakes) ? { mistakes: file.mistakes } : {}),
      ...(file.version === 5 && Array.isArray(file.sentences) ? { sentences: file.sentences } : {}),
      ...(file.version === 5 && Array.isArray(file.phrases) ? { phrases: file.phrases } : {}),
      ...(file.version === 4 || file.version === 5
        ? { trash: file.trash as NonNullable<ParsedDeckFile['trash']> }
        : {}),
      ...(file.backupStatus
        ? { backupStatus: file.backupStatus as NonNullable<ParsedDeckFile['backupStatus']> }
        : {}),
      sessions: file.sessions as ParsedDeckFile['sessions'],
      drafts: file.drafts as ParsedDeckFile['drafts'],
      ...(file.scope === 'full' ? { preferences: file.preferences as BackupPreferences } : {}),
    }
  }
  return { decks, ...(records ? { records } : {}) }
}

export function mergeDecks(current: readonly Deck[], incoming: readonly Deck[]): MergeResult {
  const incomingById = new Map<string, Deck>()
  for (const deck of incoming) {
    const previous = incomingById.get(deck.id)
    if (!previous || deck.updatedAt >= previous.updatedAt) incomingById.set(deck.id, deck)
  }

  let added = 0
  let updated = 0
  let skipped = 0
  const seen = new Set<string>()
  const decks = current.map((deck) => {
    seen.add(deck.id)
    const next = incomingById.get(deck.id)
    if (!next) return deck
    if (next.updatedAt > deck.updatedAt) {
      updated += 1
      return next
    }
    skipped += 1
    return deck
  })

  for (const deck of incomingById.values()) {
    if (seen.has(deck.id)) continue
    decks.push(deck)
    added += 1
  }

  return { decks, added, updated, skipped }
}

export function describeImport(result: MergeResult): string {
  if (result.added === 0 && result.updated === 0) {
    return '这些单词卡已经在本地，没有新的改动。'
  }
  const summary = `已导入，新增 ${result.added} 组，更新 ${result.updated} 组。`
  if (result.skipped === 0) return summary
  return `${summary}另有 ${result.skipped} 组本地记录较新，已保留。`
}

export function downloadDeckFile(
  decks: readonly Deck[],
  records?: readonly LearningRecord[],
): void {
  const payload = {
    kind: FILE_KIND,
    version: records ? 2 : 1,
    exportedAt: new Date().toISOString(),
    decks,
    ...(records ? { records } : {}),
  }
  downloadDataFile(payload)
}

export function downloadDataFile(
  payload: unknown,
  filename = `每日单词-${fileStamp(new Date())}.json`,
): void {
  const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

function fileStamp(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function validMap(value: unknown, validate: (item: unknown, key: string) => boolean): boolean {
  return Boolean(
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.entries(value).every(
      ([key, item]) =>
        !['__proto__', 'prototype', 'constructor'].includes(key) && validate(item, key),
    ),
  )
}

function isBackupPreferences(value: unknown): value is BackupPreferences {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const p = value as Record<string, unknown>
  const review = p.review as Record<string, unknown> | undefined
  if (
    (p.theme !== 'classic' && p.theme !== 'vivid') ||
    !['en-US', 'en-GB', 'en-AU'].includes(String(p.speechAccent)) ||
    !review ||
    !['english', 'chinese', 'dictation'].includes(String(review.front)) ||
    !['sequential', 'random'].includes(String(review.order)) ||
    (p.speechRate !== undefined && !isSpeechRate(p.speechRate)) ||
    (p.shortcuts !== undefined && !isShortcuts(p.shortcuts)) ||
    !isUiPreferences(p.ui) ||
    !p.listView ||
    typeof p.listView !== 'object' ||
    Array.isArray(p.listView)
  )
    return false
  // Sanitization must not silently turn a malformed backup into a different page state.
  const normalized = parseDeckListView(JSON.stringify(p.listView))
  return Object.entries(normalized).every(
    ([key, item]) =>
      JSON.stringify((p.listView as Record<string, unknown>)[key]) === JSON.stringify(item),
  )
}
