import type { Sentence } from '../../shared/types.ts'

export function isSentence(value: unknown): value is Sentence {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const item = value as Record<string, unknown>
  return (
    item.id !== '' &&
    typeof item.id === 'string' &&
    typeof item.english === 'string' &&
    item.english.trim() !== '' &&
    typeof item.chinese === 'string' &&
    Number.isFinite(item.createdAt) &&
    Number.isFinite(item.updatedAt)
  )
}

export function isSentenceList(value: unknown): value is Sentence[] {
  return (
    Array.isArray(value) &&
    value.every(isSentence) &&
    new Set(value.map((item) => item.id)).size === value.length
  )
}

export function addSentence(
  sentences: readonly Sentence[],
  english: string,
  chinese: string,
  now = Date.now(),
): Sentence[] | null {
  const text = english.trim()
  if (!text || !chinese.trim()) return null
  return [
    {
      id: crypto.randomUUID(),
      english: text,
      chinese: chinese.trim(),
      createdAt: now,
      updatedAt: now,
    },
    ...sentences,
  ]
}

export function updateSentence(
  sentences: readonly Sentence[],
  id: string,
  english: string,
  chinese: string,
  now = Date.now(),
): Sentence[] | null {
  const text = english.trim()
  const current = sentences.find((item) => item.id === id)
  if (!current || !text || !chinese.trim()) return null
  return sentences.map((item) =>
    item.id === id ? { ...item, english: text, chinese: chinese.trim(), updatedAt: now } : item,
  )
}

export function removeSentence(sentences: readonly Sentence[], id: string): Sentence[] {
  return sentences.filter((item) => item.id !== id)
}

export function mergeSentences(
  current: readonly Sentence[],
  incoming: readonly Sentence[] | undefined,
): Sentence[] {
  if (!incoming) return [...current]
  const byId = new Map(current.map((item) => [item.id, item]))
  for (const item of incoming) {
    const previous = byId.get(item.id)
    if (!previous || item.updatedAt >= previous.updatedAt) byId.set(item.id, item)
  }
  return [...byId.values()].sort((a, b) => b.createdAt - a.createdAt || a.id.localeCompare(b.id))
}
