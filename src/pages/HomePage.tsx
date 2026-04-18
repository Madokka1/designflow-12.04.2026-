import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { formatDurationRu } from '../lib/formatDurationRu'
import { portfolioTurnoverRub } from '../lib/portfolioTurnoverRub'
import { parseRuDate } from '../lib/parseRuDate'
import { useNotesContext } from '../hooks/useNotesContext'
import {
  getProjectSection,
  partitionProjectCardTags,
} from '../lib/projectSection'
import { projectCardTagChipClass } from '../lib/tagChipClasses'
import { useProjects } from '../hooks/useProjects'
import type { CalendarCustomEvent } from '../types/calendarCustomEvent'
import type { Project } from '../types/project'
import type { WorkspaceTask } from '../types/workspaceTask'

const CARD_FALLBACK_TAGS = ['В работе', 'Разработка'] as const

const BORDER = 'border-card-border'
const DAY_MS = 86_400_000

const NAV = [
  ['Проекты', '/projects'],
  ['Заметки', '/notes'],
  ['Календарь', '/calendar'],
  ['Финансы', '/finance'],
] as const

const MONTH_SHORT = [
  'янв.',
  'фев.',
  'мар.',
  'апр.',
  'мая',
  'июн.',
  'июл.',
  'авг.',
  'сен.',
  'окт.',
  'нояб.',
  'дек.',
] as const

function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function dayKeyLocal(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Понедельник недели, в которой лежит дата */
function mondayOfWeek(d: Date): Date {
  const x = startOfDay(new Date(d))
  const dow = (x.getDay() + 6) % 7
  x.setDate(x.getDate() - dow)
  return x
}

function formatRevenueRub(n: number): string {
  const formatted = new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: 0,
    signDisplay: n === 0 ? 'never' : 'exceptZero',
  }).format(n)
  return `${formatted.replace(/\s/g, '.')} ₽`
}

type AgendaItem = {
  id: string
  date: Date
  label: string
  sublabel?: string
  slug?: string
}

function collectAgendaItems(
  projects: readonly Project[],
  custom: readonly CalendarCustomEvent[],
  tasks: readonly WorkspaceTask[],
): AgendaItem[] {
  const out: AgendaItem[] = []
  const projectTitleBySlug = new Map(
    projects.map((p) => [p.slug, p.title] as const),
  )
  for (const p of projects) {
    const pd = parseRuDate(p.deadline)
    if (pd) {
      out.push({
        id: `p-${p.id}-dl`,
        date: startOfDay(pd),
        label: 'Дедлайн проекта',
        sublabel: p.title,
        slug: p.slug,
      })
    }
    for (const st of p.stages ?? []) {
      const sd = parseRuDate(st.deadline)
      if (sd) {
        out.push({
          id: `p-${p.id}-s-${st.id}`,
          date: startOfDay(sd),
          label: st.name,
          sublabel: p.title,
          slug: p.slug,
        })
      }
    }
  }
  for (const c of custom) {
    if (c.taskId) continue
    const d = parseRuDate(c.dateRaw)
    if (!d) continue
    out.push({
      id: c.id,
      date: startOfDay(d),
      label: c.title,
      sublabel: c.comment,
    })
  }
  for (const t of tasks) {
    const d = parseRuDate(t.dueDate)
    if (!d) continue
    const slug = t.projectSlug ?? undefined
    const sub =
      (slug && projectTitleBySlug.get(slug)) ||
      (t.comment.trim() ? t.comment.trim() : undefined)
    out.push({
      id: `task-${t.id}`,
      date: startOfDay(d),
      label: t.title,
      sublabel: sub,
      slug,
    })
  }
  out.sort((a, b) => a.date.getTime() - b.date.getTime())
  return out
}

