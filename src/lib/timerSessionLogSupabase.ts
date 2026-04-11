import type { SupabaseClient } from '@supabase/supabase-js'
import type { TimerSessionLogEntry } from '../types/timerSessionLog'
import { TIMER_SESSION_LOG_MAX } from './timerSessionsStorage'

type DbRow = {
  id: string
  ended_at: string
  seconds: number
  project_slug: string
  stage_id: string
  project_title: string
  stage_name: string
}

function rowToEntry(r: DbRow): TimerSessionLogEntry {
  return {
    id: r.id,
    endedAt: r.ended_at,
    seconds: r.seconds,
    projectSlug: r.project_slug,
    stageId: r.stage_id,
    projectTitle: r.project_title ?? '',
    stageName: r.stage_name ?? '',
  }
}

export function mergeTimerSessionLogs(
  remote: readonly TimerSessionLogEntry[],
  local: readonly TimerSessionLogEntry[],
): TimerSessionLogEntry[] {
  const m = new Map<string, TimerSessionLogEntry>()
  for (const e of remote) m.set(e.id, e)
  for (const e of local) {
    if (!m.has(e.id)) m.set(e.id, e)
  }
  return [...m.values()]
    .sort(
      (a, b) =>
        new Date(b.endedAt).getTime() - new Date(a.endedAt).getTime(),
    )
    .slice(0, TIMER_SESSION_LOG_MAX)
}

export async function fetchTimerSessionLogFromSupabase(
  client: SupabaseClient,
  userId: string,
): Promise<TimerSessionLogEntry[]> {
  const { data, error } = await client
    .from('timer_session_log')
    .select(
      'id,ended_at,seconds,project_slug,stage_id,project_title,stage_name',
    )
    .eq('user_id', userId)
    .order('ended_at', { ascending: false })
    .limit(4000)
  if (error || !data?.length) return []
  return (data as DbRow[]).map(rowToEntry)
}

export async function insertTimerSessionLogRow(
  client: SupabaseClient,
  userId: string,
  e: TimerSessionLogEntry,
): Promise<boolean> {
  const { error } = await client.from('timer_session_log').insert({
    id: e.id,
    user_id: userId,
    ended_at: e.endedAt,
    seconds: e.seconds,
    project_slug: e.projectSlug,
    stage_id: e.stageId,
    project_title: e.projectTitle,
    stage_name: e.stageName,
  })
  return !error
}

export async function clearTimerSessionLogRemote(
  client: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { error } = await client
    .from('timer_session_log')
    .delete()
    .eq('user_id', userId)
  return !error
}
