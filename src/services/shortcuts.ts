import { APP_DATA_RESTORED } from './events.ts'

export const SHORTCUTS_KEY = 'english-daily-shortcuts'
export const SHORTCUTS_CHANGED = 'english-daily-shortcuts-changed'
export const SHORTCUT_IDS = ['speak', 'flip', 'unknown', 'known', 'previous', 'next'] as const
export type ShortcutId = (typeof SHORTCUT_IDS)[number]
export type Shortcuts = Record<ShortcutId, string>

export const SHORTCUT_ACTIONS: ReadonlyArray<{ id: ShortcutId; label: string; detail: string }> = [
  {
    id: 'speak',
    label: '朗读',
    detail: '播放当前单词。只设置单个字母或数字时，输入拼写改为按住 Alt 再按这个键。',
  },
  { id: 'flip', label: '翻面', detail: '显示或翻回答案。' },
  { id: 'unknown', label: '不认识', detail: '翻开答案后标记不认识，并进入下一张。' },
  { id: 'known', label: '认识', detail: '翻开答案后标记认识，并进入下一张。' },
  { id: 'previous', label: '上一张', detail: '回到上一张卡片。' },
  { id: 'next', label: '下一张', detail: '还没作答时先翻面，作答后进入下一张。' },
]

export const DEFAULT_SHORTCUTS: Shortcuts = {
  speak: 'KeyP',
  flip: 'Space',
  unknown: 'Digit1',
  known: 'Digit2',
  previous: 'ArrowLeft',
  next: 'ArrowRight',
}

const ALLOWED = new Set([
  'Space',
  'Enter',
  'Backspace',
  ...Array.from({ length: 26 }, (_, index) => `Key${String.fromCharCode(65 + index)}`),
  ...Array.from({ length: 10 }, (_, index) => `Digit${index}`),
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
])

const MODIFIER_ORDER = ['Meta', 'Ctrl', 'Alt', 'Shift'] as const
const MODIFIER_LABELS: Record<(typeof MODIFIER_ORDER)[number], string> = {
  Meta: 'Command',
  Ctrl: 'Ctrl',
  Alt: 'Alt',
  Shift: 'Shift',
}
const MODIFIER_ARIA: Record<(typeof MODIFIER_ORDER)[number], string> = {
  Meta: 'Meta',
  Ctrl: 'Control',
  Alt: 'Alt',
  Shift: 'Shift',
}
const MODIFIER_CODES = new Set([
  'MetaLeft',
  'MetaRight',
  'ControlLeft',
  'ControlRight',
  'AltLeft',
  'AltRight',
  'ShiftLeft',
  'ShiftRight',
])
const NAMES: Record<string, string> = {
  Space: '空格',
  Enter: 'Enter',
  Backspace: '退格',
  ArrowLeft: '←',
  ArrowRight: '→',
  ArrowUp: '↑',
  ArrowDown: '↓',
}

let cacheKey = '\u0000'
let cache: Shortcuts = DEFAULT_SHORTCUTS

export function normalizeShortcut(value: string): string | null {
  const parts = value.split('+').filter(Boolean)
  const code = parts.at(-1)
  if (!code || !ALLOWED.has(code)) return null
  const modifiers = parts.slice(0, -1)
  if (
    new Set(modifiers).size !== modifiers.length ||
    modifiers.some((item) => !MODIFIER_ORDER.includes(item as (typeof MODIFIER_ORDER)[number]))
  )
    return null
  return [...MODIFIER_ORDER.filter((item) => modifiers.includes(item)), code].join('+')
}

export function isShortcuts(value: unknown): value is Shortcuts {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  if (Object.keys(record).length !== SHORTCUT_IDS.length) return false
  const codes = SHORTCUT_IDS.map((id) => record[id])
  return (
    codes.every((code) => typeof code === 'string' && normalizeShortcut(code) === code) &&
    new Set(codes).size === codes.length
  )
}

function keyLabel(code: string): string {
  if (NAMES[code]) return NAMES[code]
  if (code.startsWith('Key') && code.length === 4) return code.slice(3)
  if (code.startsWith('Digit') && code.length === 6) return code.slice(5)
  return code
}

export function shortcutLabel(binding: string): string {
  return binding
    .split('+')
    .map((part) => MODIFIER_LABELS[part as (typeof MODIFIER_ORDER)[number]] ?? keyLabel(part))
    .join('+')
}

