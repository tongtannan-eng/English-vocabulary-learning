import { describe, expect, it } from 'vitest'
import {
  DECK_PAGE_SIZE,
  defaultDeckListView,
  filterDeckList,
  paginateDeckList,
  parseDeckListView,
  unfamiliarWordCount,
} from './deckList.ts'
import type { Deck, Familiarity } from '../../shared/types.ts'

function deck(id: string, date: string, familiarity?: Familiarity): Deck {
  return {
    id,
    date,
    title: `词组 ${id}`,
    createdAt: Number(id) || 1,
    updatedAt: 1,
    words: [
      {
        id: `word-${id}`,
        english: `word${id}`,
        chinese: `释义 ${id}`,
        ...(familiarity ? { familiarity } : {}),
      },
    ],
  }
}

describe('deck list search and filters', () => {
  it('searches the entire collection before pagination, including words beyond the preview', () => {
    const decks = Array.from({ length: 45 }, (_, index) => deck(String(index + 1), '2026-10-29'))
    const last = decks[0]!
    last.words.push(
      ...Array.from({ length: 8 }, (_, index) => ({
        id: `extra-${index}`,
        english: index === 7 ? 'responsibility' : `extra${index}`,
        chinese: index === 7 ? '责任' : '补充词',
      })),
    )
    const view = { ...defaultDeckListView(), query: ' RESPONSIBILITY ' }
    const found = filterDeckList(decks, view)
    expect(found.map((entry) => entry.id)).toEqual(['1'])
    expect(paginateDeckList(found, 3).page).toBe(1)
    expect(filterDeckList(decks, { ...view, query: '责任' })).toEqual(found)
  })

  it('matches titles and combines multiple search terms', () => {
    const decks = [deck('1', '2026-10-29'), deck('2', '2026-10-28')]
    decks[0]!.title = '旅行常用词'
    decks[0]!.words[0]!.english = 'Airport'
    expect(
      filterDeckList(decks, { ...defaultDeckListView(), query: '旅行 AIRPORT' }).map(
        (entry) => entry.id,
      ),
    ).toEqual(['1'])
    expect(filterDeckList(decks, { ...defaultDeckListView(), query: '旅行 missing' })).toHaveLength(
      0,
    )
  })

  it('includes both date-range boundaries and supports open ranges', () => {
    const decks = [
      deck('1', '2026-09-30'),
      deck('2', '2026-10-01'),
      deck('3', '2026-10-31'),
      deck('4', '2026-11-01'),
    ]
    const view = { ...defaultDeckListView(), startDate: '2026-10-01', endDate: '2026-10-31' }
    expect(filterDeckList(decks, view).map((entry) => entry.id)).toEqual(['3', '2'])
    expect(filterDeckList(decks, { ...view, endDate: '' })).toHaveLength(3)
    expect(filterDeckList(decks, { ...view, startDate: '' })).toHaveLength(3)
  })

  it('distinguishes unfamiliar, unreviewed and fully known cards, excluding empty cards', () => {
    const decks = [
      deck('1', '2026-10-29', 'unknown'),
      deck('2', '2026-10-29', 'known'),
      deck('3', '2026-10-29'),
      deck('4', '2026-10-29'),
    ]
    decks[3]!.words = []
    const view = defaultDeckListView()
    expect(
      filterDeckList(decks, { ...view, status: 'unfamiliar' }).map((entry) => entry.id),
    ).toEqual(['1'])
    expect(
      filterDeckList(decks, { ...view, status: 'unreviewed' }).map((entry) => entry.id),
    ).toEqual(['3'])
    expect(filterDeckList(decks, { ...view, status: 'mastered' }).map((entry) => entry.id)).toEqual(
      ['2'],
    )
    expect(unfamiliarWordCount(decks[0]!)).toBe(1)
  })

  it('combines search, dates and status, and does not reorder cards when reviewing updates timestamps', () => {
    const decks = [
      deck('1', '2026-10-29', 'unknown'),
      deck('2', '2026-10-29', 'unknown'),
      deck('3', '2026-09-29', 'unknown'),
    ]
    decks[0]!.updatedAt = 999999
    const view = {
      ...defaultDeckListView(),
      query: '释义',
      startDate: '2026-10-01',
      status: 'unfamiliar' as const,
    }
    expect(filterDeckList(decks, view).map((entry) => entry.id)).toEqual(['2', '1'])
    expect(decks.map((entry) => entry.id)).toEqual(['1', '2', '3'])
  })
})

describe('monthly grouping and 20-card pages', () => {
  const decks = [
    ...Array.from({ length: 25 }, (_, index) => deck(String(index + 1), '2026-10-29')),
    ...Array.from({ length: 20 }, (_, index) => deck(String(index + 26), '2026-09-29')),
  ]
  const sorted = filterDeckList(decks, defaultDeckListView())

  it('shows 20, 20 and 5 cards without omissions or duplicates across month boundaries', () => {
    expect(DECK_PAGE_SIZE).toBe(20)
    const pages = [1, 2, 3].map((page) => paginateDeckList(sorted, page))
    expect(
      pages.map((page) => page.groups.reduce((sum, group) => sum + group.decks.length, 0)),
    ).toEqual([20, 20, 5])
    expect(pages[1]!.groups.map((group) => [group.month, group.total, group.decks.length])).toEqual(
      [
        ['2026-10', 25, 5],
        ['2026-09', 20, 15],
      ],
    )
    const all = pages.flatMap((page) =>
      page.groups.flatMap((group) => group.decks.map((entry) => entry.id)),
    )
    expect(all).toHaveLength(45)
    expect(new Set(all).size).toBe(45)
  })

  it('clamps pages when filtering or deletion reduces the result count', () => {
    expect(paginateDeckList(sorted.slice(0, 21), 3).page).toBe(2)
    expect(paginateDeckList(sorted.slice(0, 20), 2).page).toBe(1)
    expect(paginateDeckList([], 3)).toEqual({ page: 1, pageCount: 1, groups: [] })
    expect(paginateDeckList(sorted, Number.NaN).page).toBe(1)
  })
})

describe('list navigation restoration', () => {
  it('restores filters, page, folded months, preview and scroll offset together', () => {
    const view = {
      ...defaultDeckListView(),
      query: 'apple',
      startDate: '2026-09-01',
      endDate: '2026-10-31',
      status: 'unfamiliar' as const,
      page: 2,
      collapsedMonths: ['2026-09'],
      expandedDeckIds: ['card-21'],
      scrollY: 840,
    }
    expect(parseDeckListView(JSON.stringify(view))).toEqual(view)
  })

  it('recovers from corrupt session data and invalid date ranges', () => {
    expect(parseDeckListView('not json')).toEqual(defaultDeckListView())
    expect(parseDeckListView('null')).toEqual(defaultDeckListView())
    expect(
      parseDeckListView(
        JSON.stringify({
          startDate: '2026-11-01',
          endDate: '2026-10-01',
          status: 'invalid',
          page: -2,
          collapsedMonths: [null, '2026-09'],
          expandedDeckIds: 5,
          scrollY: -200,
        }),
      ),
    ).toEqual({ ...defaultDeckListView(), collapsedMonths: ['2026-09'] })
  })
})
