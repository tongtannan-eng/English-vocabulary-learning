import {
  loadSpeechRate,
  saveSpeechRate,
  subscribeSpeechRate,
  SPEECH_RATES,
} from '../../../services/speechRate.ts'
import {
  useEffect,
  useLayoutEffect,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import type { ChangeEvent } from 'react'
import { App as AntApp, Alert, Button, Card, Flex, Radio, Segmented, Typography } from 'antd'
import { UploadOutlined } from '@ant-design/icons'
import { TopBar } from '../../../shared/components/TopBar.tsx'
import { BackupStatusPanel } from '../../../shared/components/BackupStatusPanel.tsx'
import { useAppTheme } from '../../../shared/theme/themeContext.ts'
import { themeOptions } from '../../../shared/theme/theme.ts'
import { SPEECH_ACCENTS } from '../../study/speak.ts'
import { SpeakButton } from '../../study/components/SpeakButton.tsx'
import {
  loadPrefs,
  savePrefs,
  subscribeReviewPrefs,
  loadSpeechAccent,
  saveSpeechAccent,
  subscribeSpeechAccent,
} from '../../../services/storage.ts'
import { ShortcutEditor } from '../components/ShortcutEditor.tsx'
import { SyncStatusPanel } from '../components/SyncStatusPanel.tsx'
import { useSyncStatus } from '../components/useSyncStatus.ts'
import {
  createBackup,
  exportBackup,
  exportSyncBackup,
  importSyncBackup,
} from '../../../services/backup.ts'
import { loadBackupStatus, subscribeBackupSignals } from '../../../services/backupStatus.ts'
import { loadUiPreferences, saveBackupReminder } from '../../../services/preferences.ts'
import type { BackupReminderFrequency } from '../../../services/preferences.ts'
import { backupReminder, dataOverview } from '../backupReminder.ts'
import { parseDeckFile } from '../../../services/transfer.ts'
import type { ParsedDeckFile } from '../../../services/backupTypes.ts'
import type { FrontSide, ReviewOrder, ReviewPrefs } from '../../../shared/types.ts'

type SettingsSection = 'learning' | 'interface' | 'overview' | 'backup' | 'trash'

export function SettingsPage({
  initialSection = 'learning',
  trashCount,
  onImport,
}: {
  initialSection?: SettingsSection
  trashCount: number
  onImport: (file: ParsedDeckFile) => { message: string } | { error: string }
}) {
  const { message: feedback } = AntApp.useApp()
  const { theme, changeTheme, error: themeError } = useAppTheme()
  const accent = useSyncExternalStore(
    subscribeSpeechAccent,
    loadSpeechAccent,
    () => 'en-US' as const,
  )
  const rate = useSyncExternalStore(subscribeSpeechRate, loadSpeechRate, () => 0.9 as const)
  const [prefs, setPrefs] = useState(loadPrefs)
  const [error, setError] = useState('')
  const [syncRefresh, setSyncRefresh] = useState(0)
  const [section, setSection] = useState<SettingsSection>(initialSection)
  const [, refreshData] = useReducer((value) => value + 1, 0)
  const file = createBackup()
  const overview = dataOverview(file)
  const lastBackup = loadBackupStatus()
  const reminderFrequency = loadUiPreferences().backupReminder ?? 'weekly'
  const reminder = backupReminder(reminderFrequency, lastBackup, file)
  const sync = useSyncStatus(syncRefresh)
  const syncAttention =
    !sync.checking &&
    sync.status &&
    (sync.status.kind === 'ready'
      ? sync.status.fileChanged || sync.status.contentDiffers
      : sync.status.kind === 'invalid')
  const [notice, setNotice] = useState<{
    type: 'success' | 'warning' | 'error'
    text: string
  } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const navRef = useRef<HTMLElement>(null)
  useEffect(() => {
    document.title = '偏好与数据 · 每日单词'
  }, [])
  useLayoutEffect(() => {
    function revealSelection() {
      const nav = navRef.current
      const active = nav?.querySelector<HTMLElement>('[aria-current="page"]')
      if (!nav || !active || nav.scrollWidth <= nav.clientWidth) return
      const bounds = nav.getBoundingClientRect()
      const selected = active.getBoundingClientRect()
      if (selected.left < bounds.left) nav.scrollLeft += selected.left - bounds.left
      else if (selected.right > bounds.right) nav.scrollLeft += selected.right - bounds.right
    }
    revealSelection()
    window.addEventListener('resize', revealSelection)
    return () => window.removeEventListener('resize', revealSelection)
  }, [section, syncAttention, trashCount])
  useEffect(() => subscribeReviewPrefs(() => setPrefs(loadPrefs())), [])
  useEffect(() => {
    const unsubscribe = subscribeBackupSignals(refreshData)
    window.addEventListener('focus', refreshData)
    return () => {
      unsubscribe()
      window.removeEventListener('focus', refreshData)
    }
  }, [])
  function updatePrefs(patch: Partial<ReviewPrefs>) {
    const next = { ...loadPrefs(), ...patch }
    if (!savePrefs(next)) {
      setError('复习偏好保存失败，请检查浏览器本地存储后重试。')
      return
    }
    setPrefs(next)
    setError('')
  }
  function backup() {
    const result = exportBackup()
    setNotice({ type: result.type, text: result.message })
    void feedback[result.type](result.message)
  }
  async function exportSync() {
    const result = await exportSyncBackup()
    if (result) setNotice({ type: result.type, text: result.message })
    if (result) void feedback[result.type](result.message)
    setSyncRefresh((value) => value + 1)
  }
  async function importSync() {
    try {
      const result = await importSyncBackup(onImport)
      setNotice(
        'error' in result
          ? { type: 'error', text: result.error }
          : { type: 'success', text: result.message },
      )
      if ('error' in result) void feedback.error(result.error)
      else void feedback.success(result.message)
    } catch {
      setNotice({ type: 'error', text: '读取同步文件失败，请确认应用通过本地项目启动。' })
      void feedback.error('读取同步文件失败，请确认应用通过本地项目启动。')
    } finally {
      setSyncRefresh((value) => value + 1)
    }
  }
  function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const parsed = parseDeckFile(typeof reader.result === 'string' ? reader.result : '')
      if ('error' in parsed) {
        setNotice({ type: 'error', text: parsed.error })
        void feedback.error(parsed.error)
        return
      }
      const result = onImport(parsed)
      setNotice(
        'error' in result
          ? { type: 'error', text: result.error }
          : { type: 'success', text: result.message },
      )
      if ('error' in result) void feedback.error(result.error)
      else void feedback.success(result.message)
      setSyncRefresh((value) => value + 1)
    }
    reader.onerror = () => {
      setNotice({ type: 'error', text: '文件读取失败，请重新选择。' })
      void feedback.error('文件读取失败，请重新选择。')
    }
    reader.readAsText(file)
  }
  return (
    <>
      <TopBar />
      <main className="page settings-page">
        <div className="page-head">
          <Typography.Title level={3}>偏好与数据</Typography.Title>
          <Typography.Paragraph type="secondary">
            按习惯调整学习方式，管理这台浏览器中的学习数据。修改后自动保存。
          </Typography.Paragraph>
        </div>
        {error || themeError ? <Alert type="error" showIcon title={error || themeError} /> : null}
        {reminder ? (
          <Alert
            className="settings-reminder"
            type="warning"
            showIcon
            title={reminder}
            action={
              <Button size="small" onClick={() => setSection('backup')}>
                前往备份
              </Button>
            }
          />
        ) : null}
        <div className="settings-layout">
          <nav ref={navRef} className="settings-nav" aria-label="偏好与数据分类">
            {(
              [
                ['learning', '学习偏好'],
                ['interface', '界面与快捷键'],
                ['overview', '数据概览'],
                ['backup', '备份与同步'],
                ['trash', '回收站'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={section === id ? 'is-active' : ''}
                aria-current={section === id ? 'page' : undefined}
                onClick={() => setSection(id)}
              >
                <span>{label}</span>
                {id === 'backup' && syncAttention ? (
                  <span className="settings-nav-status">需检查</span>
                ) : null}
                {id === 'trash' && trashCount > 0 ? (
                  <span className="settings-nav-count">{trashCount}</span>
                ) : null}
              </button>
            ))}
          </nav>
          <div className="settings-content">
            {section === 'learning' ? (
              <>
                <Card title="复习习惯" className="settings-card">
                  <div className="setting-row">
                    <div>
                      <h3 id="mode-label">默认模式</h3>
                      <p>英文看释义、中文回忆英文，或听音拼写。</p>
                    </div>
                    <Segmented<FrontSide>
                      aria-labelledby="mode-label"
                      value={prefs.front}
                      options={[
                        { label: '英文', value: 'english' },
                        { label: '中文', value: 'chinese' },
                        { label: '听写', value: 'dictation' },
                      ]}
                      onChange={(front) => updatePrefs({ front })}
                    />
                  </div>
                  <div className="setting-row">
                    <div>
                      <h3 id="order-label">默认顺序</h3>
                      <p>适用于单组、今日、整周、生词、历史错题和短时练习。</p>
                    </div>
                    <Segmented<ReviewOrder>
                      aria-labelledby="order-label"
                      value={prefs.order}
                      options={[
                        { label: '按顺序', value: 'sequential' },
                        { label: '随机', value: 'random' },
                      ]}
                      onChange={(order) => updatePrefs({ order })}
                    />
                  </div>
                  <Typography.Paragraph className="settings-note" type="secondary">
                    复习习惯用于新开始的练习；继续未完成练习时保留原模式、实际顺序和输入内容。在复习页调整模式或顺序，也会更新这里的默认值。
                  </Typography.Paragraph>
                </Card>
                <Card title="发音" className="settings-card">
                  <div className="setting-row">
                    <div>
                      <h3 id="accent-label">英语发音</h3>
                      <p>所有单词朗读和听写共用，需系统提供对应语音。</p>
                    </div>
                    <div className="setting-controls">
                      <Radio.Group
                        aria-labelledby="accent-label"
                        value={accent}
                        options={SPEECH_ACCENTS.map(({ value, short }) => ({
                          value,
                          label: short,
                        }))}
                        onChange={(event) =>
                          setError(
                            saveSpeechAccent(event.target.value)
                              ? ''
                              : '发音偏好保存失败，请重试。',
                          )
                        }
                      />
                      <SpeakButton english="Hello, welcome back." label="试听" />
                    </div>
                  </div>
                  <div className="setting-row">
                    <div>
                      <h3 id="rate-label">朗读语速</h3>
                      <p>全局应用于单词朗读、听写和试听。</p>
                    </div>
                    <Radio.Group
                      aria-labelledby="rate-label"
                      value={rate}
                      options={SPEECH_RATES.map(({ value, text }) => ({ value, label: text }))}
                      onChange={(event) =>
                        setError(saveSpeechRate(event.target.value) ? '' : '语速保存失败，请重试。')
                      }
                    />
                  </div>
                </Card>
              </>
            ) : null}
            {section === 'interface' ? (
              <>
                <Card title="界面主题" className="settings-card">
                  <div className="setting-row">
                    <div>
                      <h3 id="theme-label">界面主题</h3>
                      <p>应用到所有页面和弹窗。</p>
                    </div>
                    <Radio.Group
                      aria-labelledby="theme-label"
                      value={theme}
                      options={themeOptions.map(({ value, label }) => ({ value, label }))}
                      onChange={(event) => changeTheme(event.target.value)}
                    />
                  </div>
                </Card>
                <Card title="键盘快捷键" className="settings-card">
                  <ShortcutEditor />
                </Card>
              </>
            ) : null}
            {section === 'overview' ? (
              <Card title="数据概览" className="settings-card">
                <Typography.Paragraph type="secondary">
                  当前浏览器中的数据，不包含已删除单词卡内的词条。
                </Typography.Paragraph>
                <dl className="data-overview">
                  {(
                    [
                      ['单词卡', overview.decks, '组'],
                      ['单词', overview.words, '条'],
                      ['词组', overview.phrases, '条'],
                      ['语句', overview.sentences, '条'],
                      ['生词', overview.unfamiliar, '条'],
                      ['回收站', overview.trash, '组'],
                    ] as const
                  ).map(([label, count, unit]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>
                        <strong>{count}</strong> {unit}
                      </dd>
                    </div>
                  ))}
                </dl>
                <Typography.Text type="secondary" className="overview-backup-time">
                  最近完整备份：
                  {lastBackup
                    ? `${new Date(lastBackup.exportedAt).toLocaleString('zh-CN')}${lastBackup.origin === 'imported' ? '（来自导入备份）' : ''}`
                    : '暂无记录'}
                </Typography.Text>
              </Card>
            ) : null}
            {section === 'backup' ? (
              <>
                <Card title="备份与恢复" className="settings-card" id="backup">
                  <Typography.Paragraph type="secondary">
                    数据只保存在当前浏览器。清理浏览器或更换设备前，请导出完整备份；导入会合并并保留较新数据。
                  </Typography.Paragraph>
                  {notice ? (
                    <Alert
                      type={notice.type}
                      title={notice.text}
                      showIcon
                      closable
                      onClose={() => setNotice(null)}
                    />
                  ) : null}
                  <BackupStatusPanel />
                  <div className="setting-row backup-reminder-setting">
                    <div>
                      <h3 id="backup-reminder-label">备份提醒</h3>
                      <p>仅在本页提示；未备份、间隔到期或数据变化较多时提醒。</p>
                    </div>
                    <Radio.Group
                      aria-labelledby="backup-reminder-label"
                      value={reminderFrequency}
                      options={[
                        { label: '关闭', value: 'off' },
                        { label: '每周', value: 'weekly' },
                        { label: '每月', value: 'monthly' },
                      ]}
                      onChange={(event) =>
                        setError(
                          saveBackupReminder(event.target.value as BackupReminderFrequency)
                            ? ''
                            : '备份提醒设置保存失败，请重试。',
                        )
                      }
                    />
                  </div>
                  <SyncStatusPanel sync={sync} />
                  <div className="backup-actions">
                    <section aria-labelledby="file-backup-label">
                      <Typography.Text strong id="file-backup-label">
                        文件备份
                      </Typography.Text>
                      <p>下载完整备份，或选择备份文件导入。</p>
                      <Flex gap={10} wrap>
                        <Button onClick={backup}>导出全部数据</Button>
                        <Button icon={<UploadOutlined />} onClick={() => fileRef.current?.click()}>
                          导入备份
                        </Button>
                      </Flex>
                    </section>
                    <section aria-labelledby="git-sync-label">
                      <Typography.Text strong id="git-sync-label">
                        Git 同步
                      </Typography.Text>
                      <p>读写项目中的同步文件，再通过 Git 同步。</p>
                      <Flex gap={10} wrap>
                        <Button onClick={exportSync}>导出 Git 同步文件</Button>
                        <Button onClick={importSync}>导入 Git 同步文件</Button>
                      </Flex>
                    </section>
                  </div>
                  <section className="sync-guide" aria-labelledby="sync-guide-title">
                    <Typography.Text strong id="sync-guide-title">
                      多台电脑同步步骤
                    </Typography.Text>
                    <ol>
                      <li>
                        <strong>拉取 GitHub 更新：</strong>在项目目录运行 git pull。
                      </li>
                      <li>
                        <strong>导入 Git 同步文件：</strong>确认拉取后，使用上方导入按钮。
                      </li>
                      <li>
                        <strong>开始学习：</strong>数据自动保存在当前浏览器。
                      </li>
                      <li>
                        <strong>导出 Git 同步文件：</strong>学习结束后，使用上方导出按钮。
                      </li>
                      <li>
                        <strong>提交并推送：</strong>检查 Git 变更后提交同步文件并推送。
                      </li>
                    </ol>
                    <p>
                      首次同步可先从已有数据的电脑导出。同步文件为
                      sync/english-sync.json；需要通过本地项目启动，Git 操作需手动执行。应用无法确认
                      GitHub 的拉取或推送状态。
                    </p>
                  </section>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="application/json,.json"
                    hidden
                    onChange={importFile}
                  />
                </Card>
              </>
            ) : null}
            {section === 'trash' ? (
              <>
                <Card title="回收站" className="settings-card">
                  <div className="setting-row">
                    <div>
                      <h3>已删除的单词卡{trashCount ? ` · ${trashCount} 组` : ''}</h3>
                      <p>可恢复单词卡及附带草稿与有效进度，不自动清空。</p>
                    </div>
                    <Button href="#/trash">打开回收站</Button>
                  </div>
                </Card>{' '}
              </>
            ) : null}
          </div>
        </div>
      </main>
    </>
  )
}
