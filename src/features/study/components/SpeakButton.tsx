import { loadSpeechRate, subscribeSpeechRate, SPEECH_RATES } from '../../../services/speechRate.ts'
import { HoverDropdown } from '../../../shared/components/HoverDropdown.tsx'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { DownOutlined, SoundOutlined } from '@ant-design/icons'
import { Button, Space, Typography } from 'antd'
import { SPEECH_ACCENTS, speakEnglish, stopSpeaking } from '../speak.ts'
import {
  loadSpeechAccent,
  saveSpeechAccent,
  subscribeSpeechAccent,
} from '../../../services/storage.ts'
import {
  hasModifier,
  loadShortcuts,
  shortcutAria,
  shortcutLabel,
  speakTypingLabel,
  subscribeShortcuts,
} from '../../../services/shortcuts.ts'
import type { SpeechAccent } from '../../../shared/types.ts'

export function SpeakButton({
  english,
  className,
  hideWord = false,
  label,
  listenHotkey = false,
}: {
  english: string
  className?: string
  hideWord?: boolean
  label?: string
  listenHotkey?: boolean
}) {
  const [error, setError] = useState('')
  const requestRef = useRef(0)
  const accent = useSyncExternalStore<SpeechAccent>(
    subscribeSpeechAccent,
    loadSpeechAccent,
    () => 'en-US',
  )
  const rate = useSyncExternalStore(subscribeSpeechRate, loadSpeechRate, () => 0.9 as const)
  const speed = SPEECH_RATES.find((item) => item.value === rate)!
  const selected = SPEECH_ACCENTS.find((item) => item.value === accent)!
  const shortcuts = useSyncExternalStore(subscribeShortcuts, loadShortcuts, loadShortcuts)
  const speakKey = shortcutLabel(shortcuts.speak)

  useEffect(
    () => () => {
      requestRef.current += 1
      stopSpeaking()
    },
    [english],
  )

  useEffect(
    () => () => {
      requestRef.current += 1
      stopSpeaking()
    },
    [rate, accent],
  )

  function speak() {
    const request = ++requestRef.current
    setError('')
    void speakEnglish(english, accent, rate).catch((reason: unknown) => {
      if (request !== requestRef.current) return
      setError(reason instanceof Error ? reason.message : '朗读失败，请重试。')
    })
  }

  const speakRef = useRef(speak)
  useEffect(() => {
    speakRef.current = speak
  })
  useEffect(() => {
    if (!listenHotkey) return
    const onSpeak = () => speakRef.current()
    window.addEventListener('english-daily-speak', onSpeak)
    return () => window.removeEventListener('english-daily-speak', onSpeak)
  }, [listenHotkey])

  return (
    <div className={className}>
      <Space.Compact>
        <Button
          icon={<SoundOutlined />}
          aria-label={`朗读 ${hideWord ? '听写单词' : english}（${selected.label}，${speed.text}）`}
          title={`用${selected.label}朗读 · ${speed.text}${listenHotkey ? ` · 快捷键 ${speakKey}，输入时按 ${speakTypingLabel(shortcuts.speak)}` : ''}`}
          aria-keyshortcuts={
            listenHotkey
              ? hasModifier(shortcuts.speak)
                ? shortcutAria(shortcuts.speak)
                : `${shortcutAria(shortcuts.speak)} Alt+${shortcutAria(shortcuts.speak)}`
              : undefined
          }
          onClick={speak}
        >
          {label ? `${label} · ${selected.short}` : selected.short}
          {rate !== 0.9 ? ` · ${speed.label}` : ''}
        </Button>
        <HoverDropdown
          menu={{
            selectable: true,
            selectedKeys: [accent],
            items: SPEECH_ACCENTS.map((item) => ({ key: item.value, label: item.label })),
            onClick: ({ key }) => {
              const next = SPEECH_ACCENTS.find((item) => item.value === key)
              if (!next) return
              requestRef.current += 1
              stopSpeaking()
              setError(
                saveSpeechAccent(next.value) ? '' : '发音偏好保存失败，请检查浏览器本地存储。',
              )
            },
          }}
        >
          <Button
            icon={<DownOutlined />}
            aria-label={hideWord ? '选择听写发音' : `选择 ${english} 的发音`}
            title="选择发音"
          />
        </HoverDropdown>
      </Space.Compact>
      {error ? (
        <Typography.Text className="speech-error" type="danger" role="alert">
          {error}
        </Typography.Text>
      ) : null}
    </div>
  )
}