function buildActivityMap(
  notes: { createdAt: string }[],
  projects: readonly Project[],
  custom: readonly CalendarCustomEvent[],
): Map<string, number> {
  const m = new Map<string, number>()
  const add = (d: Date, w: number) => {
    const k = dayKeyLocal(startOfDay(d))
    m.set(k, (m.get(k) ?? 0) + w)
  }

  for (const n of notes) {
    try {
      add(new Date(n.createdAt), 2)
    } catch {
      /* skip */
    }
  }
  for (const c of custom) {
    const d = parseRuDate(c.dateRaw)
    if (d) add(d, 2)
  }
  for (const p of projects) {
    const pd = parseRuDate(p.deadline)
    if (pd) add(pd, 1)
    for (const st of p.stages ?? []) {
      const sd = parseRuDate(st.deadline)
      if (sd) add(sd, 1)
      if (st.addedAt) {
        try {
          add(new Date(st.addedAt), 2)
        } catch {
          /* skip */
        }
      }
    }
  }
  return m
}

function ProjectPreviewCard({ project }: { project: Project }) {
  const tags = project.tags ?? CARD_FALLBACK_TAGS
  const { section, chipTags } = partitionProjectCardTags(tags)

  return (
    <Link
      to={`/projects/${project.slug}`}
      className="block h-full min-h-[140px] min-w-0 text-left outline-none ring-ink transition-shadow focus-visible:ring-2"
    >
      <article className="flex h-full min-h-[140px] flex-col justify-between rounded-[3px] border border-[rgba(10,10,10,0.32)] p-4 transition-[background-color,border-color] hover:border-[rgba(10,10,10)] hover:bg-ink/[0.02]">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="text-[24px] font-light leading-[0.95] tracking-[-0.06em]">
              {project.title}
            </h3>
            <p className="mt-1.5 line-clamp-2 text-[14px] font-light tracking-[-0.02em] text-ink/75">
              {project.client}
            </p>
          </div>
          {section ? (
            <span className="max-w-[40%] shrink-0 pt-0.5 text-right text-[10px] font-light uppercase leading-none tracking-[-0.02em] text-ink/65">
              {section}
            </span>
          ) : null}
        </div>
        <div className="mt-4 flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              {chipTags.map((label, i) => (
                <span
                  key={`${label}-${i}`}
                  className={projectCardTagChipClass(label)}
                >
                  {label}
                </span>
              ))}
            </div>
            <span className="shrink-0 text-sm font-light tracking-[-0.04em]">
              {project.amount}
            </span>
          </div>
          <div className="h-0.5 w-full overflow-hidden rounded-full bg-[rgba(10,10,10,0.1)]">
            <div
              className="h-full rounded-full bg-ink transition-[width]"
              style={{ width: `${project.progress}%` }}
            />
          </div>
          <div className="text-[10px] font-light uppercase tracking-[-0.02em] text-ink/50">
            {project.progress}% · дедлайн: {project.deadline}
          </div>
        </div>
      </article>
    </Link>
  )
}

function levelOpacity(count: number, max: number): string {
  if (count <= 0) return 'bg-ink/[0.07]'
  if (max <= 1) return 'bg-ink/80'
  const t = count / max
  if (t <= 0.25) return 'bg-ink/25'
  if (t <= 0.5) return 'bg-ink/45'
  if (t <= 0.75) return 'bg-ink/65'
  return 'bg-ink/90'
}

