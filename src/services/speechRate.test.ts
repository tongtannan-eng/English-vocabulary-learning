import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  isSpeechRate,
  loadSpeechRate,
  saveSpeechRate,
  subscribeSpeechRate,
  SPEECH_RATE_KEY,
} from './speechRate.ts'
import { createBackup, importBackup } from './backup.ts'
import { parseDeckFile } from './transfer.ts'
import { invalidateDeckListView } from '../features/decks/deckList.ts'

describe('global speech rate preferences and backup', () => {
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
    invalidateDeckListView()
  })
  afterEach(() => {
    invalidateDeckListView()
    vi.unstubAllGlobals()
  })
  it('uses the old default and validates allowed speed options', () => {
    expect(loadSpeechRate()).toBe(0.9)
    for (const invalid of [null, '0.7', 0, 2, NaN]) expect(isSpeechRate(invalid)).toBe(false)
    values.set(SPEECH_RATE_KEY, 'garbage')
    expect(loadSpeechRate()).toBe(0.9)
  })
  it('notifies all controls after a successful write and keeps the prior value on failure', () => {
    const listener = vi.fn(),
      unsubscribe = subscribeSpeechRate(listener)
    expect(saveSpeechRate(0.7)).toBe(true)
    expect(loadSpeechRate()).toBe(0.7)
    expect(listener).toHaveBeenCalledTimes(1)
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: () => {
        throw new Error('quota')
      },
    })
    expect(saveSpeechRate(1.1)).toBe(false)
    expect(loadSpeechRate()).toBe(0.7)
    expect(listener).toHaveBeenCalledTimes(1)
    unsubscribe()
  })
  it('restores rate from a full backup, preserves it for old files, and rejects malformed rate', () => {
    saveSpeechRate(0.7)
    const file = createBackup()
    expect(file.preferences!.speechRate).toBe(0.7)
    saveSpeechRate(1.1)
    const parsed = parseDeckFile(JSON.stringify(file))
    if ('error' in parsed) throw new Error(parsed.error)
    expect(importBackup(parsed)).not.toHaveProperty('error')
    expect(loadSpeechRate()).toBe(0.7)
    const old = { ...file, preferences: { ...file.preferences, speechRate: undefined } }
    saveSpeechRate(1.1)
    const legacy = parseDeckFile(JSON.stringify(old))
    if ('error' in legacy) throw new Error(legacy.error)
    importBackup(legacy)
    expect(loadSpeechRate()).toBe(1.1)
    expect(
      parseDeckFile(
        JSON.stringify({ ...file, preferences: { ...file.preferences, speechRate: 7 } }),
      ),
    ).toHaveProperty('error')
    expect(createBackup(['none']).preferences).toBeUndefined()
  })
})
