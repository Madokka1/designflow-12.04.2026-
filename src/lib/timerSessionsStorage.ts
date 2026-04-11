import type { TimerSessionLogEntry } from '../types/timerSessionLog'

const STORAGE_KEY = 'portfolio-timer-sessions-v1'
/** Лимит записей локально и при слиянии с Supabase */
export const TIMER_SESSION_LOG_MAX = 2000

function loadRaw(): TimerSessionLogEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (x): x is TimerSessionLogEntry =>
        x != null &&
        typeof x === 'object' &&
        typeof (x as TimerSessionLogEntry).id === 'string' &&
        typeof (x as TimerSessionLogEntry).seconds === 'number',
    )
  } catch {
    return []
  }
}

function saveRaw(entries: TimerSessionLogEntry[]) {
  try {
    const trimmed =
      entries.length > TIMER_SESSION_LOG_MAX
        ? entries.slice(entries.length - TIMER_SESSION_LOG_MAX)
        : entries
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
  } catch {
    /* ignore */
  }
}

export function getTimerSessionLog(): TimerSessionLogEntry[] {
  return loadRaw()
}

export function appendTimerSessionLog(entry: TimerSessionLogEntry) {
  const next = [...loadRaw(), entry]
  saveRaw(next)
}

export function clearTimerSessionLog() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

/** Полная замена журнала (после слияния с Supabase). */
export function replaceTimerSessionLog(entries: readonly TimerSessionLogEntry[]) {
  try {
    const trimmed =
      entries.length > TIMER_SESSION_LOG_MAX
        ? entries.slice(0, TIMER_SESSION_LOG_MAX)
        : [...entries]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
  } catch {
    /* ignore */
  }
}
