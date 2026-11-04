import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createBackup, importBackup } from './backup.ts'
import { parseDeckFile } from './transfer.ts'
import {
  loadPrefs,
  savePrefs,
  subscribeReviewPrefs,
  PREFS_KEY,
  saveSpeechAccent,
  loadSpeechAccent,
} from './storage.ts'
import { parseHash } from '../app/router.ts'

describe('global learning preferences', () => {
  let values: Map<string, string>
  beforeEach(() => {
    values = new Map()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value)
      },
      removeItem: (key: string) => {
        values.delete(key)
      },
    })
    vi.stubGlobal('sessionStorage', {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    })
    vi.stubGlobal('window', new EventTarget())
  })
  afterEach(() => vi.unstubAllGlobals())
  it('persists defaults, notifies consumers and removes the subscription', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeReviewPrefs(listener)
    expect(savePrefs({ front: 'dictation', order: 'random' })).toBe(true)
    expect(loadPrefs()).toEqual({ front: 'dictation', order: 'random' })
    expect(listener).toHaveBeenCalledTimes(1)
    unsubscribe()
    savePrefs({ front: 'chinese', order: 'sequential' })
    expect(listener).toHaveBeenCalledTimes(1)
  })
  it('reports a failed setting write and keeps the saved default', () => {
    savePrefs({ front: 'chinese', order: 'random' })
    const storage = localStorage
    vi.stubGlobal('localStorage', {
      ...storage,
      setItem: () => {
        throw new Error('quota')
      },
    })
    expect(savePrefs({ front: 'english', order: 'sequential' })).toBe(false)
    expect(loadPrefs()).toEqual({ front: 'chinese', order: 'random' })
  })
  it('round-trips settings in a full backup and preserves them when importing legacy cards', () => {
    savePrefs({ front: 'dictation', order: 'random' })
    saveSpeechAccent('en-GB')
    const file = createBackup()
    savePrefs({ front: 'english', order: 'sequential' })
    saveSpeechAccent('en-US')
    const parsed = parseDeckFile(JSON.stringify(file))
    if ('error' in parsed) throw new Error(parsed.error)
    expect(importBackup(parsed)).not.toHaveProperty('error')
    expect(loadPrefs()).toEqual({ front: 'dictation', order: 'random' })
    expect(loadSpeechAccent()).toBe('en-GB')
    importBackup({ decks: [] })
    expect(JSON.parse(values.get(PREFS_KEY)!)).toEqual({ front: 'dictation', order: 'random' })
  })
  it('routes the two new destinations without changing existing practice links', () => {
    expect(parseHash('#/practice')).toEqual({ name: 'practice' })
    expect(parseHash('#/settings')).toEqual({ name: 'settings' })
    expect(parseHash('#/review-quick/2026-10-29/5')).toEqual({
      name: 'review-quick',
      date: '2026-10-29',
      limit: 5,
    })
    expect(parseHash('#/unfamiliar')).toEqual({ name: 'unfamiliar' })
  })
})
