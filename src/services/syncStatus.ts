import { backupSnapshot, compareBackup } from './backupStatus.ts'
import { parseDeckFile } from './transfer.ts'
import type { ParsedDeckFile } from './backupTypes.ts'

export const SYNC_REVISION_KEY = 'english-daily-sync-revision'
export const SYNC_ACTIVITY_KEY = 'english-daily-sync-activity'
export const SYNC_STATUS_CHANGED = 'english-daily-sync-status-changed'
export interface SyncActivity {
  importedAt?: number
  exportedAt?: number
}
export type SyncFileStatus =
  | { kind: 'missing' }
  | { kind: 'unavailable' }
  | { kind: 'invalid' }
  | { kind: 'ready'; fileChanged: boolean; contentDiffers: boolean }

export function loadSyncActivity(): SyncActivity {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(SYNC_ACTIVITY_KEY) ?? 'null')
    if (!data || typeof data !== 'object' || Array.isArray(data)) return {}
    const record = data as Record<string, unknown>
    const isTime = (value: unknown): value is number =>
      typeof value === 'number' && value > 0 && Number.isFinite(new Date(value).getTime())
    return {
      ...(isTime(record.importedAt) ? { importedAt: record.importedAt } : {}),
      ...(isTime(record.exportedAt) ? { exportedAt: record.exportedAt } : {}),
    }
  } catch {
    return {}
  }
}

export function recordSyncActivity(action: 'importedAt' | 'exportedAt', at = Date.now()): boolean {
  try {
    localStorage.setItem(SYNC_ACTIVITY_KEY, JSON.stringify({ ...loadSyncActivity(), [action]: at }))
    window.dispatchEvent(new Event(SYNC_STATUS_CHANGED))
    return true
  } catch {
    return false
  }
}

export async function checkSyncFile(local: ParsedDeckFile): Promise<SyncFileStatus> {
  try {
    const response = await fetch('/__local_sync', { cache: 'no-store' })
    if (response.status === 404) return { kind: 'missing' }
    if (!response.ok) return { kind: 'unavailable' }
    const revision = response.headers.get('X-Sync-Revision')
    if (!revision) return { kind: 'unavailable' }
    const file = parseDeckFile(await response.text())
    if ('error' in file || file.scope !== 'full') return { kind: 'invalid' }
    const localRevision = localStorage.getItem(SYNC_REVISION_KEY)
    const fileSnapshot = backupSnapshot(file)
    const localSnapshot = backupSnapshot(local)
    return {
      kind: 'ready',
      fileChanged: revision !== localRevision,
      contentDiffers:
        compareBackup(fileSnapshot, localSnapshot).pending ||
        compareBackup(localSnapshot, fileSnapshot).pending,
    }
  } catch {
    return { kind: 'unavailable' }
  }
}
