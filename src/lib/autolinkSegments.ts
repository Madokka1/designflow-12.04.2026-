export type AutolinkSegment =
  | { kind: 'text'; text: string }
  | { kind: 'link'; text: string; href: string }

/** Убираем типичный «хвост» после URL в скобках/предложениях. */
function trimUrlTrailingPunctuation(href: string): string {
  return href.replace(/[.,;:!?*~)\]}>'"\]]+$/u, '')
}

/**
 * Разбивает текст на фрагменты: обычный текст и http(s)-ссылки.
 * Не считает ссылкой «голый» www. без схемы.
 */
export function parseAutolinkSegments(input: string): AutolinkSegment[] {
  if (!input) return []
  const re = /https?:\/\/[^\s<>"']+/gi
  const out: AutolinkSegment[] = []
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(input)) !== null) {
    if (m.index > last) {
      out.push({ kind: 'text', text: input.slice(last, m.index) })
    }
    const raw = m[0]
    const href = trimUrlTrailingPunctuation(raw)
    out.push({ kind: 'link', text: href, href })
    last = m.index + raw.length
  }
  if (last < input.length) {
    out.push({ kind: 'text', text: input.slice(last) })
  }
  return out.length ? out : [{ kind: 'text', text: input }]
}