function ActivityHeatmap({
  activityByDay,
}: {
  activityByDay: Map<string, number>
}) {
  const { weeks, monthLabels, maxCount } = useMemo(() => {
    const end = startOfDay(new Date())
    const approxStart = new Date(end)
    approxStart.setDate(approxStart.getDate() - 364)
    const graphStart = mondayOfWeek(approxStart)

    const days: (Date | null)[] = []
    for (let t = graphStart.getTime(); t <= end.getTime(); t += DAY_MS) {
      days.push(startOfDay(new Date(t)))
    }
    const pad = (7 - (days.length % 7)) % 7
    for (let i = 0; i < pad; i++) days.push(null)

    const wks: (Date | null)[][] = []
    for (let i = 0; i < days.length; i += 7) {
      wks.push(days.slice(i, i + 7))
    }

    let max = 0
    for (const v of activityByDay.values()) {
      if (v > max) max = v
    }

    const labels: (string | null)[] = wks.map((week, wi) => {
      const first = week[0]
      if (!first) return null
      if (wi === 0) return MONTH_SHORT[first.getMonth()] ?? null
      const prev = wks[wi - 1]?.[0]
      if (!prev || prev.getMonth() !== first.getMonth()) {
        return MONTH_SHORT[first.getMonth()] ?? null
      }
      return null
    })

    return { weeks: wks, monthLabels: labels, maxCount: max }
  }, [activityByDay])

  const rowLabels = ['пн', '', 'ср', '', 'пт', '', 'вс']
  const weekGridCols = `repeat(${weeks.length}, minmax(0, 1fr))`

  return (
    <div className="w-full min-w-0 overflow-x-auto pb-1">
      <div className="w-full min-w-0">
        <div className="mb-2 flex w-full min-w-0 gap-1">
          <div className="w-7 shrink-0" aria-hidden />
          <div
            className="grid min-w-0 flex-1 gap-x-[3px]"
            style={{ gridTemplateColumns: weekGridCols }}
          >
            {monthLabels.map((lab, i) => (
              <div
                key={`m-${i}`}
                className="flex min-w-0 justify-center text-[9px] font-light leading-none text-ink/40"
              >
                <span className="truncate">{lab ?? ''}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex w-full min-w-0 gap-1">
          <div className="flex w-7 shrink-0 flex-col gap-[3px] self-stretch text-[9px] font-light text-ink/35">
            {rowLabels.map((lb, i) => (
              <span
                key={i}
                className="flex min-h-0 flex-1 items-center justify-end leading-none"
              >
                {lb}
              </span>
            ))}
          </div>
          <div
            className="grid min-w-0 flex-1 gap-x-[3px]"
            style={{ gridTemplateColumns: weekGridCols }}
          >
            {weeks.map((week, wi) => (
              <div key={wi} className="flex min-w-0 flex-col gap-[3px]">
                {week.map((day, di) => {
                  if (!day) {
                    return (
                      <span
                        key={`e-${wi}-${di}`}
                        className="aspect-square w-full min-h-0 rounded-sm"
                        aria-hidden
                      />
                    )
                  }
                  const key = dayKeyLocal(day)
                  const c = activityByDay.get(key) ?? 0
                  const title = `${day.toLocaleDateString('ru-RU')}: ${c === 0 ? 'нет активности' : `${c} ${c === 1 ? 'событие' : c < 5 ? 'события' : 'событий'}`}`
                  return (
                    <span
                      key={key}
                      title={title}
                      className={`aspect-square w-full min-h-0 shrink-0 rounded-sm ${levelOpacity(c, maxCount)}`}
                    />
                  )
                })}
              </div>
            ))}
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] font-light text-ink/45">
          <span>Меньше</span>
          <div className="flex gap-[3px]">
            {[0, 0.15, 0.35, 0.55, 0.85, 1].map((t, i) => (
              <span
                key={i}
                className={`h-[11px] w-[11px] rounded-sm ${
                  t === 0
                    ? 'bg-ink/[0.07]'
                    : t <= 0.25
                      ? 'bg-ink/25'
                      : t <= 0.5
                        ? 'bg-ink/45'
                        : t <= 0.75
                          ? 'bg-ink/65'
                          : 'bg-ink/90'
                }`}
              />
            ))}
          </div>
          <span>Больше</span>
        </div>
      </div>
    </div>
  )
}

export function HomePage() {
  const {
    projects,
    financeTransactions,
    calendarCustomEvents,
    tasks,
    timerSessionLog,
  } = useProjects()
  const { notes } = useNotesContext()

  const totalRevenue = useMemo(
    () => portfolioTurnoverRub(projects, financeTransactions),
    [projects, financeTransactions],
  )

  const agenda = useMemo(
    () => collectAgendaItems(projects, calendarCustomEvents, tasks),
    [projects, calendarCustomEvents, tasks],
  )

  const nearest = useMemo(() => {
    const today = startOfDay(new Date())
    return agenda.find((e) => e.date.getTime() >= today.getTime())
  }, [agenda])

  const timerSecondsToday = useMemo(() => {
    const key = dayKeyLocal(new Date())
    let sum = 0
    for (const e of timerSessionLog) {
      try {
        if (dayKeyLocal(new Date(e.endedAt)) === key) sum += e.seconds
      } catch {
        /* skip */
      }
    }
    return sum
  }, [timerSessionLog])

  const activityByDay = useMemo(
    () => buildActivityMap(notes, projects, calendarCustomEvents),
    [notes, projects, calendarCustomEvents],
  )

  const previewProjects = useMemo(
    () =>
      projects
        .filter((p) => !p.archived && getProjectSection(p) === 'Разработка')
        .slice(0, 2),
    [projects],
  )

  const projectCount = projects.length

  return (
    <main className="relative z-10 flex h-[calc(100dvh-5.5rem)] min-h-0 w-full max-w-none flex-col overflow-hidden px-4 pb-4 pt-5 sm:px-10 sm:pt-6">
      <header className="shrink-0">
      <h1 className="max-w-[357px] text-[clamp(2.5rem,6vw,4rem)] font-light leading-[0.9] tracking-[-0.09em]">
          Обзор
        </h1>
        <nav className="mt-10 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-light tracking-[-0.02em]">
          {NAV.map(([label, to], i) => (
            <span key={to} className="flex items-center gap-x-4">
              {i > 0 ? (
                <span className="text-ink/25" aria-hidden>
                  ·
                </span>
              ) : null}
              <Link to={to} className="text-ink/70 hover:text-ink">
                {label}
              </Link>
            </span>
          ))}
        </nav>
      </header>

      <div className="mt-3 min-h-0 flex-1 overflow-y-auto lg:overflow-hidden">
        <div className="grid min-h-0 grid-cols-1 gap-2 pb-2 lg:h-full lg:min-h-0 lg:grid-cols-[minmax(240px,18rem)_1fr] lg:gap-6 lg:pb-0">
          <aside className="flex min-h-0 flex-col gap-4 lg:h-full lg:min-h-0">
            <div
              className={`flex min-h-[100px] flex-1 flex-col justify-center rounded-[3px] border ${BORDER} p-5 lg:min-h-0`}
            >
              <p className="text-[10px] font-light uppercase leading-none tracking-[-0.02em] text-ink/50">
                Общая выручка
              </p>
              <p className="mt-3 text-2xl font-light leading-none tracking-[-0.05em] sm:text-3xl">
                {formatRevenueRub(totalRevenue)}
              </p>
              <Link
                to="/finance"
                className="mt-auto pt-3 text-[11px] font-light text-ink/55 underline-offset-4 hover:text-ink hover:underline"
              >
                Финансы →
              </Link>
            </div>

            <div
              className={`flex min-h-[100px] flex-1 flex-col justify-center rounded-[3px] border ${BORDER} p-5 lg:min-h-0`}
            >
              <p className="text-[10px] font-light uppercase leading-none tracking-[-0.02em] text-ink/50">
                Проектов
              </p>
              <p className="mt-3 text-4xl font-light leading-none tracking-[-0.06em] sm:text-5xl">
                {projectCount}
              </p>
              <Link
                to="/projects"
                className="mt-auto pt-3 text-[11px] font-light text-ink/55 underline-offset-4 hover:text-ink hover:underline"
              >
                К списку →
              </Link>
            </div>

            <div
              className={`flex min-h-[100px] flex-1 flex-col justify-center rounded-[3px] border ${BORDER} p-5 lg:min-h-0`}
            >
              <p className="text-[10px] font-light uppercase leading-none tracking-[-0.02em] text-ink/50">
                Сегодня по таймеру
              </p>
              <p
                className="mt-3 text-2xl font-light leading-none tracking-[-0.05em] sm:text-3xl"
                title="Сумма завершённых сессий учёта времени за сегодня (локальная дата)"
              >
                {formatDurationRu(timerSecondsToday)}
              </p>
              <Link
                to="/settings"
                className="mt-auto pt-3 text-[11px] font-light text-ink/55 underline-offset-4 hover:text-ink hover:underline"
              >
                Журнал в настройках →
              </Link>
            </div>

            <div
              className={`flex min-h-[100px] flex-1 flex-col justify-center rounded-[3px] border ${BORDER} p-5 lg:min-h-0`}
            >
              <p className="text-[10px] font-light uppercase leading-none tracking-[-0.02em] text-ink/50">
                Ближайший дедлайн
              </p>
              {nearest ? (
                <>
                  <p className="mt-3 text-base font-light leading-tight tracking-[-0.03em]">
                    {nearest.date.toLocaleDateString('ru-RU', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </p>
                  <p className="mt-1.5 line-clamp-3 text-xs font-light text-ink/70">
                    {nearest.label}
                    {nearest.sublabel ? ` · ${nearest.sublabel}` : ''}
                  </p>
                  {nearest.slug ? (
                    <Link
                      to={`/projects/${nearest.slug}`}
                      className="mt-auto pt-3 text-[11px] font-light text-ink/55 underline-offset-4 hover:text-ink hover:underline"
                    >
                      Проект →
                    </Link>
                  ) : nearest.id.startsWith('task-') ? (
                    <Link
                      to={`/tasks#${nearest.id}`}
                      className="mt-auto pt-3 text-[11px] font-light text-ink/55 underline-offset-4 hover:text-ink hover:underline"
                    >
                      Задача →
                    </Link>
                  ) : (
                    <Link
                      to="/calendar"
                      className="mt-auto pt-3 text-[11px] font-light text-ink/55 underline-offset-4 hover:text-ink hover:underline"
                    >
                      Календарь →
                    </Link>
                  )}
                </>
              ) : (
                <p className="mt-3 text-xs font-light text-ink/45">
                  Нет предстоящих дат.
                </p>
              )}
            </div>
          </aside>

          <section
            className={`flex min-h-[280px] flex-col rounded-[3px] border ${BORDER} p-5 lg:h-full lg:min-h-0 lg:overflow-hidden`}
          >
            <div className="flex shrink-0 flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-[10px] font-light uppercase leading-none tracking-[-0.02em] text-ink/50">
                  Активность и проекты
                </h2>
                <p className="mt-1 text-[11px] font-light text-ink/45">
                  Сводка активности и превью проектов.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  to="/calendar"
                  className="text-[11px] font-light text-ink/55 underline-offset-4 hover:text-ink hover:underline"
                >
                  Календарь →
                </Link>
                <Link
                  to="/projects"
                  className="text-[11px] font-light text-ink/55 underline-offset-4 hover:text-ink hover:underline"
                >
                  Все проекты →
                </Link>
              </div>
            </div>

            <div className="mt-4 grid min-h-0 flex-1 gap-4 lg:grid-rows-[1fr_minmax(10rem,26vh)] lg:gap-5">
              <div className="min-h-0 overflow-x-auto overflow-y-auto lg:min-h-0 lg:overflow-y-hidden">
                <div className="flex h-full min-h-[160px] w-full min-w-0 items-stretch justify-stretch lg:min-h-0">
                  <ActivityHeatmap activityByDay={activityByDay} />
                </div>
              </div>

              <div className="flex min-h-0 flex-col border-t border-[rgba(10,10,10,0.12)] pt-4 lg:min-h-0 lg:pt-5">
                <p className="shrink-0 text-[10px] font-light uppercase leading-none tracking-[-0.02em] text-ink/50">
                  Проекты
                </p>
                {previewProjects.length === 0 ? (
                  <p className="mt-3 text-sm font-light text-ink/40">
                    Проектов пока нет.
                  </p>
                ) : (
                  <div className="mt-3 grid min-h-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                    {previewProjects.map((p) => (
                      <ProjectPreviewCard key={p.id} project={p} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
