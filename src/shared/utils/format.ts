const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']

export function todayISO(): string {
  return toISODate(new Date())
}

export function toISODate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

export function parseISODate(iso: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null
  }
  return date
}

export function formatDate(iso: string): string {
  const date = parseISODate(iso)
  if (!date) return iso
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${WEEKDAYS[date.getDay()]}`
}

export function formatDeckHeading(iso: string): string {
  const date = parseISODate(iso)
  if (!date) return iso
  const monthDay = `${date.getMonth() + 1}月${date.getDate()}日`
  if (date.getFullYear() === new Date().getFullYear()) return monthDay
  return `${date.getFullYear()}年${monthDay}`
}

export function isToday(iso: string): boolean {
  return iso === todayISO()
}

export function getWeekRange(iso = todayISO()): { start: string; end: string } {
  const start = parseISODate(iso) ?? parseISODate(todayISO())!
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7))
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  return { start: toISODate(start), end: toISODate(end) }
}

export function shiftWeek(iso: string, offset: number): string {
  const date = parseISODate(getWeekRange(iso).start)!
  date.setDate(date.getDate() + offset * 7)
  return toISODate(date)
}

export function getMonthRange(iso = todayISO()): { start: string; end: string } {
  const date = parseISODate(iso) ?? parseISODate(todayISO())!
  return {
    start: toISODate(new Date(date.getFullYear(), date.getMonth(), 1)),
    end: toISODate(new Date(date.getFullYear(), date.getMonth() + 1, 0)),
  }
}

export function shiftMonth(iso: string, offset: number): string {
  const date = parseISODate(getMonthRange(iso).start)!
  return toISODate(new Date(date.getFullYear(), date.getMonth() + offset, 1))
}

export function addDays(iso: string, days: number): string {
  const date = parseISODate(iso) ?? new Date()
  date.setDate(date.getDate() + days)
  return toISODate(date)
}
