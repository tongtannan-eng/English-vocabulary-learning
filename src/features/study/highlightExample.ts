export function highlightExample(sentence: string, english: string) {
  const word = english.trim()
  if (!word) return [{ text: sentence, highlight: false }]
  const forms = new Set([word])
  if (/^[a-z]+$/i.test(word)) {
    const base = word.toLowerCase()
    forms.add(`${base}s`)
    forms.add(`${base}es`)
    forms.add(`${base}ed`)
    forms.add(`${base}ing`)
    if (base.endsWith('e')) {
      forms.add(`${base}d`)
      if (!base.endsWith('ee')) forms.add(`${base.slice(0, -1)}ing`)
    }
    if (/[^aeiou]y$/.test(base)) {
      forms.add(`${base.slice(0, -1)}ies`)
      forms.add(`${base.slice(0, -1)}ied`)
    }
  }
  const alternatives = [...forms]
    .sort((a, b) => b.length - a.length)
    .map((form) => form.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|')
  const matches = sentence.matchAll(
    new RegExp(`(?<![\\p{L}\\p{N}_])(?:${alternatives})(?![\\p{L}\\p{N}_])`, 'giu'),
  )
  const parts: { text: string; highlight: boolean }[] = []
  let offset = 0
  for (const match of matches) {
    if (match.index > offset)
      parts.push({ text: sentence.slice(offset, match.index), highlight: false })
    parts.push({ text: match[0], highlight: true })
    offset = match.index + match[0].length
  }
  if (offset < sentence.length) parts.push({ text: sentence.slice(offset), highlight: false })
  return parts
}
