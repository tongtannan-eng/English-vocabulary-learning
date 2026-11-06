import { useCallback, useEffect, useRef, useState } from 'react'
import { createBackup } from '../../../services/backup.ts'
import { subscribeBackupSignals } from '../../../services/backupStatus.ts'
import {
  checkSyncFile,
  loadSyncActivity,
  SYNC_STATUS_CHANGED,
} from '../../../services/syncStatus.ts'
import type { SyncFileStatus } from '../../../services/syncStatus.ts'

export function useSyncStatus(refreshKey: number) {
  const [status, setStatus] = useState<SyncFileStatus | null>(null)
  const [checking, setChecking] = useState(false)
  const [activity, setActivity] = useState(loadSyncActivity)
  const requestId = useRef(0)
  const refresh = useCallback(async () => {
    const id = ++requestId.current
    setChecking(true)
    setActivity(loadSyncActivity())
    const result = await checkSyncFile(createBackup())
    if (id === requestId.current) {
      setStatus(result)
      setChecking(false)
    }
  }, [])
  useEffect(() => {
    const request = requestId
    const onRefresh = () => {
      void refresh()
    }
    const timer = window.setTimeout(onRefresh, 0)
    const unsubscribe = subscribeBackupSignals(onRefresh)
    window.addEventListener('focus', onRefresh)
    window.addEventListener(SYNC_STATUS_CHANGED, onRefresh)
    return () => {
      request.current++
      window.clearTimeout(timer)
      unsubscribe()
      window.removeEventListener('focus', onRefresh)
      window.removeEventListener(SYNC_STATUS_CHANGED, onRefresh)
    }
  }, [refresh, refreshKey])

  return { status, checking, activity, refresh }
}
