import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { backupSnapshot, compareBackup } from './backupStatus.ts'
import { createBackup, importBackup } from './backup.ts'
import { invalidateDeckListView } from '../features/decks/deckList.ts'
import {
  DEFAULT_SHORTCUTS,
  SHORTCUTS_KEY,
  isShortcuts,
  loadShortcuts,
  matchesShortcut,
  matchesSpeakShortcut,
  saveShortcut,
  shortcutLabel,
  saveShortcuts,
  subscribeShortcuts,
} from './shortcuts.ts'
import { parseDeckFile } from './transfer.ts'

describe('global shortcut preferences and backup', () => {
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

  it('keeps the original keys until a valid unique key is saved', () => {
    expect(loadShortcuts()).toEqual(DEFAULT_SHORTCUTS)
    values.set(SHORTCUTS_KEY, '{"speak":"KeyP"}')
    expect(loadShortcuts()).toEqual(DEFAULT_SHORTCUTS)
    expect(saveShortcut('speak', 'Ctrl+P')).toBe('这个按键不能用作快捷键。')
    expect(saveShortcut('speak', 'Digit1')).toBe('这个键已经用于「不认识」。')
    expect(saveShortcut('speak', 'Shift+Meta+KeyP')).toBe(true)
    expect(loadShortcuts().speak).toBe('Meta+Shift+KeyP')
    expect(shortcutLabel('Meta+Shift+KeyP')).toBe('Command+Shift+P')
    expect(saveShortcut('flip', 'Meta+Shift+KeyP')).toBe('这个键已经用于「朗读」。')
    expect(saveShortcut('speak', 'KeyS')).toBe(true)
    expect(loadShortcuts().speak).toBe('KeyS')
    expect(isShortcuts({ ...DEFAULT_SHORTCUTS, extra: 'KeyA' })).toBe(false)
    expect(isShortcuts({ ...DEFAULT_SHORTCUTS, speak: 'Meta+KeyP' })).toBe(true)
    const plain = {
      code: 'Numpad1',
      key: '1',
      metaKey: false,
      ctrlKey: false,
      altKey: false,
      shiftKey: false,
    }
    expect(matchesShortcut(plain, 'Digit1')).toBe(true)
    const commandP = {
      code: 'KeyP',
      key: 'p',
      metaKey: true,
      ctrlKey: false,
      altKey: false,
      shiftKey: false,
    }
    expect(matchesShortcut(commandP, 'Meta+KeyP')).toBe(true)
    expect(matchesShortcut(commandP, 'KeyP')).toBe(false)
    const letterP = {
      code: 'KeyP',
      key: 'p',
      metaKey: false,
      ctrlKey: false,
      altKey: false,
      shiftKey: false,
    }
    const altP = { ...letterP, altKey: true }
    expect(matchesSpeakShortcut(letterP, 'KeyP', true)).toBe(false)
    expect(matchesSpeakShortcut(altP, 'KeyP', true)).toBe(true)
    expect(matchesSpeakShortcut(commandP, 'Meta+KeyP', true)).toBe(true)
    expect(matchesSpeakShortcut(letterP, 'Meta+KeyP', false)).toBe(false)
  })

  it('notifies open pages and keeps the previous keys when saving fails', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeShortcuts(listener)
    expect(saveShortcuts({ ...DEFAULT_SHORTCUTS, flip: 'KeyF' })).toBe(true)
    expect(listener).toHaveBeenCalledTimes(1)
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: () => {
        throw new Error('quota')
      },
    })
    expect(saveShortcut('flip', 'KeyG')).toBe('快捷键保存失败，请检查浏览器本地存储。')
    expect(loadShortcuts().flip).toBe('KeyF')
    unsubscribe()
    saveShortcuts(DEFAULT_SHORTCUTS)
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('restores shortcuts from a full backup and keeps local keys for older files', () => {
    saveShortcut('previous', 'KeyA')
    const file = createBackup()
    expect(file.preferences!.shortcuts).toMatchObject({ previous: 'KeyA', speak: 'KeyP' })
    saveShortcut('previous', 'ArrowLeft')
    const parsed = parseDeckFile(JSON.stringify(file))
    if ('error' in parsed) throw new Error(parsed.error)
    expect(importBackup(parsed)).not.toHaveProperty('error')
    expect(loadShortcuts().previous).toBe('KeyA')
    const legacy = { ...file, preferences: { ...file.preferences!, shortcuts: undefined } }
    saveShortcut('speak', 'KeyS')
    const old = parseDeckFile(JSON.stringify(legacy))
    if ('error' in old) throw new Error(old.error)
    importBackup(old)
    expect(loadShortcuts().speak).toBe('KeyS')
    expect(
      parseDeckFile(
        JSON.stringify({
          ...file,
          preferences: { ...file.preferences, shortcuts: { speak: 'KeyP' } },
        }),
      ),
    ).toHaveProperty('error')
    const before = backupSnapshot(createBackup())
    saveShortcut('next', 'KeyN')
    expect(compareBackup(before, backupSnapshot(createBackup())).pending).toBe(true)
    expect(createBackup(['none']).preferences).toBeUndefined()
    saveShortcut('speak', 'Meta+KeyP')
    const combo = createBackup()
    expect(combo.preferences!.shortcuts!.speak).toBe('Meta+KeyP')
    const parsedCombo = parseDeckFile(JSON.stringify(combo))
    if ('error' in parsedCombo) throw new Error(parsedCombo.error)
    saveShortcut('speak', 'KeyP')
    importBackup(parsedCombo)
    expect(loadShortcuts().speak).toBe('Meta+KeyP')
  })
})
