/** Парсит ДД.ММ.ГГГГ → `Date` (календарный день в локальном времени) или `null`. */
export function parseRuDate(raw: string): Date | null {
  const t = raw.trim()
  if (!t) return null
  const m = t.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/)
  if (!m) return null
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]))
  if (Number.isNaN(d.getTime())) return null
  return d
}

/** ДД.ММ.ГГГГ → timestamp начала дня (локально) или `null`. */
export function parseRuDateToDayStart(raw: string): number | null {
  const d = parseRuDate(raw)
  if (!d) return null
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export function formatDateRu(d: Date): string {
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const y = d.getFullYear()
  return `${day}.${month}.${y}`
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

export function isSameMonth(d: Date, year: number, month: number): boolean {
  return d.getFullYear() === year && d.getMonth() === month
}