export function shortcutAria(binding: string): string {
  return binding
    .split('+')
    .map((part) => MODIFIER_ARIA[part as (typeof MODIFIER_ORDER)[number]] ?? keyLabel(part))
    .join('+')
}

export function hasModifier(binding: string): boolean {
  return binding.includes('+')
}

export function speakTypingLabel(binding: string): string {
  const label = shortcutLabel(binding)
  return hasModifier(binding) ? label : `Alt+${label}`
}

export function loadShortcuts(): Shortcuts {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(SHORTCUTS_KEY)
  } catch {
    raw = null
  }
  const key = raw ?? ''
  if (key === cacheKey) return cache
  cacheKey = key
  try {
    const value: unknown = JSON.parse(raw ?? 'null')
    cache = isShortcuts(value) ? value : DEFAULT_SHORTCUTS
  } catch {
    cache = DEFAULT_SHORTCUTS
  }
  return cache
}

export function saveShortcuts(value: Shortcuts): boolean {
  if (!isShortcuts(value)) return false
  try {
    localStorage.setItem(SHORTCUTS_KEY, JSON.stringify(value))
    window.dispatchEvent(new Event(SHORTCUTS_CHANGED))
    return true
  } catch {
    return false
  }
}

export function saveShortcut(id: ShortcutId, code: string): true | string {
  const normalized = normalizeShortcut(code)
  if (!normalized) return '这个按键不能用作快捷键。'
  const next = { ...loadShortcuts(), [id]: normalized }
  const conflict = SHORTCUT_IDS.find((item) => item !== id && next[item] === normalized)
  if (conflict)
    return `这个键已经用于「${SHORTCUT_ACTIONS.find((item) => item.id === conflict)?.label ?? '其他操作'}」。`
  return saveShortcuts(next) ? true : '快捷键保存失败，请检查浏览器本地存储。'
}

export function subscribeShortcuts(listener: () => void) {
  const update = () => {
    cacheKey = '\u0000'
    listener()
  }
  const storage = (event: StorageEvent) => {
    if (event.key === SHORTCUTS_KEY || event.key === null) update()
  }
  window.addEventListener(SHORTCUTS_CHANGED, update)
  window.addEventListener(APP_DATA_RESTORED, update)
  window.addEventListener('storage', storage)
  return () => {
    window.removeEventListener(SHORTCUTS_CHANGED, update)
    window.removeEventListener(APP_DATA_RESTORED, update)
    window.removeEventListener('storage', storage)
  }
}

export function chordFromEvent(
  event: Pick<KeyboardEvent, 'code' | 'key' | 'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey'>,
): string | null {
  if (MODIFIER_CODES.has(event.code)) return null
  const code = ALLOWED.has(event.code)
    ? event.code
    : event.code.startsWith('Numpad') && /^[0-9]$/.test(event.key)
      ? `Digit${event.key}`
      : ''
  if (!code) return null
  return [
    ...MODIFIER_ORDER.filter((item) =>
      item === 'Meta'
        ? event.metaKey
        : item === 'Ctrl'
          ? event.ctrlKey
          : item === 'Alt'
            ? event.altKey
            : event.shiftKey,
    ),
    code,
  ].join('+')
}

export function matchesShortcut(
  event: Pick<KeyboardEvent, 'code' | 'key' | 'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey'>,
  binding: string,
): boolean {
  return chordFromEvent(event) === binding
}

/** Retry advance aliases are available only when they do not override a custom action. */
export function retryAdvanceAliases(shortcuts: Shortcuts): string[] {
  return ['Enter', 'Meta+Enter', 'Ctrl+Enter'].filter(
    (binding) => !SHORTCUT_IDS.some((id) => id !== 'next' && shortcuts[id] === binding),
  )
}

export function matchesSpeakShortcut(
  event: Pick<KeyboardEvent, 'code' | 'key' | 'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey'>,
  binding: string,
  typing: boolean,
): boolean {
  if (matchesShortcut(event, binding)) return !typing || hasModifier(binding)
  if (hasModifier(binding) || !event.altKey || event.metaKey || event.ctrlKey || event.shiftKey)
    return false
  return (
    chordFromEvent({
      code: event.code,
      key: event.key,
      metaKey: false,
      ctrlKey: false,
      altKey: false,
      shiftKey: false,
    }) === binding
  )
}
