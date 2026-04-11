import type { CalendarCustomEvent } from '../types/calendarCustomEvent'
import type { FinanceTransaction } from '../types/financeTransaction'
import type { Note } from '../types/note'
import type { Project } from '../types/project'
import type { SettingsExportSnapshot } from './exportPortfolioCsv'

const SCHEMA_VERSION = 1 as const

export type PortfolioJsonBackup = {
  schemaVersion: typeof SCHEMA_VERSION
  exportedAt: string
  settingsProfile: SettingsExportSnapshot
  projects: Project[]
  financeTransactions: FinanceTransaction[]
  calendarCustomEvents: CalendarCustomEvent[]
  notes: Note[]
}

export function buildPortfolioJsonBackup(params: {
  projects: readonly Project[]
  financeTransactions: readonly FinanceTransaction[]
  calendarCustomEvents: readonly CalendarCustomEvent[]
  notes: readonly Note[]
  settingsProfile: SettingsExportSnapshot
}): string {
  const payload: PortfolioJsonBackup = {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    settingsProfile: { ...params.settingsProfile },
    projects: JSON.parse(JSON.stringify(params.projects)) as Project[],
    financeTransactions: JSON.parse(
      JSON.stringify(params.financeTransactions),
    ) as FinanceTransaction[],
    calendarCustomEvents: JSON.parse(
      JSON.stringify(params.calendarCustomEvents),
    ) as CalendarCustomEvent[],
    notes: JSON.parse(JSON.stringify(params.notes)) as Note[],
  }
  return `${JSON.stringify(payload, null, 2)}\n`
}

function isObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

export function parsePortfolioJsonBackup(
  raw: string,
):
  | { ok: true; data: Omit<PortfolioJsonBackup, 'schemaVersion'> & { schemaVersion: number } }
  | { ok: false; error: string } {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw) as unknown
  } catch {
    return { ok: false, error: 'Некорректный JSON' }
  }
  if (!isObject(parsed)) {
    return { ok: false, error: 'Ожидался объект в корне файла' }
  }
  if (parsed.schemaVersion !== SCHEMA_VERSION) {
    return {
      ok: false,
      error: `Версия схемы ${String(parsed.schemaVersion)} не поддерживается (ожидается ${SCHEMA_VERSION})`,
    }
  }
  if (!Array.isArray(parsed.projects) || !Array.isArray(parsed.notes)) {
    return { ok: false, error: 'В файле нет массивов projects / notes' }
  }
  if (
    !Array.isArray(parsed.financeTransactions) ||
    !Array.isArray(parsed.calendarCustomEvents)
  ) {
    return { ok: false, error: 'В файле нет financeTransactions / calendarCustomEvents' }
  }
  if (!isObject(parsed.settingsProfile)) {
    return { ok: false, error: 'Нет блока settingsProfile' }
  }
  const sp = parsed.settingsProfile
  const keys = [
    'firstName',
    'lastName',
    'email',
    'telegram',
    'website',
    'jobTitle',
    'about',
    'fontFamily',
    'accentColor',
  ] as const
  for (const k of keys) {
    if (typeof sp[k] !== 'string') {
      return { ok: false, error: `settingsProfile.${k} должен быть строкой` }
    }
  }
  return {
    ok: true,
    data: parsed as Omit<PortfolioJsonBackup, 'schemaVersion'> & {
      schemaVersion: number
    },
  }
}
