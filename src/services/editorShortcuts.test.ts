import { describe, expect, it } from 'vitest'
import { editorShortcut } from './editorShortcuts.ts'

const base = {
  code: 'Enter',
  key: 'Enter',
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  repeat: false,
  isComposing: false,
  keyCode: 13,
  defaultPrevented: false,
}
describe('editor shortcuts', () => {
  it('recognizes explicit combinations without replacing normal typing and Enter', () => {
    expect(editorShortcut({ ...base, ctrlKey: true })).toBe('submit')
    expect(editorShortcut({ ...base, metaKey: true })).toBe('submit')
    expect(editorShortcut(base)).toBeNull()
    expect(editorShortcut({ ...base, code: 'KeyN', key: 'n', altKey: true })).toBe('add')
    expect(editorShortcut({ ...base, code: 'KeyD', key: 'd', metaKey: true })).toBe('remove')
    expect(editorShortcut({ ...base, code: 'KeyD', key: 'd', ctrlKey: true })).toBe('remove')
    expect(editorShortcut({ ...base, code: 'Escape', key: 'Escape' })).toBe('cancel')
    expect(editorShortcut({ ...base, code: 'KeyN', key: 'n' })).toBeNull()
  })
  it('ignores repeated keys, IME composition, already handled and extra modifiers', () => {
    expect(editorShortcut({ ...base, ctrlKey: true, repeat: true })).toBeNull()
    expect(editorShortcut({ ...base, ctrlKey: true, isComposing: true })).toBeNull()
    expect(editorShortcut({ ...base, ctrlKey: true, keyCode: 229 })).toBeNull()
    expect(editorShortcut({ ...base, ctrlKey: true, defaultPrevented: true })).toBeNull()
    expect(editorShortcut({ ...base, ctrlKey: true, altKey: true })).toBeNull()
    expect(
      editorShortcut({ ...base, code: 'KeyN', key: 'N', altKey: true, shiftKey: true }),
    ).toBeNull()
    expect(editorShortcut({ ...base, code: 'Escape', key: 'Escape', shiftKey: true })).toBeNull()
    expect(
      editorShortcut({ ...base, code: 'KeyD', key: 'd', metaKey: true, ctrlKey: true }),
    ).toBeNull()
  })
})
