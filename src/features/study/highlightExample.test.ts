import { describe, expect, it } from 'vitest'
import { highlightExample } from './highlightExample.ts'

describe('example highlighting', () => {
  it('highlights repeated whole words case insensitively without matching inside other words', () => {
    const parts = highlightExample('Apple and apples, not pineapple or applejack.', 'apple')
    expect(parts.filter((part) => part.highlight).map((part) => part.text)).toEqual([
      'Apple',
      'apples',
    ])
    expect(parts.map((part) => part.text).join('')).toBe(
      'Apple and apples, not pineapple or applejack.',
    )
  })

  it('matches common regular forms and exact phrases, including punctuation', () => {
    expect(
      highlightExample('I underestimated it.', 'underestimate').find((part) => part.highlight)
        ?.text,
    ).toBe('underestimated')
    expect(
      highlightExample('She studied and studies.', 'study')
        .filter((part) => part.highlight)
        .map((part) => part.text),
    ).toEqual(['studied', 'studies'])
    expect(
      highlightExample('Take care of him.', 'take care of').find((part) => part.highlight)?.text,
    ).toBe('Take care of')
    expect(highlightExample('Use C++ here.', 'C++').find((part) => part.highlight)?.text).toBe(
      'C++',
    )
  })

  it('leaves unmatched and empty words unchanged', () => {
    expect(highlightExample('a sentence', '')).toEqual([{ text: 'a sentence', highlight: false }])
    expect(highlightExample('a sentence', 'apple')).toEqual([
      { text: 'a sentence', highlight: false },
    ])
  })
})
