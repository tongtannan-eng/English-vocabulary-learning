import type { SpellingMode } from '../features/study/spellingErrors.ts'
import type { QuickLimit } from '../features/study/quick.ts'
import { getMonthRange, getWeekRange, parseISODate, todayISO } from '../shared/utils/format.ts'

export type Route =
  | { name: 'list' }
  | { name: 'sentences' }
  | { name: 'phrases' }
  | { name: 'practice' }
  | { name: 'settings'; section?: 'trash' }
  | { name: 'edit'; deckId?: string }
  | { name: 'review'; deckId: string }
  | { name: 'spelling-errors' }
  | { name: 'review-errors'; mode: SpellingMode }
  | { name: 'mistakes' }
  | { name: 'review-mistakes' }
  | { name: 'unfamiliar' }
  | { name: 'review-unfamiliar' }
  | { name: 'weekly'; weekStart: string }
  | { name: 'review-weekly'; weekStart: string }
  | { name: 'monthly'; monthStart: string }
  | { name: 'review-monthly'; monthStart: string }
  | { name: 'review-random'; limit: QuickLimit }
  | { name: 'review-random-text'; kind: 'phrases' | 'sentences'; limit: QuickLimit }
  | { name: 'review-today'; date: string }
  | { name: 'records' }
  | { name: 'trash' }
  | { name: 'review-quick'; date: string; limit: QuickLimit }

export function parseHash(hash: string): Route {
  const path = hash.replace(/^#/, '') || '/'
  if (path === '/' || path === '') return { name: 'list' }
  if (path === '/sentences') return { name: 'sentences' }
  if (path === '/phrases') return { name: 'phrases' }
  if (path === '/practice') return { name: 'practice' }
  if (path === '/settings') return { name: 'settings' }
  if (path === '/settings/trash') return { name: 'settings', section: 'trash' }
  if (path === '/new') return { name: 'edit' }
  if (path === '/trash') return { name: 'trash' }
  const quick = /^\/review-quick\/(\d{4}-\d{2}-\d{2})\/(5|10|20)$/.exec(path)
  if (quick?.[1] && parseISODate(quick[1]))
    return { name: 'review-quick', date: quick[1], limit: Number(quick[2]) as QuickLimit }
  if (path === '/records') return { name: 'records' }
  if (path === '/review-today') return { name: 'review-today', date: todayISO() }
  const daily = /^\/review-today\/(\d{4}-\d{2}-\d{2})$/.exec(path)
  if (daily?.[1] && parseISODate(daily[1])) return { name: 'review-today', date: daily[1] }
  if (path === '/spelling-errors') return { name: 'spelling-errors' }
  const errors = /^\/review-errors\/(chinese|dictation)$/.exec(path)
  if (errors?.[1]) return { name: 'review-errors', mode: errors[1] as SpellingMode }
  if (path === '/mistakes') return { name: 'mistakes' }
  if (path === '/review-mistakes') return { name: 'review-mistakes' }
  if (path === '/unfamiliar') return { name: 'unfamiliar' }
  if (path === '/review-unfamiliar') return { name: 'review-unfamiliar' }
  if (path === '/weekly') return { name: 'weekly', weekStart: getWeekRange().start }
  if (path === '/monthly') return { name: 'monthly', monthStart: getMonthRange().start }
  const monthly = /^\/(monthly|review-monthly)\/(\d{4}-\d{2}-\d{2})$/.exec(path)
  if (monthly?.[2] && parseISODate(monthly[2]))
    return {
      name: monthly[1] === 'monthly' ? 'monthly' : 'review-monthly',
      monthStart: getMonthRange(monthly[2]).start,
    }
  const random = /^\/review-random\/(5|10|20)$/.exec(path)
  if (random?.[1]) return { name: 'review-random', limit: Number(random[1]) as QuickLimit }
  const randomText = /^\/review-random\/(phrases|sentences)\/(5|10|20)$/.exec(path)
  if (randomText?.[1] && randomText[2])
    return {
      name: 'review-random-text',
      kind: randomText[1] as 'phrases' | 'sentences',
      limit: Number(randomText[2]) as QuickLimit,
    }
  const weekly = /^\/(weekly|review-weekly)\/(\d{4}-\d{2}-\d{2})$/.exec(path)
  if (weekly?.[2] && parseISODate(weekly[2])) {
    return {
      name: weekly[1] === 'weekly' ? 'weekly' : 'review-weekly',
      weekStart: getWeekRange(weekly[2]).start,
    }
  }
  const edit = /^\/edit\/([^/]+)$/.exec(path)
  if (edit?.[1]) return { name: 'edit', deckId: decodeURIComponent(edit[1]) }
  const review = /^\/review\/([^/]+)$/.exec(path)
  if (review?.[1]) return { name: 'review', deckId: decodeURIComponent(review[1]) }
  return { name: 'list' }
}

export function navigate(path: string): void {
  const next = path.startsWith('#') ? path : `#${path}`
  if (window.location.hash === next) {
    window.dispatchEvent(new HashChangeEvent('hashchange'))
    return
  }
  window.location.hash = next
}
