import { afterEach, describe, expect, it, vi } from 'vitest'
import { suggestionPlacement } from './suggestionPopup.ts'
import { selectFirstMeaning } from './suggest.ts'

afterEach(() => vi.unstubAllGlobals())
describe('English enter selects the first meaning', () => {
  const dictionary = { words: { apple: 'n. 苹果, 家伙' }, forms: {} }
  it('selects the first candidate and leaves unmatched entries unchanged', async () => {
    const select = vi.fn()
    expect(
      await selectFirstMeaning(
        'apple',
        () => true,
        select,
        async () => dictionary,
      ),
    ).toBe('selected')
    expect(select).toHaveBeenCalledWith('n. 苹果, 家伙')
    select.mockClear()
    expect(
      await selectFirstMeaning(
        'unknown',
        () => true,
        select,
        async () => dictionary,
      ),
    ).toBe('missing')
    expect(select).not.toHaveBeenCalled()
  })
  it('does not overwrite later edits when a delayed lookup completes', async () => {
    let resolve!: (value: typeof dictionary) => void
    let current = true
    const select = vi.fn()
    const pending = selectFirstMeaning(
      'apple',
      () => current,
      select,
      () =>
        new Promise((done) => {
          resolve = done
        }),
    )
    current = false
    resolve(dictionary)
    expect(await pending).toBe('stale')
    expect(select).not.toHaveBeenCalled()
  })
  it('propagates dictionary failures for the caller to show a retry message', async () => {
    const select = vi.fn()
    await expect(
      selectFirstMeaning(
        'apple',
        () => true,
        select,
        async () => {
          throw new Error('offline')
        },
      ),
    ).rejects.toThrow('offline')
    expect(select).not.toHaveBeenCalled()
  })
})
describe('dictionary request recovery', () => {
  it('shares a pending request and allows retry after an HTTP failure', async () => {
    vi.resetModules()
    const dictionary = { words: { rope: 'n. 绳, 索' }, forms: {} }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: true, json: async () => dictionary })
    vi.stubGlobal('fetch', fetchMock)
    const { loadDict, lookupMeanings } = await import('./suggest.ts')
    const first = loadDict()
    expect(loadDict()).toBe(first)
    await expect(first).rejects.toThrow('词库加载失败')
    const recovered = await loadDict()
    expect(lookupMeanings(recovered, 'rope')).toContain('绳')
    expect(await loadDict()).toBe(dictionary)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
  it('also releases a failed network or invalid JSON request', async () => {
    vi.resetModules()
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockRejectedValueOnce(new Error('offline'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => {
            throw new Error('invalid json')
          },
        })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ words: {}, forms: {} }) }),
    )
    const { loadDict } = await import('./suggest.ts')
    await expect(loadDict()).rejects.toThrow('offline')
    await expect(loadDict()).rejects.toThrow('invalid json')
    await expect(loadDict()).resolves.toEqual({ words: {}, forms: {} })
  })
})
describe('candidate popup placement', () => {
  it('opens below when there is enough room', () => {
    expect(suggestionPlacement({ top: 100, bottom: 160 }, { top: 8, bottom: 640 }, 280)).toEqual({
      upward: false,
      maxHeight: 280,
    })
  })
  it('opens above near the footer and respects the sticky toolbar boundary', () => {
    expect(suggestionPlacement({ top: 550, bottom: 610 }, { top: 120, bottom: 640 }, 280)).toEqual({
      upward: true,
      maxHeight: 280,
    })
    expect(suggestionPlacement({ top: 250, bottom: 310 }, { top: 120, bottom: 380 }, 280)).toEqual({
      upward: true,
      maxHeight: 122,
    })
  })
  it('fits short status panels and clamps reduced mobile viewports', () => {
    expect(suggestionPlacement({ top: 100, bottom: 150 }, { top: 8, bottom: 250 }, 48)).toEqual({
      upward: false,
      maxHeight: 48,
    })
    expect(suggestionPlacement({ top: 10, bottom: 50 }, { top: 8, bottom: 60 }, 280)).toEqual({
      upward: false,
      maxHeight: 2,
    })
  })
})
