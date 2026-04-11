/** Форматирует дату в ДД.ММ.ГГГГ */
export function formatDateRu(d: Date): string {
  const day = String(d.getDate()).padStart(2, '0')
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const y = d.getFullYear()
  return `${day}.${m}.${y}`
}

/** Парсит дату вида «14.01.2027» */
export function parseRuDate(raw: string): Date | null {
  const s = raw.trim()
  if (!s || s === '—') return null
  const m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/)
  if (!m) return null
  const d = Number(m[1])
  const mo = Number(m[2]) - 1
  const y = Number(m[3])
  const dt = new Date(y, mo, d)
  if (
    dt.getFullYear() !== y ||
    dt.getMonth() !== mo ||
    dt.getDate() !== d
  ) {
    return null
  }
  return dt
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

export function isSameMonth(a: Date, y: number, m: number): boolean {
  return a.getFullYear() === y && a.getMonth() === m
}
