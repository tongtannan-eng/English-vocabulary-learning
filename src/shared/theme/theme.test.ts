import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadTheme, saveTheme, THEME_STORAGE_KEY } from './theme.ts'

afterEach(() => vi.unstubAllGlobals())

describe('default theme', () => {
  it('uses vivid when no preference exists and preserves either explicit choice', () => {
    const values = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    })
    vi.stubGlobal('window', new EventTarget())
    expect(loadTheme()).toBe('vivid')
    expect(saveTheme('classic')).toBe(true)
    expect(values.get(THEME_STORAGE_KEY)).toBe('classic')
    expect(loadTheme()).toBe('classic')
    expect(saveTheme('vivid')).toBe(true)
    expect(loadTheme()).toBe('vivid')
    values.set(THEME_STORAGE_KEY, 'invalid')
    expect(loadTheme()).toBe('vivid')
  })
  it('uses vivid when browser storage cannot be read', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('denied')
      },
    })
    expect(loadTheme()).toBe('vivid')
  })
})
