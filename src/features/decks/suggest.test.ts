import { afterEach, describe, expect, it, vi } from 'vitest'
import { suggestionPlacement } from './suggestionPopup.ts'

afterEach(() => vi.unstubAllGlobals())
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
