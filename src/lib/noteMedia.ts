/** YouTube: watch, youtu.be, embed, shorts, live */
export function youtubeVideoId(url: string): string | null {
  const s = url.trim()
  if (!s) return null
  try {
    const u = new URL(s.startsWith('http') ? s : `https://${s}`)
    const host = u.hostname.replace(/^www\./, '')
    if (host === 'youtu.be') {
      const id = u.pathname.replace(/^\//, '').split('/')[0]
      return id?.replace(/[^a-zA-Z0-9_-]/g, '') || null
    }
    if (
      host === 'youtube.com' ||
      host === 'm.youtube.com' ||
      host === 'music.youtube.com'
    ) {
      const v = u.searchParams.get('v')
      if (v) return v.replace(/[^a-zA-Z0-9_-]/g, '') || null
      const m = u.pathname.match(/\/(?:embed|shorts|live)\/([^/?]+)/)
      if (m?.[1]) return m[1]
    }
  } catch {
    /* ignore */
  }
  return null
}

export function vimeoVideoId(url: string): string | null {
  const s = url.trim()
  if (!s) return null
  try {
    const u = new URL(s.startsWith('http') ? s : `https://${s}`)
    const host = u.hostname.replace(/^www\./, '')
    if (host === 'vimeo.com' || host === 'player.vimeo.com') {
      const m = u.pathname.match(/\/(?:video\/)?(\d+)/)
      if (m?.[1]) return m[1]
    }
  } catch {
    /* ignore */
  }
  return null
}
