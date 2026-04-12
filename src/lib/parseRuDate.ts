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

/**
 * Как `parseRuDate`, но отбрасывает несуществующие даты (31.02, 32.01 и т.д.).
 * Для полей ввода дедлайна.
 */
export function parseRuDateStrict(raw: string): Date | null {
  const t = raw.trim()
  if (!t) return null
  const m = t.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/)
  if (!m) return null
  const day = Number(m[1])
  const month = Number(m[2])
  const year = Number(m[3])
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  const d = new Date(year, month - 1, day)
  if (
    d.getFullYear() !== year ||
    d.getMonth() !== month - 1 ||
    d.getDate() !== day
  ) {
    return null
  }
  return d
}

/** ДД.ММ.ГГГГ → YYYY-MM-DD для `input type="date"` */
export function ruDeadlineToIso(ru: string): string {
  const d = parseRuDateStrict(ru.trim())
  if (!d) return ''
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${mo}-${day}`
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

/** Для сохранения в проект/этап: пусто или невалидно → «—», иначе ДД.ММ.ГГГГ. */
export function normalizeDeadlineStored(raw: string): string {
  const t = raw.trim()
  if (!t) return '—'
  const d = parseRuDateStrict(t)
  return d ? formatDateRu(d) : '—'
}

/** Для задач: пусто или невалидно → «», иначе ДД.ММ.ГГГГ. */
export function normalizeTaskDueRaw(raw: string): string {
  const t = raw.trim()
  if (!t) return ''
  const d = parseRuDateStrict(t)
  return d ? formatDateRu(d) : ''
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
