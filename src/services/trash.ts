import { moveDeckToTrash, restoreDeletedDeck } from '../features/decks/trash.ts'
import { loadStudyState, STUDY_STORAGE_KEY } from './storage.ts'
import { DRAFTS_KEY, loadAllDrafts } from './drafts.ts'
import { writeTransaction } from './transaction.ts'
import type { StudyState } from '../features/study/learning.ts'

export type TrashResult =
  { state: StudyState; message: string; entryId?: string } | { error: string }
function commit(state: StudyState, drafts = loadAllDrafts()): string | null {
  try {
    const result = writeTransaction([
      { storage: localStorage, key: DRAFTS_KEY, value: JSON.stringify(drafts) },
      {
        storage: localStorage,
        key: STUDY_STORAGE_KEY,
        value: JSON.stringify({ version: 2, ...state }),
      },
    ])
    if ('error' in result)
      return result.error === 'rollback'
        ? '保存失败，部分改动未能回滚，请保留备份并检查浏览器存储。'
        : '保存失败，本次改动已取消，请检查浏览器存储。'
    return null
  } catch {
    return '浏览器存储不可用，本次操作已取消。'
  }
}

export function trashDeck(id: string): TrashResult {
  const drafts = loadAllDrafts()
  const moved = moveDeckToTrash(loadStudyState(), id, drafts[id])
  if (!moved) return { error: '这组单词卡已经不存在，请刷新列表。' }
  delete drafts[id]
  const error = commit(moved.state, drafts)
  return error
    ? { error }
    : { state: moved.state, entryId: moved.entry.id, message: '已移入回收站，可撤销或稍后恢复。' }
}

export function restoreTrash(id: string): TrashResult {
  const restored = restoreDeletedDeck(loadStudyState(), id)
  if (!restored) return { error: '这条回收站记录已经不存在。' }
  const drafts = loadAllDrafts()
  const previous = drafts[restored.deck.id]
  if (restored.entry.draft && (!previous || restored.entry.draft.updatedAt > previous.updatedAt))
    drafts[restored.deck.id] = restored.entry.draft
  const error = commit(restored.state, drafts)
  return error
    ? { error }
    : {
        state: restored.state,
        message: restored.copied
          ? '同 ID 单词卡已存在，已恢复为副本，未覆盖现有内容。'
          : '单词卡已恢复；原有草稿与仍有效的复习进度也已恢复。',
      }
}

export function purgeTrash(id: string): TrashResult {
  const current = loadStudyState()
  if (!current.trash?.some((item) => item.id === id)) return { error: '这条回收站记录已经不存在。' }
  const state = { ...current, trash: current.trash.filter((item) => item.id !== id) }
  const error = commit(state)
  return error ? { error } : { state, message: '已永久删除这条回收站记录；真实学习记录仍保留。' }
}
