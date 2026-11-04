import { loadSpeechRate, SPEECH_RATE_KEY } from './speechRate.ts'
import {
  collectMistakeEntries,
  mergeMistakes,
  withMistakeHistory,
} from '../features/study/mistakes.ts'
import { reconcileTrash } from '../features/decks/trash.ts'
import {
  backupSnapshot,
  BACKUP_STATUS_KEY,
  loadBackupStatus,
  saveBackupStatus,
} from './backupStatus.ts'
import { writeTransaction } from './transaction.ts'
import type { StorageWrite } from './transaction.ts'
import {
  loadStudyState,
  STUDY_STORAGE_KEY,
  loadPrefs,
  PREFS_KEY,
  loadSpeechAccent,
  SPEECH_KEY,
} from './storage.ts'
import { DRAFTS_KEY, loadAllDrafts } from './drafts.ts'
import { describeImport, downloadDataFile, mergeDecks } from './transfer.ts'
import { mergePhrases } from '../features/phrases/phrases.ts'
import { mergeSentences } from '../features/sentences/sentences.ts'
import { mergeLearningRecords, pruneCheckpoints } from '../features/study/learning.ts'
import {
  LIST_VIEW_KEY,
  invalidateDeckListView,
  loadDeckListView,
} from '../features/decks/deckList.ts'
import { loadTheme, THEME_STORAGE_KEY } from '../shared/theme/theme.ts'
import { loadUiPreferences, UI_PREFERENCES_KEY } from './preferences.ts'
import { loadShortcuts, SHORTCUTS_KEY } from './shortcuts.ts'
import { APP_DATA_RESTORED } from './events.ts'
import type { BackupFile, ParsedDeckFile } from './backupTypes.ts'
import type { StudyState } from '../features/study/learning.ts'

export function createBackup(deckIds?: readonly string[]): BackupFile {
  const state = pruneCheckpoints(loadStudyState())
  const ids = deckIds ? new Set(deckIds) : null
  const drafts = loadAllDrafts()
  return {
    kind: 'english-daily-decks',
    version: 5,
    scope: ids ? 'decks' : 'full',
    exportedAt: new Date().toISOString(),
    trash: ids ? [] : (state.trash ?? []),
    mistakes: (state.mistakes ?? []).filter((entry) => !ids || ids.has(entry.deckId)),
    ...(!ids && loadBackupStatus() ? { backupStatus: loadBackupStatus()! } : {}),
    decks: ids ? state.decks.filter((deck) => ids.has(deck.id)) : state.decks,
    ...(!ids ? { sentences: state.sentences ?? [], phrases: state.phrases ?? [] } : {}),
    records: ids ? state.records.filter((record) => ids.has(record.deckId)) : state.records,
    sessions: Object.fromEntries(
      Object.entries(state.sessions).filter(
        ([, saved]) => !ids || saved.initialWords.every((word) => ids.has(word.deckId)),
      ),
    ),
    drafts: Object.fromEntries(Object.entries(drafts).filter(([key]) => !ids || ids.has(key))),
    ...(!ids
      ? {
          preferences: {
            theme: loadTheme(),
            speechAccent: loadSpeechAccent(),
            speechRate: loadSpeechRate(),
            review: loadPrefs(),
            ui: loadUiPreferences(),
            shortcuts: loadShortcuts(),
            listView: loadDeckListView(),
          },
        }
      : {}),
  }
}

export function exportBackup(deckIds?: readonly string[]): {
  type: 'success' | 'warning' | 'error'
  message: string
} {
  try {
    const file = createBackup(deckIds)
    if (!deckIds)
      file.backupStatus = {
        exportedAt: file.exportedAt,
        origin: 'local',
        snapshot: backupSnapshot(file),
      }
    downloadDataFile(file)
    if (file.backupStatus && !deckIds && !saveBackupStatus(file.backupStatus))
      return { type: 'warning', message: '备份文件已生成，但导出记录未能保存，请确认文件已下载。' }
    return {
      type: 'success',
      message: deckIds
        ? '这组数据已导出。单组导出不会更新完整备份记录。'
        : '完整备份文件已生成，请确认下载文件已保存。',
    }
  } catch {
    return { type: 'error', message: '备份文件生成失败，请重试。' }
  }
}

