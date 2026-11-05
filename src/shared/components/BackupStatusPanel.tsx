import { mistakeWordKey } from '../../features/study/mistakes.ts'
import { useEffect, useReducer } from 'react'
import {
  backupSnapshot,
  compareBackup,
  loadBackupStatus,
  subscribeBackupSignals,
} from '../../services/backupStatus.ts'
import { createBackup } from '../../services/backup.ts'

export function BackupStatusPanel() {
  const [, refresh] = useReducer((value) => value + 1, 0)
  useEffect(() => subscribeBackupSignals(refresh), [])
  const file = createBackup()
  const last = loadBackupStatus()
  const delta = last ? compareBackup(last.snapshot, backupSnapshot(file)) : null
  const mistakeCount = new Set(file.mistakes.map(mistakeWordKey)).size
  const wordCount = file.decks.reduce((sum, deck) => sum + deck.words.length, 0)
  const details = delta
    ? [
        delta.addedWords ? `新增 ${delta.addedWords} 行单词` : '',
        delta.newRecords ? `新增 ${delta.newRecords} 条作答记录` : '',
        delta.editedWords ? `修改 ${delta.editedWords} 行单词` : '',
        delta.removedWords ? `移除 ${delta.removedWords} 行单词` : '',
        delta.otherChanges ? '词组、草稿、进度、历史错题、回收站或设置有变更' : '',
      ]
        .filter(Boolean)
        .join(' · ')
    : `当前 ${wordCount} 行单词、${file.records.length} 条记录、${Object.keys(file.drafts).length} 份草稿、${mistakeCount} 个历史错题、${file.trash?.length ?? 0} 组回收站记录`
  return (
    <section
      className={`backup-status-panel${!last || delta?.pending ? ' needs-backup' : ''}`}
      aria-label="备份状态"
    >
      <div>
        <span>
          {last
            ? `最近完整导出：${new Date(last.exportedAt).toLocaleString('zh-CN')}${last.origin === 'imported' ? '（来自导入备份）' : ''}`
            : '尚未生成完整备份'}
        </span>
        <small>
          {delta && !delta.pending ? '备份后暂无新的数据变更。' : details}
          {!last ? '。建议先导出一份完整备份。' : ''}
        </small>
        <small className="backup-status-hint">
          记录的是文件生成时间，请确认下载文件已保存；单组导出不会更新此记录。
        </small>
      </div>
    </section>
  )
}
