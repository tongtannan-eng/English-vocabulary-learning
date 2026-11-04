import { describe, expect, it } from 'vitest'
import { checkSpelling } from './spelling.ts'

describe('Chinese-to-English spelling feedback', () => {
  it('accepts capitalization and leading/trailing spaces', () => {
    expect(checkSpelling('Apple', '  APPLE ')).toMatchObject({ correct: true })
    expect(checkSpelling('take responsibility for', ' Take Responsibility For ')).toMatchObject({
      correct: true,
    })
  })

  it('highlights the letter missing from the answer', () => {
    const result = checkSpelling('apple', 'aple')
    expect(result.correct).toBe(false)
    expect(
      result.parts
        .filter((part) => part.kind === 'missing')
        .map((part) => part.text)
        .join(''),
    ).toBe('p')
    expect(result.parts.filter((part) => part.kind === 'extra')).toHaveLength(0)
  })

  it('highlights an extra letter without shifting the rest of the word', () => {
    const result = checkSpelling('apple', 'appple')
    expect(result.correct).toBe(false)
    expect(
      result.parts
        .filter((part) => part.kind === 'extra')
        .map((part) => part.text)
        .join(''),
    ).toBe('p')
    expect(result.parts.filter((part) => part.kind === 'missing')).toHaveLength(0)
  })

  it('shows both the wrong letter and its correct replacement', () => {
    const result = checkSpelling('book', 'boak')
    expect(result.correct).toBe(false)
    expect(
      result.parts
        .filter((part) => part.kind === 'extra')
        .map((part) => part.text)
        .join(''),
    ).toBe('a')
    expect(
      result.parts
        .filter((part) => part.kind === 'missing')
        .map((part) => part.text)
        .join(''),
    ).toBe('o')
  })

  it('keeps spaces, hyphens and apostrophes meaningful within phrases', () => {
    expect(checkSpelling('well-known', 'well known').correct).toBe(false)
    expect(checkSpelling("don't", 'dont').correct).toBe(false)
    expect(checkSpelling('ice cream', 'icecream').correct).toBe(false)
  })

  it('handles Unicode normalization and an empty answer', () => {
    expect(checkSpelling('café', 'cafe\u0301').correct).toBe(true)
    expect(checkSpelling('apple', '  ').correct).toBe(false)
  })
})
