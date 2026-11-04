import { useEffect, useState, useSyncExternalStore } from 'react'
import { Alert, Button, Typography } from 'antd'
import {
  DEFAULT_SHORTCUTS,
  SHORTCUT_ACTIONS,
  chordFromEvent,
  loadShortcuts,
  saveShortcut,
  saveShortcuts,
  shortcutLabel,
  subscribeShortcuts,
} from '../../../services/shortcuts.ts'
import type { ShortcutId } from '../../../services/shortcuts.ts'

export function ShortcutEditor() {
  const shortcuts = useSyncExternalStore(subscribeShortcuts, loadShortcuts, loadShortcuts)
  const [recording, setRecording] = useState<ShortcutId | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!recording) return
    const id = recording
    function onKey(event: KeyboardEvent) {
      if (event.repeat || event.isComposing) return
      if (
        [
          'MetaLeft',
          'MetaRight',
          'ControlLeft',
          'ControlRight',
          'AltLeft',
          'AltRight',
          'ShiftLeft',
          'ShiftRight',
        ].includes(event.code)
      )
        return
      event.preventDefault()
      event.stopPropagation()
      if (
        event.key === 'Escape' &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !event.shiftKey
      ) {
        setRecording(null)
        return
      }
      const chord = chordFromEvent(event)
      if (!chord) {
        setError('这个按键不能用作快捷键。')
        return
      }
      const result = saveShortcut(id, chord)
      if (result !== true) {
        setError(result)
        return
      }
      setError('')
      setRecording(null)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [recording])

  function reset() {
    setRecording(null)
    setError(saveShortcuts(DEFAULT_SHORTCUTS) ? '' : '快捷键保存失败，请检查浏览器本地存储。')
  }

  return (
    <>
      {error ? <Alert type="error" showIcon title={error} /> : null}
      {SHORTCUT_ACTIONS.map((action) => (
        <div className="setting-row" key={action.id}>
          <div>
            <h3>{action.label}</h3>
            <p>{action.detail}</p>
          </div>
          <div className="setting-controls">
            <span className="shortcut-key">{shortcutLabel(shortcuts[action.id])}</span>
            <Button
              type={recording === action.id ? 'primary' : 'default'}
              onClick={() => {
                setError('')
                setRecording(action.id)
              }}
            >
              {recording === action.id ? '请按快捷键' : '修改'}
            </Button>
          </div>
        </div>
      ))}
      <div className="shortcut-reset">
        <Button onClick={reset}>恢复默认快捷键</Button>
      </div>
      <Typography.Paragraph className="settings-note" type="secondary">
        {
          '复习、听写、每周复习、生词和错题练习共用这些快捷键，修改后立即生效，并会写入完整备份。可以设置单个键，也可以设置 Command、Ctrl、Alt、Shift 组合键。提交拼写仍是 Enter，离开复习仍是 Esc。'
        }
      </Typography.Paragraph>
    </>
  )
}
