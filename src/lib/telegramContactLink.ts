/** Строка из поля «Telegram» → ссылка https://t.me/… или null */
export function telegramContactHref(raw: string): string | null {
  const t = raw.trim()
  if (!t) return null
  // Классический email (не @username в начале) — ссылку в TG не строим
  if (t.includes('@') && !t.startsWith('@')) return null
  if (/^https?:\/\//i.test(t)) {
    try {
      const url = new URL(t)
      const h = url.hostname.toLowerCase()
      if (h === 't.me' || h === 'www.t.me' || h === 'telegram.me' || h === 'www.telegram.me') {
        return url.toString()
      }
    } catch {
      return null
    }
    return null
  }
  let path = t.replace(/^@+/, '').trim()
  path = path.replace(/^(https?:\/\/)?(t\.me\/|telegram\.me\/)+/i, '')
  const segment = path.split('/')[0]?.split('?')[0]?.trim() ?? ''
  if (!segment) return null
  return `https://t.me/${segment}`
}
