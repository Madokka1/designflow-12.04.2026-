import type { SupabaseClient } from '@supabase/supabase-js'

export type TaskReminderPreset = 'none' | '1h' | '1d' | '1w' | 'custom'

type TaskRow = {
  id: string
  title: string
  done: boolean
  due_date: string
  reminder_preset: string
  reminder_at_custom: string
}

type ProfileRow = {
  id: string
  telegram_chat_id: number | string | null
  telegram_deadline_notify_enabled: boolean | null
}

function parseRuDateParts(
  raw: string,
): { y: number; m: number; d: number } | null {
  const t = raw.trim()
  if (!t) return null
  const m = t.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/)
  if (!m) return null
  const d = Number(m[1])
  const mo = Number(m[2])
  const y = Number(m[3])
  if (!Number.isFinite(d) || !Number.isFinite(mo) || !Number.isFinite(y)) return null
  if (d < 1 || d > 31 || mo < 1 || mo > 12 || y < 1970 || y > 2500) return null
  return { y, m: mo, d }
}

/**
 * Date в UTC, соответствующая "стенному" времени в заданной таймзоне.
 * Реализовано без зависимостей через Intl.
 */
function zonedWallTimeToUtc(
  y: number,
  m: number,
  d: number,
  hh: number,
  mm: number,
  ss: number,
  timeZone: string,
): Date {
  // Начальная оценка — как если бы это было UTC.
  const guess = new Date(Date.UTC(y, m - 1, d, hh, mm, ss))
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })

  const parts = fmt.formatToParts(guess)
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? '0')

  const zy = get('year')
  const zm = get('month')
  const zd = get('day')
  const zhh = get('hour')
  const zmm = get('minute')
  const zss = get('second')

  // Насколько "guess" отличается от желаемого wall time в TZ.
  const desired = Date.UTC(y, m - 1, d, hh, mm, ss)
  const observed = Date.UTC(zy, zm - 1, zd, zhh, zmm, zss)
  const deltaMs = observed - desired
  return new Date(guess.getTime() - deltaMs)
}

function normalizePreset(raw: string): TaskReminderPreset {
  const t = raw.trim()
  if (t === 'none' || t === '1h' || t === '1d' || t === '1w' || t === 'custom') {
    return t
  }
  return 'none'
}

function computeReminderAtUtc(
  task: TaskRow,
  timeZone: string,
): Date | null {
  const preset = normalizePreset(task.reminder_preset ?? '')
  if (preset === 'none') return null
  if (task.done) return null

  if (preset === 'custom') {
    const iso = (task.reminder_at_custom ?? '').trim()
    if (!iso) return null
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return null
    return d
  }

  const due = parseRuDateParts(task.due_date ?? '')
  if (!due) return null

  // В UI "до срока" считается от конца календарного дня (23:59:59) в локальной TZ.
  const endOfDayUtc = zonedWallTimeToUtc(
    due.y,
    due.m,
    due.d,
    23,
    59,
    59,
    timeZone,
  )

  const ms =
    preset === '1h'
      ? 60 * 60 * 1000
      : preset === '1d'
        ? 24 * 60 * 60 * 1000
        : 7 * 24 * 60 * 60 * 1000

  return new Date(endOfDayUtc.getTime() - ms)
}

export async function fetchProfilesForTaskReminders(
  supabase: SupabaseClient,
): Promise<ProfileRow[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, telegram_chat_id, telegram_deadline_notify_enabled')
    .not('telegram_chat_id', 'is', null)
    .eq('telegram_deadline_notify_enabled', true)
  if (error) throw error
  return (data ?? []) as ProfileRow[]
}

export async function fetchUserTasksForReminders(
  supabase: SupabaseClient,
  userId: string,
): Promise<TaskRow[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('id, title, done, due_date, reminder_preset, reminder_at_custom')
    .eq('user_id', userId)
    .neq('reminder_preset', 'none')
  if (error) throw error
  return (data ?? []) as TaskRow[]
}

export async function tryMarkTaskReminderSent(
  supabase: SupabaseClient,
  userId: string,
  taskId: string,
  reminderAt: Date,
): Promise<boolean> {
  const { error } = await supabase.from('telegram_task_reminder_sent').insert({
    user_id: userId,
    task_id: taskId,
    reminder_at: reminderAt.toISOString(),
  })
  if (!error) return true
  if ((error as { code?: string }).code === '23505') return false
  console.warn('[task reminder dedupe]', (error as { message?: string }).message ?? String(error))
  return false
}

export function collectTasksDueForSend(
  tasks: TaskRow[],
  now: Date,
  pollWindowMs: number,
  catchupWindowMs: number,
  timeZone: string,
): { taskId: string; title: string; reminderAt: Date; label: string }[] {
  const out: { taskId: string; title: string; reminderAt: Date; label: string }[] = []
  const nowMs = now.getTime()
  const lookbackMs = Math.max(60_000, catchupWindowMs, pollWindowMs)
  const fromMs = nowMs - lookbackMs

  for (const t of tasks) {
    const at = computeReminderAtUtc(t, timeZone)
    if (!at) continue
    const ms = at.getTime()
    if (Number.isNaN(ms)) continue
    if (ms > nowMs) continue
    if (ms <= fromMs) continue

    const preset = normalizePreset(t.reminder_preset ?? '')
    const label =
      preset === 'custom'
        ? '⏰ Напоминание'
        : preset === '1h'
          ? '⏰ За час до срока'
          : preset === '1d'
            ? '⏰ За день до срока'
            : '⏰ За неделю до срока'

    out.push({ taskId: t.id, title: t.title, reminderAt: at, label })
  }
  return out
}

