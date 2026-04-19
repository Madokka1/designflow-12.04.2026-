import { emptyResume, type PortfolioResume, RESUME_SCHEMA_VERSION } from '../types/resume'

const STORAGE_KEY = 'portfolio-resume-v1'

function newId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `r-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export { newId as newResumeRowId }

export function normalizeResume(raw: unknown): PortfolioResume {
  if (!raw || typeof raw !== 'object') return emptyResume()
  const o = raw as Record<string, unknown>
  if (o.schemaVersion !== 1 && o.schemaVersion !== undefined) {
    /* будущие версии — пока сброс на v1 */
  }
  const str = (v: unknown) => (typeof v === 'string' ? v : '')
  const arrSkills = (v: unknown): PortfolioResume['skills'] => {
    if (!Array.isArray(v)) return []
    return v
      .filter((x) => x && typeof x === 'object')
      .map((x) => {
        const s = x as Record<string, unknown>
        return {
          id: typeof s.id === 'string' ? s.id : newId(),
          name: str(s.name),
        }
      })
  }
  const arrStr = (v: unknown): string[] => {
    if (!Array.isArray(v)) return []
    return v.filter((x): x is string => typeof x === 'string').map((x) => x.trim()).filter(Boolean)
  }
  const arrCases = (v: unknown): PortfolioResume['cases'] => {
    if (!Array.isArray(v)) return []
    return v
      .filter((x) => x && typeof x === 'object')
      .map((x) => {
        const c = x as Record<string, unknown>
        return {
          id: typeof c.id === 'string' ? c.id : newId(),
          title: str(c.title),
          role: str(c.role),
          description: str(c.description),
          url: str(c.url),
          stack: str(c.stack),
        }
      })
  }
  const arrEdu = (v: unknown): PortfolioResume['education'] => {
    if (!Array.isArray(v)) return []
    return v
      .filter((x) => x && typeof x === 'object')
      .map((x) => {
        const e = x as Record<string, unknown>
        return {
          id: typeof e.id === 'string' ? e.id : newId(),
          institution: str(e.institution),
          degree: str(e.degree),
          period: str(e.period),
        }
      })
  }
  const arrLang = (v: unknown): PortfolioResume['languages'] => {
    if (!Array.isArray(v)) return []
    return v
      .filter((x) => x && typeof x === 'object')
      .map((x) => {
        const l = x as Record<string, unknown>
        return {
          id: typeof l.id === 'string' ? l.id : newId(),
          name: str(l.name),
          level: str(l.level),
        }
      })
  }

  return {
    schemaVersion: RESUME_SCHEMA_VERSION,
    photoDataUrl: str(o.photoDataUrl),
    fullName: str(o.fullName),
    headline: str(o.headline),
    location: str(o.location),
    summary: str(o.summary),
    contactEmail: str(o.contactEmail),
    contactPhone: str(o.contactPhone),
    contactLinks: str(o.contactLinks),
    skills: arrSkills(o.skills),
    personalQualities: arrStr(o.personalQualities),
    cases: arrCases(o.cases),
    education: arrEdu(o.education),
    languages: arrLang(o.languages),
  }
}

export function loadResume(): PortfolioResume {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyResume()
    return normalizeResume(JSON.parse(raw))
  } catch {
    return emptyResume()
  }
}

export function saveResume(data: PortfolioResume): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    /* квота / приватный режим */
  }
}

/** Сжатие фото: макс. ширина 480px, jpeg, чтобы не забивать localStorage */
export async function imageFileToDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const maxW = 480
  const scale = bitmap.width > maxW ? maxW / bitmap.width : 1
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()
  return canvas.toDataURL('image/jpeg', 0.82)
}
