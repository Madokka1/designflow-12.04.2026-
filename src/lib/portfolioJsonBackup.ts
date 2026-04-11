import type { CalendarCustomEvent } from '../types/calendarCustomEvent'
import type { FinanceTransaction } from '../types/financeTransaction'
import type { Note } from '../types/note'
import type { Project } from '../types/project'
import type { ProjectTemplate } from '../types/projectTemplate'
import type { WorkspaceClient } from '../types/workspaceClient'
import type { WorkspaceTask } from '../types/workspaceTask'
import type { SettingsFontId } from '../types/settings'
import type { SettingsExportSnapshot } from './exportPortfolioCsv'

/** v1 — без clients/tasks/templates; v2 — полный бэкап. */
const SCHEMA_VERSION_LATEST = 2 as const

const FONT_IDS: SettingsFontId[] = ['inter', 'georgia', 'jetbrains', 'system']

export type PortfolioJsonBackup = {
  schemaVersion: typeof SCHEMA_VERSION_LATEST
  exportedAt: string
  settingsProfile: SettingsExportSnapshot
  projects: Project[]
  financeTransactions: FinanceTransaction[]
  calendarCustomEvents: CalendarCustomEvent[]
  notes: Note[]
  clients: WorkspaceClient[]
  tasks: WorkspaceTask[]
  templates: ProjectTemplate[]
}

export type ParsedPortfolioBackup = Omit<PortfolioJsonBackup, 'schemaVersion'> & {
  schemaVersion: number
}

export function buildPortfolioJsonBackup(params: {
  projects: readonly Project[]
  financeTransactions: readonly FinanceTransaction[]
  calendarCustomEvents: readonly CalendarCustomEvent[]
  notes: readonly Note[]
  settingsProfile: SettingsExportSnapshot
  clients?: readonly WorkspaceClient[]
  tasks?: readonly WorkspaceTask[]
  templates?: readonly ProjectTemplate[]
}): string {
  const payload: PortfolioJsonBackup = {
    schemaVersion: SCHEMA_VERSION_LATEST,
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
    clients: JSON.parse(JSON.stringify(params.clients ?? [])) as WorkspaceClient[],
    tasks: JSON.parse(JSON.stringify(params.tasks ?? [])) as WorkspaceTask[],
    templates: JSON.parse(JSON.stringify(params.templates ?? [])) as ProjectTemplate[],
  }
  return `${JSON.stringify(payload, null, 2)}\n`
}

function isObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

function normalizeSchemaVersion(v: unknown): 1 | 2 | null {
  if (v === 1 || v === '1') return 1
  if (v === 2 || v === '2') return 2
  if (typeof v === 'number' && (v === 1 || v === 2)) return v
  return null
}

function normalizeSettingsProfile(
  spRaw: Record<string, unknown>,
  warnings: string[],
): SettingsExportSnapshot {
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
  const out = {} as SettingsExportSnapshot
  for (const k of keys) {
    const v = spRaw[k]
    if (v == null || typeof v === 'boolean' || typeof v === 'number') {
      out[k] = v == null ? '' : String(v)
      if (v != null && typeof v !== 'string') {
        warnings.push(`settingsProfile.${k} приведён к строке`)
      }
    } else if (typeof v === 'string') {
      out[k] = v
    } else {
      out[k] = JSON.stringify(v)
      warnings.push(`settingsProfile.${k} сериализован в строку`)
    }
  }
  let font = out.fontFamily as SettingsFontId
  if (!FONT_IDS.includes(font)) {
    warnings.push(`Неизвестный fontFamily «${font}», подставлен inter`)
    font = 'inter'
    out.fontFamily = font
  }
  return out
}

export function parsePortfolioJsonBackup(
  raw: string,
):
  | { ok: true; data: ParsedPortfolioBackup; warnings: string[] }
  | { ok: false; error: string } {
  const warnings: string[] = []
  const text = raw.replace(/^\uFEFF/, '').trim()
  let parsed: unknown
  try {
    parsed = JSON.parse(text) as unknown
  } catch {
    return { ok: false, error: 'Некорректный JSON' }
  }
  if (!isObject(parsed)) {
    return { ok: false, error: 'Ожидался объект в корне файла' }
  }
  const ver = normalizeSchemaVersion(parsed.schemaVersion)
  if (ver === null) {
    return {
      ok: false,
      error: `Версия схемы ${String(parsed.schemaVersion)} не поддерживается (ожидается 1 или 2)`,
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

  let clients: WorkspaceClient[] = []
  let tasks: WorkspaceTask[] = []
  let templates: ProjectTemplate[] = []

  if (ver === SCHEMA_VERSION_LATEST) {
    if (!Array.isArray(parsed.clients)) {
      warnings.push('В файле v2 нет массива clients — подставлен []')
      clients = []
    } else {
      clients = parsed.clients as WorkspaceClient[]
    }
    if (!Array.isArray(parsed.tasks)) {
      warnings.push('В файле v2 нет массива tasks — подставлен []')
      tasks = []
    } else {
      tasks = parsed.tasks as WorkspaceTask[]
    }
    if (!Array.isArray(parsed.templates)) {
      warnings.push('В файле v2 нет массива templates — подставлен []')
      templates = []
    } else {
      templates = parsed.templates as ProjectTemplate[]
    }
  }

  if (!isObject(parsed.settingsProfile)) {
    return { ok: false, error: 'Нет блока settingsProfile' }
  }
  const settingsProfile = normalizeSettingsProfile(
    parsed.settingsProfile as Record<string, unknown>,
    warnings,
  )

  const data: ParsedPortfolioBackup = {
    schemaVersion: ver,
    exportedAt:
      typeof parsed.exportedAt === 'string'
        ? parsed.exportedAt
        : new Date().toISOString(),
    settingsProfile,
    projects: parsed.projects as Project[],
    financeTransactions: parsed.financeTransactions as FinanceTransaction[],
    calendarCustomEvents: parsed.calendarCustomEvents as CalendarCustomEvent[],
    notes: parsed.notes as Note[],
    clients,
    tasks,
    templates,
  }

  return { ok: true, data, warnings }
}
