import { describe, expect, it } from 'vitest'
import { entryErrorMessage } from './entryValidation.ts'

describe('entry validation messages', () => {
  it('shows the required message after submission until both fields contain text', () => {
    expect(entryErrorMessage('', false, '', '', '必填')).toBe('')
    expect(entryErrorMessage('', true, 'hello', ' ', '必填')).toBe('必填')
    expect(entryErrorMessage('', true, 'hello', '你好', '必填')).toBe('')
    expect(entryErrorMessage('', true, ' ', '你好', '必填')).toBe('必填')
  })
  it('keeps storage failures visible even when both fields are complete', () => {
    expect(entryErrorMessage('保存失败', true, 'hello', '你好', '必填')).toBe('保存失败')
  })
})
