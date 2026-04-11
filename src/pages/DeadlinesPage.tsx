import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useProjects } from '../hooks/useProjects'
import { parseRuDateToDayStart } from '../lib/parseRuDate'

type Row = {
  id: string
  day: number
  dateLabel: string
  title: string
  subtitle: string
  to: string
}

export function DeadlinesPage() {
  const { projects, tasks } = useProjects()

  const rows = useMemo(() => {
    const out: Row[] = []
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const t0 = today.getTime()

    for (const p of projects) {
      if (p.archived) continue
      const pd = parseRuDateToDayStart(p.deadline ?? '')
      if (pd != null) {
        out.push({
          id: `p-${p.slug}`,
          day: pd,
          dateLabel: p.deadline.trim(),
          title: p.title,
          subtitle: 'Дедлайн проекта',
          to: `/projects/${p.slug}`,
        })
      }
      for (const s of p.stages ?? []) {
        const sd = parseRuDateToDayStart(s.deadline ?? '')
        if (sd == null) continue
        out.push({
          id: `s-${p.slug}-${s.id}`,
          day: sd,
          dateLabel: (s.deadline ?? '').trim(),
          title: s.name,
          subtitle: `Этап · ${p.title}`,
          to: `/projects/${p.slug}`,
        })
      }
    }

    for (const task of tasks) {
      if (task.done) continue
      const td = parseRuDateToDayStart(task.dueDate ?? '')
      if (td == null) continue
      out.push({
        id: `t-${task.id}`,
        day: td,
        dateLabel: task.dueDate.trim(),
        title: task.title,
        subtitle: task.projectSlug ? `Задача · проект` : 'Задача',
        to: `/tasks#task-${task.id}`,
      })
    }

    out.sort((a, b) => a.day - b.day)
    return { list: out, t0 }
  }, [projects, tasks])

  return (
    <main className="relative z-10 mx-auto w-full max-w-[1840px] px-4 pb-16 pt-8 sm:px-10 sm:pt-10">
      <h1 className="text-[clamp(2rem,5vw,3.5rem)] font-light leading-[0.9] tracking-[-0.09em]">
        Сроки
      </h1>
      <p className="mt-2 max-w-xl text-sm font-light text-ink/60">
        Дедлайны проектов и этапов (формат ДД.ММ.ГГГГ) и открытые задачи со сроком.
      </p>

      <ul className="mt-10 flex max-w-3xl flex-col gap-2">
        {rows.list.length === 0 ? (
          <li className="text-sm font-light text-ink/50">
            Нет дат в известном формате
          </li>
        ) : (
          rows.list.map((r) => {
            const overdue = r.day < rows.t0
            return (
              <li key={r.id}>
                <Link
                  to={r.to}
                  className={`flex flex-col gap-0.5 border border-card-border px-4 py-3 transition-colors hover:bg-ink/[0.03] sm:flex-row sm:items-center sm:justify-between ${
                    overdue ? 'border-amber-700/30 bg-amber-500/5' : ''
                  }`}
                >
                  <div>
                    <span className="text-sm font-light">{r.title}</span>
                    <p className="text-xs font-light text-ink/50">{r.subtitle}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {overdue ? (
                      <span className="text-[10px] font-light uppercase text-amber-800 dark:text-amber-200">
                        просрочено
                      </span>
                    ) : null}
                    <span className="text-sm font-light tabular-nums text-ink/80">
                      {r.dateLabel}
                    </span>
                  </div>
                </Link>
              </li>
            )
          })
        )}
      </ul>
    </main>
  )
}
