export interface LocalDict {
  words: Record<string, string>
  forms: Record<string, string>
}

const OPTION_LIMIT = 24
let dictPromise: Promise<LocalDict> | null = null

export function loadDict(): Promise<LocalDict> {
  if (!dictPromise) {
    dictPromise = fetch('/dict.json')
      .then((response) => {
        if (!response.ok) throw new Error('词库加载失败，请手动填写')
        return response.json() as Promise<LocalDict>
      })
      .catch((error: unknown) => {
        dictPromise = null
        throw error
      })
  }
  return dictPromise
}

export function lookupMeanings(dict: LocalDict, english: string): string[] {
  const translation = resolveTranslation(dict, english)
  if (!translation) return []
  return splitMeanings(translation)
}

function resolveTranslation(dict: LocalDict, english: string): string {
  const key = normalizeWord(english)
  if (!key) return ''
  if (dict.words[key]) return dict.words[key]
  const lemma = dict.forms[key]
  if (lemma && dict.words[lemma]) return dict.words[lemma]
  return ''
}

function normalizeWord(english: string): string {
  return english
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.。]+$/g, '')
}

export function splitMeanings(translation: string): string[] {
  const lines = translation
    .split(/\n+|\\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  const summary = lines
    .filter((line) => !line.startsWith('['))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
  const options: string[] = []
  const seen = new Set<string>()

  function push(value: string) {
    const text = value.replace(/\s+/g, ' ').trim()
    if (!text || seen.has(text) || !hasChinese(text)) return
    seen.add(text)
    options.push(text)
  }

  if (summary) push(summary)
  for (const line of lines) {
    const body = stripPos(line.replace(/^\[[^\]]+\]\s*/, ''))
    for (const sense of splitSenses(body)) {
      if (sense.length > 30) continue
      push(sense)
      if (options.length >= OPTION_LIMIT) return options
    }
  }
  return options
}

function stripPos(line: string): string {
  return line.replace(/^(?:(?:[a-z]+)\.(?:\([^)]*\))?\s*)+/i, '').trim()
}

function splitSenses(body: string): string[] {
  const senses: string[] = []
  let current = ''
  let depth = 0
  for (const char of body) {
    if (char === '(' || char === '（') depth += 1
    if ((char === '；' || char === ';' || char === '，' || char === ',') && depth === 0) {
      const text = current.trim()
      if (text) senses.push(text)
      current = ''
      continue
    }
    if (char === ')' || char === '）') depth = Math.max(0, depth - 1)
    current += char
  }
  const tail = current.trim()
  if (tail) senses.push(tail)
  return senses
}

function hasChinese(value: string): boolean {
  return /[\u4e00-\u9fff]/.test(value)
}
