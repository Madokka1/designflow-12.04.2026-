import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { CreateCalendarEventModal } from '../components/CreateCalendarEventModal'
import { useProjects } from '../hooks/useProjects'
import {
  formatDateRu,
  isSameDay,
  isSameMonth,
  parseRuDate,
} from '../lib/parseRuDate'
import type { CalendarCustomEvent } from '../types/calendarCustomEvent'
import type { Project } from '../types/project'
import type { WorkspaceTask } from '../types/workspaceTask'

const BORDER = 'border-card-border'

const WEEKDAYS = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'] as const
const WEEKDAYS_LONG = [
  'пн',
  'вт',
  'ср',
  'чт',
  'пт',
  'сб',
  'вс',
] as const

function isoDayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const MONTH_NAMES = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
] as const

type CalendarEventItem = {
  id: string
  date: Date
  label: string
  sublabel?: string
  slug?: string
  /** Якорь /tasks#task-… */
  taskId?: string
}

function eventTone(e: CalendarEventItem): 'neutral' | 'warning' | 'info' {
  if (e.taskId) return 'info'
  if (!e.slug) return 'neutral'
  if (e.label.toLowerCase() === 'дедлайн') return 'warning'
  return 'info'
}

function pillClass(tone: 'neutral' | 'warning' | 'info') {
  const base =
    'inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-light uppercase leading-none tracking-[-0.02em]'
  switch (tone) {
    case 'warning':
      return `${base} border-amber-700/20 bg-amber-500/10 text-amber-950 dark:border-amber-300/20 dark:bg-amber-400/10 dark:text-amber-200`
    case 'info':
      return `${base} border-blue-700/20 bg-blue-500/10 text-blue-950 dark:border-blue-300/20 dark:bg-blue-400/10 dark:text-blue-200`
    default:
      return `${base} border-ink/15 bg-ink/[0.03] text-ink/75 dark:border-white/15 dark:bg-white/[0.04] dark:text-ink/70`
  }
}

function dotClass(tone: ReturnType<typeof eventTone>) {
  switch (tone) {
    case 'warning':
      return 'bg-amber-500'
    case 'info':
      return 'bg-blue-500'
    default:
      return 'bg-ink/35 dark:bg-white/35'
  }
}

function eventsWord(n: number): string {
  const m = n % 100
  if (m >= 11 && m <= 14) return `${n} событий`
  const r = n % 10
  if (r === 1) return `${n} событие`
  if (r >= 2 && r <= 4) return `${n} события`
  return `${n} событий`
}

/** Понедельник = 0 … воскресенье = 6 */
function mondayIndex(d: Date): number {
  return (d.getDay() + 6) % 7
}

function buildMonthCells(year: number, month: number): {
  date: Date
  inMonth: boolean
}[] {
  const first = new Date(year, month, 1)
  const startPad = mondayIndex(first)
  const start = new Date(year, month, 1 - startPad)
  const cells: { date: Date; inMonth: boolean }[] = []
  const cur = new Date(start)
  for (let i = 0; i < 42; i++) {
    cells.push({
      date: new Date(cur),
      inMonth: cur.getMonth() === month,
    })
    cur.setDate(cur.getDate() + 1)
  }
  return cells
}

function collectEventsFromProjects(projects: readonly Project[]): CalendarEventItem[] {
  const out: CalendarEventItem[] = []
  for (const p of projects) {
    if (p.archived) continue
    const pd = parseRuDate(p.deadline)
    if (pd) {
      out.push({
        id: `p-${p.id}-dl`,
        date: pd,
        label: 'Дедлайн',
        sublabel: p.title,
        slug: p.slug,
      })
    }
    for (const st of p.stages ?? []) {
      const sd = parseRuDate(st.deadline)
      if (sd) {
        out.push({
          id: `p-${p.id}-s-${st.id}`,
          date: sd,
          label: st.name,
          sublabel: p.title,
          slug: p.slug,
        })
      }
    }
  }
  out.sort((a, b) => a.date.getTime() - b.date.getTime())
  return out
}

