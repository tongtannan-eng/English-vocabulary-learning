import { getTodayWords } from './learning.ts'
import { todayISO } from '../../shared/utils/format.ts'
import type { Deck } from '../../shared/types.ts'

export const QUICK_LIMITS = [5, 10, 20] as const
export type QuickLimit = (typeof QUICK_LIMITS)[number]
export function quickKey(date: string, limit: QuickLimit) {
  return `quick:${date}:${limit}`
}
export function quickPath(date: string, limit: QuickLimit) {
  return `/review-quick/${date}/${limit}`
}
export function quickWords(decks: readonly Deck[], limit: QuickLimit, date = todayISO()) {
  const seen = new Set<string>()
  return getTodayWords(decks, date)
    .words.filter((word) => {
      const key = JSON.stringify([
        word.english.normalize('NFC').trim().toLowerCase().replace(/\s+/g, ' '),
        word.chinese.trim(),
      ])
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, limit)
}
