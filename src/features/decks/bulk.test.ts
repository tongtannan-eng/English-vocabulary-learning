import { describe, expect, it } from 'vitest'
import { parseBulkWords } from './bulk.ts'

describe('bulk word entry', () => {
  it('reads Excel TSV headers, phrases and optional metadata without dropping meanings', () => {
    const result = parseBulkWords(
      '英文\t中文释义\t常用搭配\t个人备注\r\napple\t苹果\tan apple a day\t记忆\r\ntake care of\t照顾\t\t\r\n',
    )
    expect(result.skipped).toBe(2)
    expect(result.rows).toMatchObject([
      { line: 2, english: 'apple', chinese: '苹果', collocations: 'an apple a day', notes: '记忆' },
      { line: 3, english: 'take care of', chinese: '照顾' },
    ])
  })
  it('supports quoted CSV with commas, escaped quotes, and multi-line notes', () => {
    const result = parseBulkWords(
      '"hello, world","你好，世界","say ""hello""","line one\nline two"\nbank,银行\nbank,河岸',
    )
    expect(result.rows).toHaveLength(3)
    expect(result.rows[0]).toMatchObject({
      english: 'hello, world',
      chinese: '你好，世界',
      collocations: 'say "hello"',
      notes: 'line one\nline two',
    })
    expect(result.rows.slice(1).map((row) => row.chinese)).toEqual(['银行', '河岸'])
  })
  it('splits common plain text while keeping multiword English and full Chinese meaning', () => {
    expect(
      parseBulkWords('apple 苹果，水果\ntake care of 照顾；照料\nrun - 跑步\nbook：书').rows.map(
        ({ english, chinese }) => [english, chinese],
      ),
    ).toEqual([
      ['apple', '苹果，水果'],
      ['take care of', '照顾；照料'],
      ['run', '跑步'],
      ['book', '书'],
    ])
  })
  it('keeps incomplete rows visible and flags malformed quotes or excess columns', () => {
    expect(parseBulkWords('apple\t苹果\nmissing\t').rows[1]).toMatchObject({
      english: 'missing',
      chinese: '',
    })
    expect(parseBulkWords('apple,苹果,a,b,c').rows[0]!.error).toBeTruthy()
    expect(parseBulkWords('apple,"苹果').rows[0]!.error).toBeTruthy()
  })
  it('refuses an over-limit batch without returning a partially imported subset', () => {
    const result = parseBulkWords(
      Array.from({ length: 501 }, (_, index) => `word${index}\t释义`).join('\n'),
    )
    expect(result.error).toMatch(/500/)
    expect(result.rows).toEqual([])
    expect(parseBulkWords(' \n').error).toBeTruthy()
  })
})
