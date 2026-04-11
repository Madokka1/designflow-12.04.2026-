import type { SupabaseClient } from '@supabase/supabase-js'
import type { CalendarCustomEvent } from '../types/calendarCustomEvent'
import type { FinanceTransaction } from '../types/financeTransaction'
import type { Project, ProjectStage } from '../types/project'

type ProjectRow = {
  id: string
  user_id: string
  slug: string
  title: string
  client: string
  amount: string
  deadline: string
  progress: number
  tags: unknown
  comment: string | null
}

type StageRow = {
  id: string
  project_id: string
  name: string
  status: string
  deadline: string
  planned: string
  actual: string
  time_spent_seconds: number | null
  actual_in_pill: boolean
  description: string | null
  checklist: unknown
  modal_tags: unknown
  added_at: string | null
  sort_order: number
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.filter((x): x is string => typeof x === 'string')
}

function asChecklist(v: unknown): ProjectStage['checklist'] {
  if (!Array.isArray(v)) return undefined
  const out: { id: string; label: string; done?: boolean }[] = []
  for (const item of v) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    if (typeof o.id !== 'string' || typeof o.label !== 'string') continue
    out.push({
      id: o.id,
      label: o.label,
      done: typeof o.done === 'boolean' ? o.done : undefined,
    })
  }
  return out.length ? out : undefined
}

function stageRowToStage(row: StageRow): ProjectStage {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    deadline: row.deadline,
    planned: row.planned,
    actual: row.actual,
    timeSpentSeconds: row.time_spent_seconds ?? undefined,
    actualInPill: row.actual_in_pill,
    description: row.description ?? undefined,
    checklist: asChecklist(row.checklist),
    modalTags: asStringArray(row.modal_tags),
    addedAt: row.added_at ? new Date(row.added_at).toISOString() : undefined,
  }
}

function rowToProject(row: ProjectRow, stages: StageRow[]): Project {
  const tags = asStringArray(row.tags)
  const sorted = [...stages].sort((a, b) => a.sort_order - b.sort_order)
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    client: row.client,
    amount: row.amount,
    deadline: row.deadline,
    progress: row.progress,
    tags: tags.length ? tags : undefined,
    comment: row.comment ?? undefined,
    stages: sorted.map(stageRowToStage),
  }
}

export type PortfolioBundle = {
  projects: Project[]
  financeTransactions: FinanceTransaction[]
  calendarCustomEvents: CalendarCustomEvent[]
}

export async function fetchPortfolioBundle(
  client: SupabaseClient,
  userId: string,
): Promise<PortfolioBundle> {
  const { data: projRows, error: e1 } = await client
    .from('projects')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (e1) throw e1

  const projectsRaw = (projRows ?? []) as ProjectRow[]
  const ids = projectsRaw.map((p) => p.id)

  let stageRows: StageRow[] = []
  if (ids.length > 0) {
    const { data: st, error: e2 } = await client
      .from('project_stages')
      .select('*')
      .in('project_id', ids)
    if (e2) throw e2
    stageRows = (st ?? []) as StageRow[]
  }

  const byProject = new Map<string, StageRow[]>()
  for (const s of stageRows) {
    const list = byProject.get(s.project_id) ?? []
    list.push(s)
    byProject.set(s.project_id, list)
  }

  const projects = projectsRaw.map((row) =>
    rowToProject(row, byProject.get(row.id) ?? []),
  )

  const { data: fin, error: e3 } = await client
    .from('finance_transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (e3) throw e3

  const financeTransactions: FinanceTransaction[] = (fin ?? []).map(
    (r: {
      id: string
      title: string
      amount_rub: string | number
      kind: string
    }) => ({
      id: r.id,
      title: r.title,
      amountRub: Number(r.amount_rub),
      kind: r.kind === 'expense' ? 'expense' : 'income',
    }),
  )

  const { data: cal, error: e4 } = await client
    .from('calendar_custom_events')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  if (e4) throw e4

  const calendarCustomEvents: CalendarCustomEvent[] = (cal ?? []).map(
    (r: { id: string; title: string; date_raw: string; comment: string | null }) => ({
      id: r.id,
      title: r.title,
      dateRaw: r.date_raw,
      comment: r.comment ?? undefined,
    }),
  )

  return { projects, financeTransactions, calendarCustomEvents }
}

function stageToRow(s: ProjectStage, projectId: string, sortOrder: number): Record<string, unknown> {
  return {
    id: s.id,
    project_id: projectId,
    name: s.name,
    status: s.status,
    deadline: s.deadline,
    planned: s.planned,
    actual: s.actual,
    time_spent_seconds: s.timeSpentSeconds ?? null,
    actual_in_pill: s.actualInPill ?? false,
    description: s.description ?? null,
    checklist: s.checklist ?? [],
    modal_tags: s.modalTags ?? [],
    added_at: s.addedAt ?? null,
    sort_order: sortOrder,
  }
}

export async function upsertProjectToSupabase(
  client: SupabaseClient,
  userId: string,
  project: Project,
): Promise<Error | null> {
  const tags = project.tags ?? []
  const { error: e1 } = await client.from('projects').upsert(
    {
      id: project.id,
      user_id: userId,
      slug: project.slug,
      title: project.title,
      client: project.client,
      amount: project.amount,
      deadline: project.deadline,
      progress: project.progress,
      tags,
      comment: project.comment ?? null,
    },
    { onConflict: 'id' },
  )
  if (e1) return e1

  const stages = project.stages ?? []
  const { data: existing, error: e2 } = await client
    .from('project_stages')
    .select('id')
    .eq('project_id', project.id)

  if (e2) return e2

  const existingIds = new Set((existing ?? []).map((x: { id: string }) => x.id))
  const currentIds = new Set(stages.map((s) => s.id))
  const toDelete = [...existingIds].filter((id) => !currentIds.has(id))
  if (toDelete.length > 0) {
    const { error: e3 } = await client.from('project_stages').delete().in('id', toDelete)
    if (e3) return e3
  }

  for (let i = 0; i < stages.length; i++) {
    const row = stageToRow(stages[i], project.id, i)
    const { error: e4 } = await client.from('project_stages').upsert(row, {
      onConflict: 'id',
    })
    if (e4) return e4
  }

  return null
}

export async function upsertFinanceTransactionRemote(
  client: SupabaseClient,
  userId: string,
  tx: FinanceTransaction,
): Promise<Error | null> {
  const { error } = await client.from('finance_transactions').upsert(
    {
      id: tx.id,
      user_id: userId,
      title: tx.title,
      amount_rub: tx.amountRub,
      kind: tx.kind,
    },
    { onConflict: 'id' },
  )
  return error
}

export async function upsertCalendarEventRemote(
  client: SupabaseClient,
  userId: string,
  ev: CalendarCustomEvent,
): Promise<Error | null> {
  const { error } = await client.from('calendar_custom_events').upsert(
    {
      id: ev.id,
      user_id: userId,
      title: ev.title,
      date_raw: ev.dateRaw,
      comment: ev.comment ?? null,
    },
    { onConflict: 'id' },
  )
  return error
}
