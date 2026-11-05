import { useCallback, useEffect, useRef, useState } from 'react'
import { Button, Flex, Typography } from 'antd'
import { createBackup } from '../../../services/backup.ts'
import { subscribeBackupSignals } from '../../../services/backupStatus.ts'
import {
  checkSyncFile,
  loadSyncActivity,
  SYNC_STATUS_CHANGED,
} from '../../../services/syncStatus.ts'
import type { SyncFileStatus } from '../../../services/syncStatus.ts'

export function SyncStatusPanel({ refreshKey }: { refreshKey: number }) {
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

  const title =
    checking || !status
      ? '正在检查同步文件'
      : status.kind === 'missing'
        ? '未发现同步文件'
        : status.kind === 'unavailable'
          ? '无法检查同步文件'
          : status.kind === 'invalid'
            ? '同步文件格式有误'
            : status.fileChanged
              ? '同步文件尚未导入或已发生变化'
              : status.contentDiffers
                ? '浏览器数据与同步文件不同'
                : '浏览器与同步文件的学习内容一致'
  const hint =
    checking || !status
      ? '请稍候。'
      : status.kind === 'missing'
        ? '首次同步可从有数据的电脑导出；如果文件原本存在，请先检查项目和 Git 更新。'
        : status.kind === 'unavailable'
          ? '请确认通过本地项目启动，并使用本机地址访问后重新检查。'
          : status.kind === 'invalid'
            ? '请检查同步文件或从可靠备份恢复，避免覆盖。'
            : status.fileChanged
              ? '请先确认已拉取 Git 更新，再导入同步文件；导出前需要先导入。'
              : status.contentDiffers
                ? '若已拉取并导入最新文件，可导出当前浏览器数据，再检查并推送。'
                : '学习后可导出；导出后请检查 Git 状态并按需提交、推送。'
  const time = (value?: number) =>
    value ? new Date(value).toLocaleString('zh-CN') : '本机暂无记录'
  return (
    <section className="sync-status-panel" aria-label="Git 同步状态" aria-live="polite">
      <Flex justify="space-between" align="center" gap={12} wrap>
        <Typography.Text strong>{title}</Typography.Text>
        <Button size="small" loading={checking} onClick={() => void refresh()}>
          重新检查
        </Button>
      </Flex>
      <p>{hint}</p>
      <div className="sync-status-times">
        <span>最近导入：{time(activity.importedAt)}</span>
        <span>最近导出：{time(activity.exportedAt)}</span>
      </div>
      <small>
        仅检查此浏览器与项目同步文件；不会检查 GitHub
        拉取、提交或推送状态。比较不包含列表筛选和滚动位置。
      </small>
    </section>
  )
}
