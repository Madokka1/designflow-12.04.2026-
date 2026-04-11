import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
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

const BORDER = 'border-card-border'

const WEEKDAYS = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'] as const

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

export function CalendarPage() {
  const { projects, calendarCustomEvents, addCalendarCustomEvent } =
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
    return [...fromProjects, ...fromCustom].sort(
      (a, b) => a.date.getTime() - b.date.getTime(),
    )
  }, [projects, calendarCustomEvents])

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

  return (
    <main className="relative z-10 mx-auto w-full max-w-[1840px] px-4 pb-16 pt-8 sm:px-10 sm:pt-10">
      <h1 className="text-[clamp(2.5rem,5vw,4rem)] font-light leading-[0.9] tracking-[-0.09em]">
        Календарь
      </h1>

      <div className="mt-10 flex flex-col gap-6 xl:flex-row xl:items-start xl:gap-10">
        <section
          className={`min-w-0 flex-1 border ${BORDER} p-5 sm:p-5`}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-4">
                <p className="text-base font-light leading-[0.9] tracking-[-0.09em]">
                  {MONTH_NAMES[cursor.m]}
                </p>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={prevMonth}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-lg font-light text-ink transition-colors hover:bg-ink/5"
                    aria-label="Предыдущий месяц"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    onClick={nextMonth}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-lg font-light text-ink transition-colors hover:bg-ink/5"
                    aria-label="Следующий месяц"
                  >
                    ›
                  </button>
                </div>
              </div>
              <p className="text-[clamp(1.5rem,3vw,2rem)] font-light leading-[0.9] tracking-[-0.09em]">
                Проектов: {projectsInMonth}
              </p>
            </div>
          </div>

          <div className={`mt-10 border ${BORDER} p-4 sm:p-5`}>
            <div className="grid grid-cols-7 border-l border-t border-[rgba(10,10,10,0.32)]">
              {WEEKDAYS.map((wd) => (
                <div
                  key={wd}
                  className="border-b border-r border-[rgba(10,10,10,0.32)] px-2 py-2 text-center text-base font-light leading-[0.9] tracking-[-0.09em]"
                >
                  {wd}
                </div>
              ))}
              {cells.map(({ date, inMonth }, i) => {
                const sel =
                  selected != null && isSameDay(date, selected)
                const dayEvents = eventsByDay.get(dayKey(date)) ?? []
                const isToday = isSameDay(date, now)

                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() =>
                      setSelected(
                        new Date(
                          date.getFullYear(),
                          date.getMonth(),
                          date.getDate(),
                        ),
                      )
                    }
                    className={`flex min-h-[88px] flex-col items-stretch gap-2 border-b border-r border-[rgba(10,10,10,0.32)] p-2.5 text-left transition-colors sm:min-h-[112px] ${
                      !inMonth ? 'opacity-40' : ''
                    } ${
                      sel
                        ? 'bg-fill-contrast-bg text-fill-contrast-fg'
                        : isToday && inMonth
                          ? 'bg-ink/[0.06]'
                          : 'bg-surface hover:bg-ink/[0.02]'
                    }`}
                  >
                    <span
                      className={`text-base font-light leading-[0.9] tracking-[-0.09em] ${
                        sel ? 'text-fill-contrast-fg' : 'text-ink'
                      }`}
                    >
                      {date.getDate()}
                    </span>
                    <div className="flex flex-wrap gap-x-2 gap-y-1">
                      {dayEvents.slice(0, 3).map((ev) => (
                        <span
                          key={ev.id}
                          className={`text-[10px] font-light uppercase leading-none tracking-[-0.02em] ${
                            sel ? 'text-fill-contrast-fg/90' : 'text-ink'
                          }`}
                        >
                          {ev.label}
                        </span>
                      ))}
                      {dayEvents.length > 3 ? (
                        <span
                          className={`text-[10px] font-light uppercase tracking-[-0.02em] ${
                            sel ? 'text-fill-contrast-fg/70' : 'text-ink/60'
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
          className={`w-full shrink-0 border ${BORDER} p-5 sm:p-5 xl:max-w-[445px]`}
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 flex-col gap-3">
              <p className="text-base font-light leading-[0.9] tracking-[-0.09em]">
                События
              </p>
              <p className="text-[clamp(1.5rem,3vw,2rem)] font-light leading-[0.9] tracking-[-0.09em]">
                {eventsWord(selectedDayEvents.length)}
              </p>
              {selected ? (
                <p className="text-sm font-light tracking-[-0.02em] text-ink/55">
                  Выбрано:{' '}
                  {selected.toLocaleDateString('ru-RU', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
              ) : null}
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

          <ul className="mt-8 flex flex-col divide-y divide-[rgba(10,10,10,0.2)]">
            {selectedDayEvents.length === 0 ? (
              <li className="py-4 text-base font-light tracking-[-0.02em] text-ink/45">
                Нет событий
              </li>
            ) : (
              selectedDayEvents.map((ev) => {
                const inner = (
                  <>
                    <p className="text-base font-light leading-[0.9] tracking-[-0.09em]">
                      {ev.label}
                    </p>
                    {ev.sublabel ? (
                      <p className="mt-1 text-sm font-light tracking-[-0.02em] text-ink/55">
                        {ev.sublabel}
                      </p>
                    ) : null}
                    <p className="mt-2 text-[10px] font-light uppercase leading-none tracking-[-0.02em] text-ink/50">
                      {ev.date.toLocaleDateString('ru-RU')}
                    </p>
                  </>
                )
                return (
                  <li key={ev.id} className="py-4">
                    {ev.slug ? (
                      <Link
                        to={`/projects/${ev.slug}`}
                        className="block outline-none ring-ink transition-opacity hover:opacity-80 focus-visible:ring-2"
                      >
                        {inner}
                      </Link>
                    ) : (
                      inner
                    )}
                  </li>
                )
              })
            )}
          </ul>

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
