import type { CalendarCustomEvent } from '../types/calendarCustomEvent'
import type { FinanceTransaction } from '../types/financeTransaction'
import type { Note } from '../types/note'
import type { Project } from '../types/project'

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function row(cells: string[]): string {
  return cells.map(escapeCsvCell).join(',')
}

export type SettingsExportSnapshot = {
  firstName: string
  lastName: string
  email: string
  telegram: string
  website: string
  jobTitle: string
  about: string
  fontFamily: string
  accentColor: string
}

export function buildPortfolioCsvExport(params: {
  projects: readonly Project[]
  financeTransactions: readonly FinanceTransaction[]
  calendarCustomEvents: readonly CalendarCustomEvent[]
  notes: readonly Note[]
  settingsProfile: SettingsExportSnapshot
}): string {
  const lines: string[] = []

  lines.push('# Настройки профиля (без ключей Supabase)')
  lines.push(
    row([
      'firstName',
      'lastName',
      'email',
      'telegram',
      'website',
      'jobTitle',
      'about',
      'fontFamily',
      'accentColor',
    ]),
  )
  const sp = params.settingsProfile
  lines.push(
    row([
      sp.firstName,
      sp.lastName,
      sp.email,
      sp.telegram,
      sp.website,
      sp.jobTitle,
      sp.about,
      sp.fontFamily,
      sp.accentColor,
    ]),
  )

  lines.push('')
  lines.push('# Проекты')
  lines.push(
    row([
      'id',
      'slug',
      'title',
      'client',
      'amount',
      'employeeHourlyRateRub',
      'deadline',
      'progress',
      'tags',
      'comment',
    ]),
  )
  for (const p of params.projects) {
    lines.push(
      row([
        p.id,
        p.slug,
        p.title,
        p.client,
        p.amount,
        p.employeeHourlyRateRub != null
          ? String(p.employeeHourlyRateRub)
          : '',
        p.deadline,
        String(p.progress),
        JSON.stringify(p.tags ?? []),
        p.comment ?? '',
      ]),
    )
  }

  lines.push('')
  lines.push('# Этапы')
  lines.push(
    row([
      'project_slug',
      'project_title',
      'stage_id',
      'name',
      'status',
      'deadline',
      'planned',
      'actual',
      'timeSpentSeconds',
      'checklist_json',
      'description',
    ]),
  )
  for (const p of params.projects) {
    for (const s of p.stages ?? []) {
      lines.push(
        row([
          p.slug,
          p.title,
          s.id,
          s.name,
          s.status,
          s.deadline,
          s.planned,
          s.actual,
          s.timeSpentSeconds != null ? String(s.timeSpentSeconds) : '',
          JSON.stringify(s.checklist ?? []),
          s.description ?? '',
        ]),
      )
    }
  }

  lines.push('')
  lines.push('# Финансы — транзакции')
  lines.push(row(['id', 'title', 'amountRub', 'kind']))
  for (const t of params.financeTransactions) {
    lines.push(row([t.id, t.title, String(t.amountRub), t.kind]))
  }

  lines.push('')
  lines.push('# Календарь — пользовательские события')
  lines.push(row(['id', 'title', 'dateRaw', 'comment']))
  for (const e of params.calendarCustomEvents) {
    lines.push(row([e.id, e.title, e.dateRaw, e.comment ?? '']))
  }

  lines.push('')
  lines.push('# Заметки')
  lines.push(
    row([
      'id',
      'slug',
      'title',
      'description',
      'createdAt',
      'blocks_json',
      'attachedProjectSlugs_json',
    ]),
  )
  for (const n of params.notes) {
    lines.push(
      row([
        n.id,
        n.slug,
        n.title,
        n.description,
        n.createdAt,
        JSON.stringify(n.blocks),
        JSON.stringify(n.attachedProjectSlugs ?? []),
      ]),
    )
  }

  return lines.join('\r\n')
}

export function downloadUtf8Csv(filename: string, content: string) {
  const BOM = '\uFEFF'
  const blob = new Blob([BOM + content], {
    type: 'text/csv;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  a.click()
  URL.revokeObjectURL(url)
}
