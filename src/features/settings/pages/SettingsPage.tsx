import {
  loadSpeechRate,
  saveSpeechRate,
  subscribeSpeechRate,
  SPEECH_RATES,
} from '../../../services/speechRate.ts'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { ChangeEvent } from 'react'
import { Alert, Button, Card, Flex, Radio, Segmented, Typography } from 'antd'
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
import { exportBackup, exportSyncBackup, importSyncBackup } from '../../../services/backup.ts'
import { parseDeckFile } from '../../../services/transfer.ts'
import type { ParsedDeckFile } from '../../../services/backupTypes.ts'
import type { FrontSide, ReviewOrder, ReviewPrefs } from '../../../shared/types.ts'

export function SettingsPage({
  trashCount,
  onImport,
}: {
  trashCount: number
  onImport: (file: ParsedDeckFile) => { message: string } | { error: string }
}) {
  const { theme, changeTheme, error: themeError } = useAppTheme()
  const accent = useSyncExternalStore(
    subscribeSpeechAccent,
    loadSpeechAccent,
    () => 'en-US' as const,
  )
  const rate = useSyncExternalStore(subscribeSpeechRate, loadSpeechRate, () => 0.9 as const)
  const [prefs, setPrefs] = useState(loadPrefs)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState<{
    type: 'success' | 'warning' | 'error'
    text: string
  } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    document.title = '偏好与数据 · 每日单词'
  }, [])
  useEffect(() => subscribeReviewPrefs(() => setPrefs(loadPrefs())), [])
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
  }
  async function exportSync() {
    const result = await exportSyncBackup()
    if (result) setNotice({ type: result.type, text: result.message })
  }
  async function importSync() {
    try {
      const result = await importSyncBackup(onImport)
      setNotice(
        'error' in result
          ? { type: 'error', text: result.error }
          : { type: 'success', text: result.message },
      )
    } catch {
      setNotice({ type: 'error', text: '读取同步文件失败，请确认应用通过本地项目启动。' })
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
        return
      }
      const result = onImport(parsed)
      setNotice(
        'error' in result
          ? { type: 'error', text: result.error }
          : { type: 'success', text: result.message },
      )
    }
    reader.onerror = () => setNotice({ type: 'error', text: '文件读取失败，请重新选择。' })
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
        <Card title="外观与发音" className="settings-card">
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
          <div className="setting-row">
            <div>
              <h3 id="accent-label">英语发音</h3>
              <p>所有单词朗读和听写共用，需系统提供对应语音。</p>
            </div>
            <div className="setting-controls">
              <Radio.Group
                aria-labelledby="accent-label"
                value={accent}
                options={SPEECH_ACCENTS.map(({ value, short }) => ({ value, label: short }))}
                onChange={(event) =>
                  setError(saveSpeechAccent(event.target.value) ? '' : '发音偏好保存失败，请重试。')
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
        <Card title="键盘快捷键" className="settings-card">
          <ShortcutEditor />
        </Card>
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
          <BackupStatusPanel onExport={backup} />
          <Flex gap={10} wrap>
            <Button icon={<UploadOutlined />} onClick={() => fileRef.current?.click()}>
              导入备份
            </Button>
            <Button onClick={exportSync}>导出 Git 同步文件</Button>
            <Button onClick={importSync}>导入 Git 同步文件</Button>
          </Flex>
          <Typography.Paragraph className="settings-note" type="secondary">
            多台电脑同步：先拉取 Git 更新并导入同步文件；学习后导出，再提交并推送。
            文件固定保存在项目的 sync/english-sync.json，无需选择路径；此功能需要通过本地项目启动。
            备份包含学习记录和偏好，提交到 GitHub 前请确认仓库的可见性。
          </Typography.Paragraph>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={importFile}
          />
        </Card>
        <Card title="回收站" className="settings-card">
          <div className="setting-row">
            <div>
              <h3>已删除的单词卡{trashCount ? ` · ${trashCount} 组` : ''}</h3>
              <p>可恢复单词卡及附带草稿与有效进度，不自动清空。</p>
            </div>
            <Button href="#/trash">打开回收站</Button>
          </div>
        </Card>
      </main>
    </>
  )
}
