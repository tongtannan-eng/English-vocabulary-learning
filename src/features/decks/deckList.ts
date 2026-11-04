import { parseISODate } from '../../shared/utils/format.ts'
import type { Deck } from '../../shared/types.ts'

export const DECK_PAGE_SIZE = 20
export type DeckStatusFilter = 'all' | 'unfamiliar' | 'unreviewed' | 'mastered'

export interface DeckListView {
  query: string
  startDate: string
  endDate: string
  status: DeckStatusFilter
  page: number
  collapsedMonths: string[]
  expandedDeckIds: string[]
  scrollY: number
}

export function defaultDeckListView(): DeckListView {
  return {
    query: '',
    startDate: '',
    endDate: '',
    status: 'all',
    page: 1,
    collapsedMonths: [],
    expandedDeckIds: [],
    scrollY: 0,
  }
}

export function unfamiliarWordCount(deck: Deck): number {
  return deck.words.filter((word) => word.familiarity === 'unknown').length
}

export function filterDeckList(decks: readonly Deck[], view: DeckListView): Deck[] {
  const terms = view.query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  return decks
    .filter((deck) => {
      if (view.startDate && deck.date < view.startDate) return false
      if (view.endDate && deck.date > view.endDate) return false
      if (
        view.status === 'unfamiliar' &&
        !deck.words.some((word) => word.familiarity === 'unknown')
      )
        return false
      if (
        view.status === 'unreviewed' &&
        !deck.words.some((word) => word.familiarity === undefined)
      )
        return false
      if (
        view.status === 'mastered' &&
        (deck.words.length === 0 || !deck.words.every((word) => word.familiarity === 'known'))
      )
        return false
      if (terms.length === 0) return true
      const text = [deck.title, ...deck.words.flatMap((word) => [word.english, word.chinese])]
        .join(' ')
        .toLowerCase()
      return terms.every((term) => text.includes(term))
    })
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) || b.createdAt - a.createdAt || a.id.localeCompare(b.id),
    )
}

export function deckMonth(date: string): string {
  return parseISODate(date) ? date.slice(0, 7) : 'unknown'
}

export function formatMonth(month: string): string {
  if (month === 'unknown') return '日期未分类'
  const [year, number] = month.split('-')
  return `${year}年${Number(number)}月`
}

export function paginateDeckList(filtered: readonly Deck[], requestedPage: number) {
  const pageCount = Math.max(1, Math.ceil(filtered.length / DECK_PAGE_SIZE))
  const safePage = Number.isFinite(requestedPage) ? Math.floor(requestedPage) : 1
  const page = Math.min(pageCount, Math.max(1, safePage))
  const monthTotals = new Map<string, number>()
  for (const deck of filtered) {
    const month = deckMonth(deck.date)
    monthTotals.set(month, (monthTotals.get(month) ?? 0) + 1)
  }
  const groups: Array<{ month: string; total: number; decks: Deck[] }> = []
  for (const deck of filtered.slice((page - 1) * DECK_PAGE_SIZE, page * DECK_PAGE_SIZE)) {
    const month = deckMonth(deck.date)
    const group = groups.find((item) => item.month === month)
    if (group) group.decks.push(deck)
    else groups.push({ month, total: monthTotals.get(month)!, decks: [deck] })
  }
  return { page, pageCount, groups }
}

export const LIST_VIEW_KEY = 'english-daily-list-view'
let memoryView: DeckListView | undefined

export function parseDeckListView(raw: string | null): DeckListView {
  const fallback = defaultDeckListView()
  if (!raw) return fallback
  try {
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== 'object' || Array.isArray(value)) return fallback
    const saved = value as Record<string, unknown>
    const date = (input: unknown) => (typeof input === 'string' && parseISODate(input) ? input : '')
    const strings = (input: unknown) =>
      Array.isArray(input) ? input.filter((item): item is string => typeof item === 'string') : []
    const startDate = date(saved.startDate)
    const endDate = date(saved.endDate)
    return {
      query: typeof saved.query === 'string' ? saved.query : '',
      startDate: startDate && endDate && startDate > endDate ? '' : startDate,
      endDate: startDate && endDate && startDate > endDate ? '' : endDate,
      status:
        saved.status === 'unfamiliar' ||
        saved.status === 'unreviewed' ||
        saved.status === 'mastered'
          ? saved.status
          : 'all',
      page:
        typeof saved.page === 'number' && Number.isFinite(saved.page)
          ? Math.max(1, Math.floor(saved.page))
          : 1,
      collapsedMonths: strings(saved.collapsedMonths),
      expandedDeckIds: strings(saved.expandedDeckIds),
      scrollY:
        typeof saved.scrollY === 'number' && Number.isFinite(saved.scrollY)
          ? Math.max(0, saved.scrollY)
          : 0,
    }
  } catch {
    return fallback
  }
}

export function loadDeckListView(): DeckListView {
  if (memoryView) return memoryView
  try {
    return parseDeckListView(sessionStorage.getItem(LIST_VIEW_KEY))
  } catch {
    return defaultDeckListView()
  }
}

export function saveDeckListView(view: DeckListView): void {
  memoryView = view
  try {
    sessionStorage.setItem(LIST_VIEW_KEY, JSON.stringify(view))
  } catch {
    // In-memory restoration still works when session storage is unavailable.
  }
}

// Backup restore updates sessionStorage first, then invalidates this tab's memory cache.
export function invalidateDeckListView(): void {
  memoryView = undefined
}