function collectCustomCalendarItems(
  custom: readonly CalendarCustomEvent[],
): CalendarEventItem[] {
  const out: CalendarEventItem[] = []
  for (const c of custom) {
    if (c.taskId) continue
    const d = parseRuDate(c.dateRaw)
    if (!d) continue
    out.push({
      id: c.id,
      date: d,
      label: c.title,
      sublabel: c.comment,
    })
  }
  return out
}

function collectTasksCalendarItems(
  tasks: readonly WorkspaceTask[],
  projects: readonly Project[],
): CalendarEventItem[] {
  const titleBySlug = new Map(
    projects.map((p) => [p.slug, p.title] as const),
  )
  const out: CalendarEventItem[] = []
  for (const t of tasks) {
    const d = parseRuDate(t.dueDate)
    if (!d) continue
    const slug = t.projectSlug ?? undefined
    const sub =
      (slug && titleBySlug.get(slug)) ||
      (t.comment.trim() ? t.comment.trim() : undefined)
    out.push({
      id: `task-cal-${t.id}`,
      date: d,
      label: t.title,
      sublabel: sub,
      slug,
      taskId: t.id,
    })
  }
  out.sort((a, b) => a.date.getTime() - b.date.getTime())
  return out
}

export function CalendarPage() {
  const location = useLocation()
  const { projects, tasks, calendarCustomEvents, addCalendarCustomEvent } =
    useProjects()
  const now = new Date()
  const [cursor, setCursor] = useState(() => ({
    y: now.getFullYear(),
    m: now.getMonth(),
  }))
  const [selected, setSelected] = useState<Date | null>(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  })

  const [createEventOpen, setCreateEventOpen] = useState(false)
  const [createEventKey, setCreateEventKey] = useState(0)

  const allEvents = useMemo(() => {
    const fromProjects = collectEventsFromProjects(projects)
    const fromCustom = collectCustomCalendarItems(calendarCustomEvents)
    const fromTasks = collectTasksCalendarItems(tasks, projects)
    return [...fromProjects, ...fromCustom, ...fromTasks].sort(
      (a, b) => a.date.getTime() - b.date.getTime(),
    )
  }, [projects, tasks, calendarCustomEvents])

  const monthEvents = useMemo(
    () =>
      allEvents.filter((e) => isSameMonth(e.date, cursor.y, cursor.m)),
    [allEvents, cursor.y, cursor.m],
  )

  const projectsInMonth = useMemo(() => {
    const slugs = new Set<string>()
    for (const e of monthEvents) {
      if (e.slug) slugs.add(e.slug)
    }
    return slugs.size
  }, [monthEvents])

  const cells = useMemo(
    () => buildMonthCells(cursor.y, cursor.m),
    [cursor.y, cursor.m],
  )

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEventItem[]>()
    for (const e of allEvents) {
      const key = `${e.date.getFullYear()}-${e.date.getMonth()}-${e.date.getDate()}`
      const list = map.get(key) ?? []
      list.push(e)
      map.set(key, list)
    }
    return map
  }, [allEvents])

  function dayKey(d: Date) {
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
  }

  const prevMonth = () => {
    setCursor((c) => {
      const d = new Date(c.y, c.m - 1, 1)
      return { y: d.getFullYear(), m: d.getMonth() }
    })
  }

  const nextMonth = () => {
    setCursor((c) => {
      const d = new Date(c.y, c.m + 1, 1)
      return { y: d.getFullYear(), m: d.getMonth() }
    })
  }

  const selectedDayEvents = useMemo(() => {
    if (!selected) return []
    return allEvents
      .filter((e) => isSameDay(e.date, selected))
      .sort((a, b) => a.date.getTime() - b.date.getTime())
  }, [allEvents, selected])

  const selectedEventCards = useMemo(() => {
    return selectedDayEvents.map((e) => ({
      ...e,
      weekday: WEEKDAYS_LONG[mondayIndex(e.date)] ?? '',
    }))
  }, [selectedDayEvents])

  useEffect(() => {
    const raw = location.hash.replace(/^#/, '')
    const m = raw.match(/^cal-day-(\d{4})-(\d{2})-(\d{2})$/)
    if (!m) return
    const y = Number(m[1])
    const mo = Number(m[2]) - 1
    const day = Number(m[3])
    if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(day)) return
    const d = new Date(y, mo, day)
    d.setHours(0, 0, 0, 0)
    queueMicrotask(() => {
      setCursor({ y, m: mo })
      setSelected(d)
    })
    window.setTimeout(() => {
      document.getElementById(raw)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
    }, 150)
  }, [location.hash])

  return (
    <main className="relative z-10 mx-auto flex w-full max-w-[1840px] flex-col px-4 pb-16 pt-8 sm:px-10 sm:pt-10 xl:h-[calc(100dvh-4.5rem)] xl:overflow-hidden xl:pb-0">
      <h1 className="text-[clamp(2.5rem,5vw,4rem)] font-light leading-[0.9] tracking-[-0.09em]">
        Календарь
      </h1>

      <div className="mt-10 mb-10 flex flex-col gap-6 xl:min-h-0 xl:flex-1 xl:flex-row xl:items-start xl:gap-10">
        <section
          className={`min-w-0 flex-1 border ${BORDER} p-5 sm:p-5 xl:flex xl:h-full xl:flex-[1.35] xl:flex-col xl:min-h-0`}
        >
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-base font-light leading-[0.9] tracking-[-0.09em]">
                {MONTH_NAMES[cursor.m]} {cursor.y}
              </p>
              <p className="mt-2 text-sm font-light tracking-[-0.02em] text-ink/55">
                Проектов в месяце: {projectsInMonth} · Событий: {eventsWord(monthEvents.length)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={prevMonth}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-card-border text-lg font-light text-ink transition-colors hover:bg-ink/5"
                aria-label="Предыдущий месяц"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={nextMonth}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-card-border text-lg font-light text-ink transition-colors hover:bg-ink/5"
                aria-label="Следующий месяц"
              >
                ›
              </button>
            </div>
          </div>

          <div className="mt-8 flex-1 xl:min-h-0">
            <div className="grid h-full grid-cols-7 grid-rows-[auto_repeat(6,minmax(0,1fr))] gap-2">
              {WEEKDAYS.map((wd) => (
                <div
                  key={wd}
                  className="pb-1 text-center text-[10px] font-light uppercase tracking-[-0.02em] text-ink/55"
                >
                  {wd}
                </div>
              ))}
              {cells.map(({ date, inMonth }, i) => {
                const sel = selected != null && isSameDay(date, selected)
                const isToday = isSameDay(date, now)
                const dayEvents = eventsByDay.get(dayKey(date)) ?? []
                const dots = dayEvents.slice(0, 3)

                return (
                  <button
                    key={i}
                    type="button"
                    id={`cal-day-${isoDayKey(date)}`}
                    onClick={() =>
                      setSelected(
                        new Date(
                          date.getFullYear(),
                          date.getMonth(),
                          date.getDate(),
                        ),
                      )
                    }
                    className={`relative flex h-[68px] w-full min-h-0 flex-col justify-between rounded-[3px] px-2.5 py-2 text-left transition-colors sm:h-[72px] xl:h-full ${
                      !inMonth ? 'opacity-35' : ''
                    } ${
                      sel
                        ? 'bg-black text-white'
                        : isToday && inMonth
                          ? 'bg-ink/[0.06] text-ink'
                          : 'bg-ink/[0.02] text-ink hover:bg-ink/[0.04]'
                    }`}
                  >
                    <span
                      className={`text-sm font-light leading-none tracking-[-0.04em] ${
                        sel ? 'text-white' : 'text-ink'
                      }`}
                    >
                      {date.getDate()}
                    </span>
                    <div className="flex items-center gap-1">
                      {dots.map((ev) => (
                        <span
                          key={ev.id}
                          className={`h-1.5 w-1.5 rounded-full ${sel ? 'bg-white/80' : dotClass(eventTone(ev))}`}
                          aria-hidden
                        />
                      ))}
                      {dayEvents.length > 3 ? (
                        <span
                          className={`text-[10px] font-light tracking-[-0.02em] ${
                            sel ? 'text-white/70' : 'text-ink/45'
                          }`}
                        >
                          +{dayEvents.length - 3}
                        </span>
                      ) : null}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </section>

        <aside
          className={`min-w-0 flex-1 border ${BORDER} p-5 sm:p-5 xl:flex-[1] xl:max-h-full xl:overflow-y-auto`}
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-base font-light leading-[0.9] tracking-[-0.09em]">
                События дня
              </p>
              <p className="mt-2 text-sm font-light tracking-[-0.02em] text-ink/55">
                {selected
                  ? selected.toLocaleDateString('ru-RU', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })
                  : `${MONTH_NAMES[cursor.m]} ${cursor.y}`}{' '}
                · {eventsWord(selectedDayEvents.length)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setCreateEventKey((k) => k + 1)
                setCreateEventOpen(true)
              }}
              className="h-8 shrink-0 rounded-full bg-fill-contrast-bg px-5 text-sm font-light tracking-[-0.05em] text-fill-contrast-fg transition-opacity hover:opacity-90"
            >
              Создать событие
            </button>
          </div>

          <div className="mt-8 flex flex-col gap-3">
            {selectedEventCards.length === 0 ? (
              <p className="py-4 text-base font-light tracking-[-0.02em] text-ink/45">
                Нет событий в этот день
              </p>
            ) : (
              selectedEventCards.map((ev) => {
                const tone = eventTone(ev)
                const card = (
                  <div
                    className={`flex items-stretch gap-4 rounded-[3px] border ${BORDER} bg-surface p-4 transition-colors hover:bg-ink/[0.02]`}
                  >
                    <div className="flex w-[62px] shrink-0 flex-col items-center justify-center rounded-[3px] border border-card-border bg-ink/[0.02] px-2 py-2 text-center">
                      <div className="text-[20px] font-light leading-none tracking-[-0.06em] text-ink">
                        {String(ev.date.getDate()).padStart(2, '0')}
                      </div>
                      <div className="mt-1 text-[10px] font-light uppercase leading-none tracking-[-0.02em] text-ink/55">
                        {ev.weekday}
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="min-w-0 flex-1 truncate text-base font-light leading-[1.1] tracking-[-0.04em] text-ink">
                          {ev.label}
                        </p>
                        <span className={pillClass(tone)}>
                          {ev.taskId
                            ? 'задача'
                            : tone === 'warning'
                              ? 'дедлайн'
                              : tone === 'info'
                                ? 'проект'
                                : 'событие'}
                        </span>
                      </div>
                      {ev.sublabel ? (
                        <p className="mt-1 line-clamp-2 text-sm font-light tracking-[-0.02em] text-ink/55">
                          {ev.sublabel}
                        </p>
                      ) : null}
                      <p className="mt-2 text-[10px] font-light uppercase leading-none tracking-[-0.02em] text-ink/50">
                        {ev.date.toLocaleDateString('ru-RU')}
                      </p>
                    </div>
                  </div>
                )

                return ev.taskId ? (
                  <Link
                    key={ev.id}
                    to={`/tasks#task-${ev.taskId}`}
                    className="block outline-none ring-ink transition-opacity hover:opacity-95 focus-visible:ring-2"
                  >
                    {card}
                  </Link>
                ) : ev.slug ? (
                  <Link
                    key={ev.id}
                    to={`/projects/${ev.slug}`}
                    className="block outline-none ring-ink transition-opacity hover:opacity-95 focus-visible:ring-2"
                  >
                    {card}
                  </Link>
                ) : (
                  <div key={ev.id}>{card}</div>
                )
              })
            )}
          </div>

          <Link
            to="/projects"
            className="mt-8 inline-flex text-sm font-light tracking-[-0.02em] text-ink underline-offset-4 hover:underline"
          >
            ← К проектам
          </Link>
        </aside>
      </div>

      {createEventOpen ? (
        <CreateCalendarEventModal
          key={createEventKey}
          defaultDateRaw={selected ? formatDateRu(selected) : ''}
          onClose={() => setCreateEventOpen(false)}
          onSubmit={(data) => addCalendarCustomEvent(data)}
        />
      ) : null}
    </main>
  )
}
