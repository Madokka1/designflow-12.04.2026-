import type { SupabaseClient } from '@supabase/supabase-js'

type ProfileRow = {
  id: string
  telegram_chat_id: number | string | null
  telegram_deadline_notify_enabled: boolean | null
  telegram_deadline_notify_days_before: number | null
}

type ProjectRow = {
  id: string
  slug: string
  title: string
  deadline: string
  archived: boolean | null
}

type StageRow = {
  id: string
  project_id: string
  name: string
  deadline: string
}

type TaskRow = {
  id: string
  title: string
  done: boolean
  due_date: string
}

export type DeadlineCandidate = {
  dedupeKey: string
  whenLabel: string
  title: string
}

function parseRuDateParts(raw: string): { d: number; m: number; y: number } | null {
  const t = raw.trim()
  if (!t) return null
  const m = t.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/)
  if (!m) return null
  return { d: Number(m[1]), m: Number(m[2]), y: Number(m[3]) }
}

/** Сегодняшняя дата в календаре указанной таймзоны → {y,m,d}. */
export function calendarTodayInTimeZone(timeZone: string): { y: number; m: number; d: number } {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = fmt.formatToParts(new Date())
  const y = Number(parts.find((p) => p.type === 'year')?.value)
  const m = Number(parts.find((p) => p.type === 'month')?.value)
  const d = Number(parts.find((p) => p.type === 'day')?.value)
  return { y, m, d }
}

export function dayKeyFromYmd(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/** Разница в календарных днях: to − from (оба inclusive calendar dates). */
function calendarDaysBetween(
  from: { y: number; m: number; d: number },
  to: { y: number; m: number; d: number },
): number {
  const a = Date.UTC(from.y, from.m - 1, from.d)
  const b = Date.UTC(to.y, to.m - 1, to.d)
  return Math.round((b - a) / 86_400_000)
}

function isDeadlineInWindow(
  deadlineRaw: string,
  today: { y: number; m: number; d: number },
  daysBefore: number,
): boolean {
  const p = parseRuDateParts(deadlineRaw)
  if (!p) return false
  const delta = calendarDaysBetween(today, p)
  return delta >= 0 && delta <= daysBefore
}

export function collectDeadlineCandidates(
  projects: ProjectRow[],
  stagesByProject: Map<string, StageRow[]>,
  tasks: TaskRow[],
  today: { y: number; m: number; d: number },
  daysBefore: number,
): DeadlineCandidate[] {
  const out: DeadlineCandidate[] = []
  for (const p of projects) {
    if (p.archived === true) continue
    if (isDeadlineInWindow(p.deadline ?? '', today, daysBefore)) {
      out.push({
        dedupeKey: `proj-${p.slug}`,
        whenLabel: p.deadline.trim(),
        title: p.title,
      })
    }
    const sts = stagesByProject.get(p.id) ?? []
    for (const s of sts) {
      if (isDeadlineInWindow(s.deadline ?? '', today, daysBefore)) {
        out.push({
          dedupeKey: `stage-${p.slug}-${s.id}`,
          whenLabel: (s.deadline ?? '').trim(),
          title: `${s.name} · ${p.title}`,
        })
      }
    }
  }
  for (const t of tasks) {
    if (t.done) continue
    if (isDeadlineInWindow(t.due_date ?? '', today, daysBefore)) {
      out.push({
        dedupeKey: `task-${t.id}`,
        whenLabel: (t.due_date ?? '').trim(),
        title: t.title,
      })
    }
  }
  return out
}

export async function fetchProfilesForTelegramNotify(
  supabase: SupabaseClient,
): Promise<ProfileRow[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, telegram_chat_id, telegram_deadline_notify_enabled, telegram_deadline_notify_days_before')
    .not('telegram_chat_id', 'is', null)
    .eq('telegram_deadline_notify_enabled', true)
  if (error) throw error
  return (data ?? []) as ProfileRow[]
}

export async function fetchUserPortfolioSlice(
  supabase: SupabaseClient,
  userId: string,
): Promise<{
  projects: ProjectRow[]
  stagesByProject: Map<string, StageRow[]>
  tasks: TaskRow[]
}> {
  const { data: projRows, error: e1 } = await supabase
    .from('projects')
    .select('id, slug, title, deadline, archived')
    .eq('user_id', userId)
  if (e1) throw e1
  const projects = (projRows ?? []) as ProjectRow[]
  const ids = projects.map((p) => p.id)
  const stagesByProject = new Map<string, StageRow[]>()
  if (ids.length > 0) {
    const { data: stRows, error: e2 } = await supabase
      .from('project_stages')
      .select('id, project_id, name, deadline')
      .in('project_id', ids)
    if (e2) throw e2
    for (const s of (stRows ?? []) as StageRow[]) {
      const list = stagesByProject.get(s.project_id) ?? []
      list.push(s)
      stagesByProject.set(s.project_id, list)
    }
  }
  const { data: taskRows, error: e3 } = await supabase
    .from('tasks')
    .select('id, title, done, due_date')
    .eq('user_id', userId)
  if (e3) throw e3
  return {
    projects,
    stagesByProject,
    tasks: (taskRows ?? []) as TaskRow[],
  }
}

export async function tryMarkDeadlineSent(
  supabase: SupabaseClient,
  userId: string,
  dedupeKey: string,
  dayKey: string,
): Promise<boolean> {
  const { error } = await supabase.from('telegram_deadline_sent').insert({
    user_id: userId,
    dedupe_key: dedupeKey,
    day_key: dayKey,
  })
  if (!error) return true
  if (error.code === '23505') return false
  console.warn('[deadline dedupe]', error.message)
  return false
}
