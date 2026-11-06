import { APP_DATA_RESTORED } from './events.ts'

export const UI_PREFERENCES_KEY = 'english-daily-ui-preferences'
export const PANEL_IDS = ['today', 'weekly', 'unfamiliar', 'search'] as const
export type PanelId = (typeof PANEL_IDS)[number]
export interface UiPreferences {
  collapsedPanels: PanelId[]
  backupReminder?: BackupReminderFrequency
}
export type BackupReminderFrequency = 'off' | 'weekly' | 'monthly'
const CHANGED = 'english-daily-ui-changed'
let fallback: string | null = null
export const defaultUiPreferences = (): UiPreferences => ({ collapsedPanels: [...PANEL_IDS] })

export function isUiPreferences(value: unknown): value is UiPreferences {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const panels = (value as Record<string, unknown>).collapsedPanels
  const reminder = (value as Record<string, unknown>).backupReminder
  return (
    (reminder === undefined ||
      reminder === 'off' ||
      reminder === 'weekly' ||
      reminder === 'monthly') &&
    Array.isArray(panels) &&
    panels.every((id) => PANEL_IDS.includes(id as PanelId)) &&
    new Set(panels).size === panels.length
  )
}

export function uiSnapshot(): string | null {
  try {
    return fallback ?? localStorage.getItem(UI_PREFERENCES_KEY)
  } catch {
    return fallback
  }
}

export function parseUiPreferences(raw: string | null): UiPreferences {
  try {
    const value: unknown = JSON.parse(raw ?? 'null')
    return isUiPreferences(value) ? value : defaultUiPreferences()
  } catch {
    return defaultUiPreferences()
  }
}

export function loadUiPreferences(): UiPreferences {
  return parseUiPreferences(uiSnapshot())
}

export function togglePanel(id: PanelId) {
  const current = loadUiPreferences()
  const collapsedPanels = current.collapsedPanels.includes(id)
    ? current.collapsedPanels.filter((item) => item !== id)
    : [...current.collapsedPanels, id]
  const value = JSON.stringify({ ...current, collapsedPanels })
  try {
    localStorage.setItem(UI_PREFERENCES_KEY, value)
    fallback = null
  } catch {
    fallback = value
  }
  window.dispatchEvent(new Event(CHANGED))
}

export function saveBackupReminder(frequency: BackupReminderFrequency): boolean {
  try {
    localStorage.setItem(
      UI_PREFERENCES_KEY,
      JSON.stringify({ ...loadUiPreferences(), backupReminder: frequency }),
    )
    fallback = null
    window.dispatchEvent(new Event(CHANGED))
    return true
  } catch {
    return false
  }
}

export function subscribeUiPreferences(listener: () => void) {
  const storage = (event: StorageEvent) => {
    if (event.key === UI_PREFERENCES_KEY || event.key === null) {
      fallback = null
      listener()
    }
  }
  const restored = () => {
    fallback = null
    listener()
  }
  window.addEventListener(CHANGED, listener)
  window.addEventListener('storage', storage)
  window.addEventListener(APP_DATA_RESTORED, restored)
  return () => {
    window.removeEventListener(CHANGED, listener)
    window.removeEventListener('storage', storage)
    window.removeEventListener(APP_DATA_RESTORED, restored)
  }
}
