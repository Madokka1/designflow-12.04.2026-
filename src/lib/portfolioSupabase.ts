import type { SupabaseClient } from '@supabase/supabase-js'
import { isUuid, randomUuid } from './isUuid'
import type { CalendarCustomEvent } from '../types/calendarCustomEvent'
import type { FinanceTransaction } from '../types/financeTransaction'
import type { Project, ProjectStage } from '../types/project'
import type { ProjectTemplate } from '../types/projectTemplate'
import type { WorkspaceClient } from '../types/workspaceClient'
import { normalizeWorkspaceTask } from './workspaceTaskNormalize'
import type { WorkspaceTask } from '../types/workspaceTask'

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
  archived?: boolean
  client_id?: string | null
  employee_hourly_rate_rub?: number | null
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

function stageFromLooseJson(o: unknown): ProjectStage | null {
  if (!o || typeof o !== 'object') return null
  const r = o as Record<string, unknown>
  if (typeof r.id !== 'string' || typeof r.name !== 'string') return null
  return {
    id: r.id,
    name: r.name,
    status: typeof r.status === 'string' ? r.status : '',
    deadline: typeof r.deadline === 'string' ? r.deadline : '—',
    planned: typeof r.planned === 'string' ? r.planned : '',
    actual: typeof r.actual === 'string' ? r.actual : '',
    timeSpentSeconds:
      typeof r.timeSpentSeconds === 'number' ? r.timeSpentSeconds : undefined,
    actualInPill:
      typeof r.actualInPill === 'boolean' ? r.actualInPill : false,
    description:
      typeof r.description === 'string' ? r.description : undefined,
    checklist: asChecklist(r.checklist),
    modalTags: Array.isArray(r.modalTags)
      ? asStringArray(r.modalTags)
      : undefined,
    addedAt: typeof r.addedAt === 'string' ? r.addedAt : undefined,
  }
}

function parseStagesJsonb(v: unknown): ProjectStage[] {
  if (!Array.isArray(v)) return []
  const out: ProjectStage[] = []
  for (const item of v) {
    const s = stageFromLooseJson(item)
    if (s) out.push(s)
  }
  return out
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
    archived: Boolean(row.archived),
    clientId: row.client_id ?? null,
    employeeHourlyRateRub:
      typeof row.employee_hourly_rate_rub === 'number' &&
      row.employee_hourly_rate_rub > 0
        ? Math.floor(row.employee_hourly_rate_rub)
        : undefined,
  }
}

export type PortfolioBundle = {
  projects: Project[]
  financeTransactions: FinanceTransaction[]
  calendarCustomEvents: CalendarCustomEvent[]
  clients: WorkspaceClient[]
  tasks: WorkspaceTask[]
  templates: ProjectTemplate[]
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
      created_at?: string
    }) => ({
      id: r.id,
      title: r.title,
      amountRub: Number(r.amount_rub),
      kind: r.kind === 'expense' ? 'expense' : 'income',
      createdAt: r.created_at ?? undefined,
    }),
  )

  const { data: cal, error: e4 } = await client
    .from('calendar_custom_events')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  if (e4) throw e4

  const calendarCustomEvents: CalendarCustomEvent[] = (cal ?? []).map(
    (r: {
      id: string
      title: string
      date_raw: string
      comment: string | null
      task_id?: string | null
    }) => ({
      id: r.id,
      title: r.title,
      dateRaw: r.date_raw,
      comment: r.comment ?? undefined,
      taskId: r.task_id ?? undefined,
    }),
  )

  let clients: WorkspaceClient[] = []
  const { data: cData, error: cErr } = await client
    .from('clients')
    .select('*')
    .eq('user_id', userId)
    .order('name', { ascending: true })
  if (!cErr && cData) {
    clients = (cData as {
      id: string
      name: string
      email: string
      phone: string
      company: string
      notes: string
    }[]).map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email ?? '',
      phone: r.phone ?? '',
      company: r.company ?? '',
      notes: r.notes ?? '',
    }))
  }

  let tasks: WorkspaceTask[] = []
  const { data: tData, error: tErr } = await client
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
  if (!tErr && tData) {
    tasks = (tData as {
      id: string
      title: string
      done: boolean
      due_date: string
      project_slug: string | null
      labels: unknown
      sort_order: number
      comment?: string
      reminder_preset?: string
      reminder_at_custom?: string
    }[]).map((r) =>
      normalizeWorkspaceTask({
        id: r.id,
        title: r.title,
        done: r.done,
        dueDate: r.due_date ?? '',
        projectSlug: r.project_slug,
        labels: asStringArray(r.labels),
        sortOrder: r.sort_order ?? 0,
        comment: typeof r.comment === 'string' ? r.comment : '',
        reminderPreset:
          typeof r.reminder_preset === 'string'
            ? (r.reminder_preset as WorkspaceTask['reminderPreset'])
            : undefined,
        reminderAtCustom:
          typeof r.reminder_at_custom === 'string' ? r.reminder_at_custom : '',
      }),
    )
  }

  let templates: ProjectTemplate[] = []
  const { data: tplData, error: tplErr } = await client
    .from('project_templates')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (!tplErr && tplData) {
    templates = (tplData as {
      id: string
      name: string
      stages: unknown
    }[]).map((r) => ({
      id: r.id,
      name: r.name,
      stages: parseStagesJsonb(r.stages),
    }))
  }

  return {
    projects,
    financeTransactions,
    calendarCustomEvents,
    clients,
    tasks,
    templates,
  }
}

/**
 * Этапы из старых бэкапов/шаблонов могли иметь id вроде "s1"; в БД только uuid.
 */
