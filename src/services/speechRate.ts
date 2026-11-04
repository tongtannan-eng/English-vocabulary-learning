import { APP_DATA_RESTORED } from './events.ts'

export const SPEECH_RATE_KEY = 'english-daily-speech-rate'
export const SPEECH_RATE_CHANGED = 'english-daily-speech-rate-changed'
export const SPEECH_RATES = [
  { value: 0.7, label: '慢速', text: '慢速 0.7×' },
  { value: 0.9, label: '常速', text: '常速 0.9×' },
  { value: 1.1, label: '稍快', text: '稍快 1.1×' },
] as const
export type SpeechRate = (typeof SPEECH_RATES)[number]['value']
export function isSpeechRate(value: unknown): value is SpeechRate {
  return SPEECH_RATES.some((item) => item.value === value)
}
export function loadSpeechRate(): SpeechRate {
  try {
    const value = Number(localStorage.getItem(SPEECH_RATE_KEY))
    return isSpeechRate(value) ? value : 0.9
  } catch {
    return 0.9
  }
}
export function saveSpeechRate(value: SpeechRate): boolean {
  if (!isSpeechRate(value)) return false
  try {
    localStorage.setItem(SPEECH_RATE_KEY, String(value))
    window.dispatchEvent(new Event(SPEECH_RATE_CHANGED))
    return true
  } catch {
    return false
  }
}
export function subscribeSpeechRate(listener: () => void) {
  const storage = (event: StorageEvent) => {
    if (event.key === SPEECH_RATE_KEY || event.key === null) listener()
  }
  window.addEventListener(SPEECH_RATE_CHANGED, listener)
  window.addEventListener(APP_DATA_RESTORED, listener)
  window.addEventListener('storage', storage)
  return () => {
    window.removeEventListener(SPEECH_RATE_CHANGED, listener)
    window.removeEventListener(APP_DATA_RESTORED, listener)
    window.removeEventListener('storage', storage)
  }
}
