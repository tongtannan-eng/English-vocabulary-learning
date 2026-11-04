import { diffChars } from 'diff'

export interface SpellingPart {
  text: string
  kind: 'same' | 'missing' | 'extra'
}

export interface SpellingResult {
  correct: boolean
  parts: SpellingPart[]
}

export function checkSpelling(expected: string, answer: string): SpellingResult {
  const target = expected.trim().normalize('NFC').toLowerCase()
  const actual = answer.trim().normalize('NFC').toLowerCase()
  // Bound comparison time for an unusually long imported phrase.
  const changes = diffChars(target, actual, { timeout: 100 }) ?? [
    { value: target, removed: true, added: false },
    { value: actual, removed: false, added: true },
  ]
  return {
    correct: target === actual,
    parts: changes
      .filter((change) => change.value.length > 0)
      .map((change) => ({
        text: change.value,
        kind: change.added ? 'extra' : change.removed ? 'missing' : 'same',
      })),
  }
}