export function mergeBackup(
  current: StudyState,
  file: ParsedDeckFile,
  currentDrafts = loadAllDrafts(),
) {
  const merged = mergeDecks(current.decks, file.decks)
  const records = mergeLearningRecords(current.records, file.records ?? [])
  const sessions = { ...current.sessions }
  for (const [key, saved] of Object.entries(file.sessions ?? {})) {
    if (!sessions[key] || saved.updatedAt > sessions[key].updatedAt) sessions[key] = saved
  }
  const drafts = { ...currentDrafts }
  for (const [key, draft] of Object.entries(file.drafts ?? {})) {
    if (!drafts[key] || draft.updatedAt > drafts[key].updatedAt) drafts[key] = draft
  }
  const reconciled = reconcileTrash(merged.decks, current.trash ?? [], file.trash ?? [])
  for (const entry of reconciled.trash) {
    const draft = drafts[entry.deck.id]
    if (draft && (!entry.draft || draft.updatedAt > entry.draft.updatedAt)) entry.draft = draft
    delete drafts[entry.deck.id]
  }
  const mistakes = mergeMistakes(
    collectMistakeEntries(current),
    collectMistakeEntries({
      decks: file.decks,
      records: file.records ?? [],
      trash: file.trash,
      mistakes: file.mistakes,
    }),
  )
  const sentences = mergeSentences(current.sentences ?? [], file.sentences)
  const phrases = mergePhrases(current.phrases ?? [], file.phrases)
  const state = pruneCheckpoints(
    withMistakeHistory({
      ...current,
      decks: reconciled.decks,
      sentences,
      phrases,
      records,
      sessions,
      ...(mistakes.length ? { mistakes } : {}),
      ...(current.trash || file.trash ? { trash: reconciled.trash } : {}),
    }),
  )
  const currentById = new Map(current.decks.map((deck) => [deck.id, deck]))
  merged.added = state.decks.filter((deck) => !currentById.has(deck.id)).length
  merged.updated = state.decks.filter(
    (deck) => currentById.has(deck.id) && deck.updatedAt > currentById.get(deck.id)!.updatedAt,
  ).length
  return {
    state,
    drafts,
    message: `${describeImport(merged)}已保留 ${records.length} 条学习记录、${Object.keys(state.sessions).length} 份未完成复习、${Object.keys(drafts).length} 份草稿、${state.trash?.length ?? 0} 组回收站记录、${state.mistakes?.length ?? 0} 条历史错题来源。${file.preferences ? `已恢复主题、发音、${file.preferences.shortcuts ? '快捷键、' : ''}复习偏好及页面状态。` : ''}`,
  }
}

/** Multiple preference keys are restored together; any failed write rolls back prior writes. */
export function importBackup(
  file: ParsedDeckFile,
): { state: StudyState; message: string } | { error: string } {
  const merged = mergeBackup(loadStudyState(), file)
  const writes: StorageWrite[] = []
  const writeLocal = (key: string, value: string) =>
    writes.push({ storage: localStorage, key, value })
  try {
    // Write merged drafts even for an old backup when tombstones archive them.
    if (file.drafts || merged.state.trash?.length)
      writeLocal(DRAFTS_KEY, JSON.stringify(merged.drafts))
    if (file.preferences) {
      const p = file.preferences
      writeLocal(THEME_STORAGE_KEY, p.theme)
      writeLocal(SPEECH_KEY, p.speechAccent)
      if (p.speechRate !== undefined) writeLocal(SPEECH_RATE_KEY, String(p.speechRate))
      writeLocal(PREFS_KEY, JSON.stringify(p.review))
      writeLocal(UI_PREFERENCES_KEY, JSON.stringify(p.ui))
      if (p.shortcuts) writeLocal(SHORTCUTS_KEY, JSON.stringify(p.shortcuts))
      writes.push({
        storage: sessionStorage,
        key: LIST_VIEW_KEY,
        value: JSON.stringify(p.listView),
      })
    }
    const last = loadBackupStatus()
    if (
      file.backupStatus &&
      (!last || Date.parse(file.backupStatus.exportedAt) > Date.parse(last.exportedAt))
    )
      writeLocal(BACKUP_STATUS_KEY, JSON.stringify({ ...file.backupStatus, origin: 'imported' }))
    writeLocal(STUDY_STORAGE_KEY, JSON.stringify({ version: 2, ...merged.state }))
  } catch {
    return { error: '无法读取浏览器存储，已取消导入，原有数据未改动。' }
  }
  const result = writeTransaction(writes)
  if ('error' in result)
    return {
      error:
        result.error === 'rollback'
          ? '导入失败，部分设置未能回滚，请保留备份并检查浏览器存储。'
          : '导入失败，浏览器可能空间不足或禁止写入。已回滚本次改动，原有数据保持不变。',
    }
  if (file.preferences) invalidateDeckListView()
  window.dispatchEvent(new Event(APP_DATA_RESTORED))
  return { state: merged.state, message: merged.message }
}
