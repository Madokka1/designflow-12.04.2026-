/** Оставить только цифры и одиночные пробелы между группами */
export function sanitizeDurationInput(raw: string): string {
  return raw
    .replace(/[^\d\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Парсит «1», «1 30», «0 30 0» — часы, минуты, секунды.
 * Минуты и секунды ограничены 0–59.
 */
export function parseDurationTokens(raw: string): {
  h: number
  m: number
  s: number
} | null {
  const trimmed = sanitizeDurationInput(raw)
  if (!trimmed) return null
  const parts = trimmed.split(' ')
  if (parts.length === 0 || parts.length > 3) return null
  for (const p of parts) {
    if (!/^\d+$/.test(p)) return null
  }
  const n = parts.map((x) => parseInt(x, 10))
  let h = 0
  let m = 0
  let s = 0
  if (n.length === 1) [h] = n
  else if (n.length === 2) [h, m] = n
  else [h, m, s] = n
  m = Math.min(59, Math.max(0, m))
  s = Math.min(59, Math.max(0, s))
  return { h, m, s }
}

/** Как parseDurationTokens, но берёт не больше трёх первых чисел (лишние отбрасываются) */
export function parseDurationTokensLoose(raw: string): {
  h: number
  m: number
  s: number
} | null {
  const t = sanitizeDurationInput(raw)
  if (!t) return null
  const direct = parseDurationTokens(t)
  if (direct) return direct
  const nums = t.split(' ').filter((x) => /^\d+$/.test(x)).slice(0, 3)
  if (!nums.length) return null
  return parseDurationTokens(nums.join(' '))
}

/** Как в макете этапа */
export function formatDurationRuFromParts(h: number, m: number, s: number): string {
  return `${h}ч ${m}мин ${s}сек`
}

/** Компактная строка для поля ввода */
export function formatDurationTokensForInput(
  h: number,
  m: number,
  s: number,
): string {
  if (h === 0 && m === 0 && s === 0) return ''
  if (m === 0 && s === 0) return String(h)
  if (s === 0) return `${h} ${m}`
  return `${h} ${m} ${s}`
}

/** Разбор фразы из planned («1ч 30мин 0сек», «40ч 30мин», токены) */
export function parseDurationRuPhrase(text: string): {
  h: number
  m: number
  s: number
} | null {
  const t = text.trim()
  if (!t || t === '—') return null

  const full = t.match(/^(\d+)\s*ч\s*(\d+)\s*мин\s*(\d+)\s*сек\s*$/i)
  if (full) {
    return {
      h: Number.parseInt(full[1], 10),
      m: Number.parseInt(full[2], 10),
      s: Number.parseInt(full[3], 10),
    }
  }

  const hm = t.match(/^(\d+)\s*ч\s*(\d+)\s*мин\s*$/i)
  if (hm) {
    return {
      h: Number.parseInt(hm[1], 10),
      m: Number.parseInt(hm[2], 10),
      s: 0,
    }
  }

  const honly = t.match(/^(\d+)\s*ч\s*$/i)
  if (honly) {
    return { h: Number.parseInt(honly[1], 10), m: 0, s: 0 }
  }

  if (/^\d+(?:\s+\d+){0,2}$/.test(t)) {
    return parseDurationTokens(t)
  }

  return null
}