function normalizeProjectStagesForSupabase(project: Project): {
  project: Project
  changed: boolean
} {
  let changed = false
  const stages = (project.stages ?? []).map((stage) => {
    let id = stage.id
    if (!isUuid(id)) {
      id = randomUuid()
      changed = true
    }
    let checklist = stage.checklist
    if (checklist?.length) {
      let clChanged = false
      const next = checklist.map((c) => {
        if (isUuid(c.id)) return c
        clChanged = true
        return { ...c, id: randomUuid() }
      })
      if (clChanged) {
        checklist = next
        changed = true
      }
    }
    return { ...stage, id, checklist }
  })
  return { project: { ...project, stages }, changed }
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

export type UpsertProjectToSupabaseResult = {
  error: Error | null
  /** Если id этапов были исправлены под uuid — подставьте проект в состояние UI. */
  remappedProject?: Project
}

export async function upsertProjectToSupabase(
  client: SupabaseClient,
  userId: string,
  project: Project,
): Promise<UpsertProjectToSupabaseResult> {
  const { project: toSave, changed } = normalizeProjectStagesForSupabase(project)
  const tags = toSave.tags ?? []
  const row: Record<string, unknown> = {
    id: toSave.id,
    user_id: userId,
    slug: toSave.slug,
    title: toSave.title,
    client: toSave.client,
    amount: toSave.amount,
    deadline: toSave.deadline,
    progress: toSave.progress,
    tags,
    comment: toSave.comment ?? null,
    archived: toSave.archived ?? false,
    client_id: toSave.clientId ?? null,
    employee_hourly_rate_rub: toSave.employeeHourlyRateRub ?? null,
  }
  const { error: e1 } = await client.from('projects').upsert(row, {
    onConflict: 'id',
  })
  if (e1) return { error: e1 }

  const stages = toSave.stages ?? []
  const { data: existing, error: e2 } = await client
    .from('project_stages')
    .select('id')
    .eq('project_id', toSave.id)

  if (e2) return { error: e2 }

  const existingIds = new Set((existing ?? []).map((x: { id: string }) => x.id))
  const currentIds = new Set(stages.map((s) => s.id))
  const toDelete = [...existingIds].filter((id) => !currentIds.has(id))
  if (toDelete.length > 0) {
    const { error: e3 } = await client.from('project_stages').delete().in('id', toDelete)
    if (e3) return { error: e3 }
  }

  for (let i = 0; i < stages.length; i++) {
    const rowSt = stageToRow(stages[i], toSave.id, i)
    const { error: e4 } = await client.from('project_stages').upsert(rowSt, {
      onConflict: 'id',
    })
    if (e4) return { error: e4 }
  }

  return {
    error: null,
    remappedProject: changed ? toSave : undefined,
  }
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
      task_id: ev.taskId ?? null,
    },
    { onConflict: 'id' },
  )
  return error
}

export async function deleteCalendarEventRemote(
  client: SupabaseClient,
  eventId: string,
): Promise<Error | null> {
  const { error } = await client
    .from('calendar_custom_events')
    .delete()
    .eq('id', eventId)
  return error
}

export async function upsertClientRemote(
  client: SupabaseClient,
  userId: string,
  c: WorkspaceClient,
): Promise<Error | null> {
  const { error } = await client.from('clients').upsert(
    {
      id: c.id,
      user_id: userId,
      name: c.name,
      email: c.email,
      phone: c.phone,
      company: c.company,
      notes: c.notes,
    },
    { onConflict: 'id' },
  )
  return error
}

export async function deleteClientRemote(
  client: SupabaseClient,
  clientRowId: string,
): Promise<Error | null> {
  const { error } = await client.from('clients').delete().eq('id', clientRowId)
  return error
}

export async function upsertTaskRemote(
  client: SupabaseClient,
  userId: string,
  t: WorkspaceTask,
): Promise<Error | null> {
  const { error } = await client.from('tasks').upsert(
    {
      id: t.id,
      user_id: userId,
      title: t.title,
      done: t.done,
      due_date: t.dueDate,
      project_slug: t.projectSlug,
      labels: t.labels,
      sort_order: t.sortOrder,
      comment: t.comment,
      reminder_preset: t.reminderPreset,
      reminder_at_custom: t.reminderAtCustom,
    },
    { onConflict: 'id' },
  )
  return error
}

export async function deleteTaskRemote(
  client: SupabaseClient,
  taskId: string,
): Promise<Error | null> {
  const { error } = await client.from('tasks').delete().eq('id', taskId)
  return error
}

export async function upsertTemplateRemote(
  client: SupabaseClient,
  userId: string,
  tpl: ProjectTemplate,
): Promise<Error | null> {
  const { error } = await client.from('project_templates').upsert(
    {
      id: tpl.id,
      user_id: userId,
      name: tpl.name,
      stages: tpl.stages,
    },
    { onConflict: 'id' },
  )
  return error
}

export async function deleteTemplateRemote(
  client: SupabaseClient,
  templateId: string,
): Promise<Error | null> {
  const { error } = await client
    .from('project_templates')
    .delete()
    .eq('id', templateId)
  return error
}

/** Удаление проекта; этапы удаляются каскадом (FK). */
export async function deleteProjectFromSupabase(
  client: SupabaseClient,
  projectId: string,
): Promise<Error | null> {
  const { error } = await client.from('projects').delete().eq('id', projectId)
  return error
}

export async function deleteTasksForProjectSlugRemote(
  client: SupabaseClient,
  userId: string,
  projectSlug: string,
): Promise<Error | null> {
  const { error } = await client
    .from('tasks')
    .delete()
    .eq('user_id', userId)
    .eq('project_slug', projectSlug)
  return error
}
