import { useEffect } from 'react'
import { useProjects } from '../hooks/useProjects'
import { useSettings } from '../hooks/useSettings'
import { parseRuDate } from '../lib/parseRuDate'

const DAY_MS = 86_400_000
const STORAGE_PREFIX = 'deadline-notify:'

function startOfTodayMs(): number {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function dayKeyFromTime(t: number): string {
  const d = new Date(t)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

export function DeadlineNotificationScheduler() {
  const { projects, tasks } = useProjects()
  const { settings } = useSettings()
  const enabled = settings.deadlineNotifyEnabled
  const daysBefore = Math.max(0, Math.min(14, settings.deadlineNotifyDaysBefore))

  useEffect(() => {
    if (!enabled || typeof Notification === 'undefined') return
    void Notification.requestPermission()
  }, [enabled])

  useEffect(() => {
    if (!enabled || typeof Notification === 'undefined') return

    const run = () => {
      if (Notification.permission !== 'granted') return
      const today = startOfTodayMs()
      const horizon = today + daysBefore * DAY_MS

      const candidates: { id: string; title: string; when: string }[] = []

      for (const p of projects) {
        if (p.archived) continue
        const pd = parseRuDate(p.deadline ?? '')
        if (!pd) continue
        pd.setHours(0, 0, 0, 0)
        const ts = pd.getTime()
        if (ts >= today && ts <= horizon) {
          candidates.push({
            id: `proj-${p.slug}`,
            title: p.title,
            when: p.deadline,
          })
        }
        for (const s of p.stages ?? []) {
          const sd = parseRuDate(s.deadline ?? '')
          if (!sd) continue
          sd.setHours(0, 0, 0, 0)
          const st = sd.getTime()
          if (st >= today && st <= horizon) {
            candidates.push({
              id: `stage-${p.slug}-${s.id}`,
              title: `${s.name} · ${p.title}`,
              when: s.deadline,
            })
          }
        }
      }

      for (const t of tasks) {
        if (t.done) continue
        const td = parseRuDate(t.dueDate ?? '')
        if (!td) continue
        td.setHours(0, 0, 0, 0)
        const tt = td.getTime()
        if (tt >= today && tt <= horizon) {
          candidates.push({
            id: `task-${t.id}`,
            title: t.title,
            when: t.dueDate,
          })
        }
      }

      const todayKey = dayKeyFromTime(today)
      for (const c of candidates) {
        const key = `${STORAGE_PREFIX}${c.id}:${todayKey}`
        try {
          if (localStorage.getItem(key)) continue
          localStorage.setItem(key, '1')
        } catch {
          continue
        }
        try {
          new Notification('Срок: ' + c.when, {
            body: c.title,
            tag: c.id,
          })
        } catch {
          /* ignore */
        }
      }
    }

    run()
    const id = window.setInterval(run, 3_600_000)
    return () => window.clearInterval(id)
  }, [enabled, daysBefore, projects, tasks])

  return null
}
