import { backupSnapshot, compareBackup } from '../../services/backupStatus.ts'
import type { BackupStatus } from '../../services/backupStatus.ts'
import type { ParsedDeckFile } from '../../services/backupTypes.ts'
import type { BackupReminderFrequency } from '../../services/preferences.ts'

export function dataOverview(file: ParsedDeckFile) {
  const words = file.decks.flatMap((deck) => deck.words)
  return {
    decks: file.decks.length,
    words: words.length,
    phrases: file.phrases?.length ?? 0,
    sentences: file.sentences?.length ?? 0,
    unfamiliar: words.filter((word) => word.familiarity === 'unknown').length,
    trash: file.trash?.length ?? 0,
  }
}

export function backupReminder(
  frequency: BackupReminderFrequency,
  last: BackupStatus | null,
  file: ParsedDeckFile,
  now = Date.now(),
): string | null {
  if (frequency === 'off') return null
  const counts = dataOverview(file)
  const hasData =
    Object.values(counts).some((count) => count > 0) ||
    Boolean(
      file.records?.length ||
      Object.keys(file.drafts ?? {}).length ||
      Object.keys(file.sessions ?? {}).length,
    )
  if (!last) return hasData ? '还没有完整备份，建议先导出一份。' : null
  const delta = compareBackup(last.snapshot, backupSnapshot(file))
  const changes =
    delta.addedWords +
    delta.removedWords +
    delta.editedWords +
    delta.newRecords +
    delta.otherChanges
  if (changes >= 20) return '上次完整备份后已有较多数据变化，建议重新备份。'
  const days = frequency === 'weekly' ? 7 : 30
  if (hasData && now - Date.parse(last.exportedAt) >= days * 24 * 60 * 60 * 1000)
    return `距离上次完整备份已达到 ${days} 天，建议检查并备份。`
  return null
}
