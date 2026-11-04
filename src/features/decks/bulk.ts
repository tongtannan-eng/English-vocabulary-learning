export interface BulkRow {
  line: number
  english: string
  chinese: string
  collocations: string
  notes: string
  error?: string
}
export interface BulkParseResult {
  rows: BulkRow[]
  skipped: number
  error?: string
}
const LIMIT = 500

function delimitedRows(text: string, separator: string) {
  const rows: { line: number; cells: string[]; error?: string }[] = []
  let cells: string[] = [],
    cell = '',
    quoted = false,
    line = 1,
    start = 1
  const push = (error?: string) => {
    rows.push({ line: start, cells: [...cells, cell], ...(error ? { error } : {}) })
    cells = []
    cell = ''
  }
  for (let index = 0; index < text.length; index++) {
    const char = text[index]!
    if (char === '"') {
      if (quoted && text[index + 1] === '"') {
        cell += '"'
        index++
      } else if (quoted || cell.trim() === '') quoted = !quoted
      else cell += char
    } else if (char === '\n') {
      line++
      if (quoted) cell += '\n'
      else {
        push()
        start = line
      }
    } else if (char === separator && !quoted) {
      cells.push(cell)
      cell = ''
    } else cell += char
  }
  push(quoted ? '引号未闭合，请修正原文后重新预览' : undefined)
  return rows
}

export function parseBulkWords(input: string): BulkParseResult {
  const text = input.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
  const first = text.split('\n').find((line) => line.trim()) ?? ''
  const separator = first.includes('\t') ? '\t' : first.includes(',') ? ',' : null
  const source = separator
    ? delimitedRows(text, separator)
    : text.split('\n').map((line, index) => {
        const match =
          /^\s*(.*?)\s+(?:[-—=:：]\s*|(?=[\u3400-\u9fff]))(.+?)\s*$/.exec(line) ??
          /^\s*(.*?)\s*[:：=]\s*(.+?)\s*$/.exec(line)
        return { line: index + 1, cells: match ? [match[1]!, match[2]!] : [line] }
      })
  let skipped = 0
  const rows: BulkRow[] = []
  for (const item of source) {
    const cells = item.cells.map((cell) => cell.trim())
    if (cells.every((cell) => !cell)) {
      skipped++
      continue
    }
    if (
      rows.length === 0 &&
      /^(英文|单词|english|word)$/i.test(cells[0] ?? '') &&
      /^(中文|中文释义|释义|chinese|meaning|translation)$/i.test(cells[1] ?? '')
    ) {
      skipped++
      continue
    }
    rows.push({
      line: item.line,
      english: cells[0] ?? '',
      chinese: cells[1] ?? '',
      collocations: cells[2] ?? '',
      notes: cells[3] ?? '',
      ...('error' in item && typeof item.error === 'string' && item.error
        ? { error: item.error }
        : cells.length > 4
          ? { error: '超过四列，请修正原文的分隔符后重新预览' }
          : {}),
    })
  }
  if (rows.length > LIMIT)
    return { rows: [], skipped, error: `单次最多导入 ${LIMIT} 行，请分批粘贴，当前内容未添加。` }
  return {
    rows,
    skipped,
    ...(rows.length === 0 ? { error: '没有找到可录入的内容，请粘贴英文和对应释义。' } : {}),
  }
}
