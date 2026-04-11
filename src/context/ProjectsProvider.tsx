import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { CreateProjectForm } from '../types/projectForm'
import type { CreateStageForm } from '../types/stageForm'
import { DEFAULT_PROJECT_STAGES } from '../data/defaultStages'
import {
  formatDurationRuFromParts,
  parseDurationTokensLoose,
} from '../lib/durationTokens'
import { formatDurationRu } from '../lib/formatDurationRu'
import { formatRubDots, parseAmountRub } from '../lib/parseAmountRub'
import { uniqueSlug } from '../lib/slug'
import { useAuth } from '../hooks/useAuth'
import { useSettings } from '../hooks/useSettings'
import { useRemoteSync } from './remoteSyncContext'
import {
  clearTimerSessionLog as clearTimerSessionsStorage,
  getTimerSessionLog,
  appendTimerSessionLog,
  replaceTimerSessionLog,
} from '../lib/timerSessionsStorage'
import {
  fetchPortfolioBundle,
  upsertCalendarEventRemote,
  upsertFinanceTransactionRemote,
  upsertProjectToSupabase,
  type PortfolioBundle,
} from '../lib/portfolioSupabase'
import {
  clearTimerSessionLogRemote,
  fetchTimerSessionLogFromSupabase,
  insertTimerSessionLogRow,
  mergeTimerSessionLogs,
} from '../lib/timerSessionLogSupabase'
import type { CalendarCustomEvent } from '../types/calendarCustomEvent'
import type { FinanceTransaction } from '../types/financeTransaction'
import type { Project, ProjectStage } from '../types/project'
import type { TimerSessionLogEntry } from '../types/timerSessionLog'
import { ProjectsContext, type RunningStageTimer } from './projectsContext'

function formToProject(
  data: CreateProjectForm,
  id: string,
  slug: string,
): Project {
  const title = data.title.trim() || 'Название проекта'
  const client = data.client.trim() || 'Клиент'
  const rub = parseAmountRub(data.cost)
  const amount = formatRubDots(rub)
  const deadline = data.deadline.trim() || '—'
  const tags = [
    data.projectStatus,
    data.paymentStatus,
    data.section,
  ] as const
  return {
    id,
    slug,
    title,
    client,
    amount,
    deadline,
    progress: 0,
    tags,
    stages: [...DEFAULT_PROJECT_STAGES],
    comment: data.comment.trim() || undefined,
  }
}

function applyProjectForm(p: Project, data: CreateProjectForm): Project {
  const title = data.title.trim() || 'Название проекта'
  const client = data.client.trim() || 'Клиент'
  const rub = parseAmountRub(data.cost)
  const amount = formatRubDots(rub)
  const deadline = data.deadline.trim() || '—'
  const tags = [
    data.projectStatus,
    data.paymentStatus,
    data.section,
  ] as const
  return {
    ...p,
    title,
    client,
    amount,
    deadline,
    tags: [...tags],
    comment: data.comment.trim() || undefined,
  }
}

function applyStageForm(data: CreateStageForm, previous: ProjectStage): ProjectStage {
  const next = formToStage(data, previous.id)
  const tracked = previous.timeSpentSeconds
  const checklist = data.checklist.map((c) => ({
    id: c.id,
    label: c.label,
    done: c.done,
  }))
  return {
    ...next,
    addedAt: previous.addedAt,
    checklist: checklist.length > 0 ? checklist : undefined,
    timeSpentSeconds: tracked,
    actual:
      tracked != null
        ? `фактическое время: ${formatDurationRu(tracked)}`
        : next.actual,
  }
}

function formToStage(data: CreateStageForm, id: string): ProjectStage {
  const rub = parseAmountRub(data.cost)
  const costDisplay = formatRubDots(rub)
  const trimmedPlan = data.plannedTime.trim()
  let plannedPhrase = '—'
  if (trimmedPlan) {
    const pt = parseDurationTokensLoose(trimmedPlan)
    if (pt) plannedPhrase = formatDurationRuFromParts(pt.h, pt.m, pt.s)
  }
  const planned = `Планируемое время: ${plannedPhrase} · Стоимость этапа: ${costDisplay} · Оплата: ${data.paymentStatus}`
  const comment = data.comment.trim()
  const actual = comment
    ? `фактическое время: — · ${comment}`
    : 'фактическое время: —'
  const checklist =
    data.checklist.length > 0
      ? data.checklist.map((c) => ({
          id: c.id,
          label: c.label,
          done: c.done,
        }))
      : undefined
  return {
    id,
    name: data.name.trim() || 'Этап',
    status: data.stageStatus,
    deadline: data.deadline.trim() || '—',
    planned,
    actual,
    actualInPill: data.stageStatus === 'В работе',
    description: comment || undefined,
    modalTags: [data.paymentStatus],
    checklist,
  }
}

function sumStagesSeconds(stages: readonly ProjectStage[] | undefined): number {
  if (!stages?.length) return 0
  let t = 0
  for (const s of stages) {
    t += s.timeSpentSeconds ?? 0
  }
  return t
}

/** Секунды текущего сеанса (с учётом паузы и текущего отрезка) — для записи на этап */
function sessionSecondsToCommit(ts: RunningStageTimer): number {
  if (ts.isPaused) return ts.accumulatedSessionSeconds
  return (
    ts.accumulatedSessionSeconds +
    Math.floor((Date.now() - ts.segmentStartedAt) / 1000)
  )
}

export function ProjectsProvider({ children }: { children: ReactNode }) {
  const { client, session } = useAuth()
  const userId = session?.user?.id ?? null
  const { settings } = useSettings()
  const readOnly = settings.readOnlyMode
  const { setPortfolioSync, touchSaved } = useRemoteSync()

  const [projects, setProjects] = useState<Project[]>([])
  const projectsRef = useRef<Project[]>([])
  const [timerSessionLog, setTimerSessionLog] = useState<TimerSessionLogEntry[]>(
    () => getTimerSessionLog(),
  )
  const timerRemoteSyncedFor = useRef<string | null>(null)
  const [financeTransactions, setFinanceTransactions] = useState<
    FinanceTransaction[]
  >([])
  const [calendarCustomEvents, setCalendarCustomEvents] = useState<
    CalendarCustomEvent[]
  >([])
  const financeRef = useRef(financeTransactions)
  const calendarRef = useRef(calendarCustomEvents)
  const portfolioLoadedFor = useRef<string | null>(null)
  const persistProjectTimers = useRef<Map<string, number>>(new Map())

  const runningRef = useRef<RunningStageTimer | null>(null)
  const [runningStageTimer, setRunningStageTimer] =
    useState<RunningStageTimer | null>(null)
  /** Секунды текущего незакоммиченного сеанса (без Date.now в рендере) */
  const [sessionElapsed, setSessionElapsed] = useState(0)

  useEffect(() => {
    projectsRef.current = projects
  }, [projects])

  useEffect(() => {
    financeRef.current = financeTransactions
  }, [financeTransactions])

  useEffect(() => {
    calendarRef.current = calendarCustomEvents
  }, [calendarCustomEvents])

  useEffect(() => {
    if (session?.user?.id) return
    portfolioLoadedFor.current = null
    setProjects([])
    setFinanceTransactions([])
    setCalendarCustomEvents([])
  }, [session?.user?.id])

  const reportSaveError = useCallback(
    (err: Error | null) => {
      if (err) {
        setPortfolioSync({ kind: 'error', message: err.message })
      } else {
        touchSaved()
      }
    },
    [setPortfolioSync, touchSaved],
  )

  const persistProjectBySlug = useCallback(
    (slug: string) => {
      if (!client || !userId || readOnly) return
      const p = projectsRef.current.find((x) => x.slug === slug)
      if (!p) return
      setPortfolioSync({ kind: 'saving' })
      void upsertProjectToSupabase(client, userId, p).then((e) =>
        reportSaveError(e),
      )
    },
    [client, userId, readOnly, reportSaveError, setPortfolioSync],
  )

  const schedulePersistProject = useCallback(
    (slug: string) => {
      const prev = persistProjectTimers.current.get(slug)
      if (prev != null) window.clearTimeout(prev)
      const id = window.setTimeout(() => {
        persistProjectTimers.current.delete(slug)
        persistProjectBySlug(slug)
      }, 480)
      persistProjectTimers.current.set(slug, id)
    },
    [persistProjectBySlug],
  )

  const replacePortfolioData = useCallback((payload: PortfolioBundle) => {
    setProjects(payload.projects)
    setFinanceTransactions(payload.financeTransactions)
    setCalendarCustomEvents(payload.calendarCustomEvents)
  }, [])

  const syncPortfolioToRemote = useCallback(async () => {
    if (!client || !userId || readOnly) return
    setPortfolioSync({ kind: 'saving' })
    try {
      for (const p of projectsRef.current) {
        const e = await upsertProjectToSupabase(client, userId, p)
        if (e) throw e
      }
      for (const t of financeRef.current) {
        const e = await upsertFinanceTransactionRemote(client, userId, t)
        if (e) throw e
      }
      for (const c of calendarRef.current) {
        const e = await upsertCalendarEventRemote(client, userId, c)
        if (e) throw e
      }
      touchSaved()
    } catch (e) {
      setPortfolioSync({
        kind: 'error',
        message: e instanceof Error ? e.message : 'Ошибка синхронизации',
      })
    }
  }, [client, userId, readOnly, setPortfolioSync, touchSaved])

  useEffect(() => {
    if (!client || !userId) return
    if (portfolioLoadedFor.current === userId) return
    let cancelled = false
    setPortfolioSync({ kind: 'loading' })
    void fetchPortfolioBundle(client, userId)
      .then((bundle) => {
        if (cancelled) return
        setProjects(bundle.projects)
        setFinanceTransactions(bundle.financeTransactions)
        setCalendarCustomEvents(bundle.calendarCustomEvents)
        portfolioLoadedFor.current = userId
        setPortfolioSync({ kind: 'saved', at: Date.now() })
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setPortfolioSync({
          kind: 'error',
          message: e instanceof Error ? e.message : 'Не удалось загрузить данные',
        })
      })
    return () => {
      cancelled = true
    }
  }, [client, userId, setPortfolioSync])

  useEffect(() => {
    if (!client || !session?.user?.id) {
      timerRemoteSyncedFor.current = null
      return
    }
    const userId = session.user.id
    if (timerRemoteSyncedFor.current === userId) return

    let cancelled = false
    void (async () => {
      try {
        const remote = await fetchTimerSessionLogFromSupabase(client, userId)
        const local = getTimerSessionLog()
        for (const e of local) {
          if (cancelled) return
          if (!remote.some((r) => r.id === e.id)) {
            await insertTimerSessionLogRow(client, userId, e)
          }
        }
        if (cancelled) return
        const remoteFresh = await fetchTimerSessionLogFromSupabase(client, userId)
        const merged = mergeTimerSessionLogs(remoteFresh, local)
        replaceTimerSessionLog(merged)
        if (!cancelled) {
          setTimerSessionLog(merged)
          timerRemoteSyncedFor.current = userId
        }
      } catch {
        if (!cancelled) timerRemoteSyncedFor.current = userId
      }
    })()

    return () => {
      cancelled = true
    }
  }, [client, session?.user?.id])

  const recordTimerSession = useCallback(
    (projectSlug: string, stageId: string, seconds: number) => {
      if (seconds <= 0) return
      const p = projectsRef.current.find((x) => x.slug === projectSlug)
      const stages = p?.stages ?? DEFAULT_PROJECT_STAGES
      const st = stages.find((s) => s.id === stageId)
      const id =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `ts-${Date.now()}`
      const entry: TimerSessionLogEntry = {
        id,
        endedAt: new Date().toISOString(),
        projectSlug,
        stageId,
        projectTitle: p?.title ?? projectSlug,
        stageName: st?.name ?? 'Этап',
        seconds,
      }
      appendTimerSessionLog(entry)
      setTimerSessionLog(getTimerSessionLog())
      if (client && userId && !readOnly) {
        void insertTimerSessionLogRow(client, userId, entry)
      }
    },
    [client, userId, readOnly],
  )

  const clearTimerSessionLog = useCallback(() => {
    clearTimerSessionsStorage()
    setTimerSessionLog([])
    if (client && userId && !readOnly) {
      void clearTimerSessionLogRemote(client, userId)
    }
  }, [client, userId, readOnly])

  useEffect(() => {
    if (!runningStageTimer || runningStageTimer.isPaused) return
    const tick = () => {
      setSessionElapsed(
        runningStageTimer.accumulatedSessionSeconds +
          Math.floor(
            (Date.now() - runningStageTimer.segmentStartedAt) / 1000,
          ),
      )
    }
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [runningStageTimer])

  const addElapsedToStage = useCallback(
    (projectSlug: string, stageId: string, seconds: number) => {
      if (seconds <= 0) return
      setProjects((prev) =>
        prev.map((p) => {
          if (p.slug !== projectSlug) return p
          const base = [...(p.stages ?? DEFAULT_PROJECT_STAGES)]
          const idx = base.findIndex((s) => s.id === stageId)
          if (idx === -1) return p
          const st = base[idx]
          const nextSec = (st.timeSpentSeconds ?? 0) + seconds
          base[idx] = {
            ...st,
            timeSpentSeconds: nextSec,
            actual: `фактическое время: ${formatDurationRu(nextSec)}`,
          }
          return { ...p, stages: base }
        }),
      )
      persistProjectBySlug(projectSlug)
    },
    [persistProjectBySlug],
  )

  const startStageTimer = useCallback(
    (projectSlug: string, stageId: string) => {
      const prev = runningRef.current
      if (prev) {
        const sec = sessionSecondsToCommit(prev)
        if (sec > 0) {
          addElapsedToStage(prev.projectSlug, prev.stageId, sec)
          recordTimerSession(prev.projectSlug, prev.stageId, sec)
        }
      }
      const next: RunningStageTimer = {
        projectSlug,
        stageId,
        segmentStartedAt: Date.now(),
        accumulatedSessionSeconds: 0,
        isPaused: false,
      }
      runningRef.current = next
      setSessionElapsed(0)
      setRunningStageTimer(next)
    },
    [addElapsedToStage, recordTimerSession],
  )

  const stopStageTimer = useCallback(() => {
    const prev = runningRef.current
    if (prev) {
      const sec = sessionSecondsToCommit(prev)
      if (sec > 0) {
        addElapsedToStage(prev.projectSlug, prev.stageId, sec)
        recordTimerSession(prev.projectSlug, prev.stageId, sec)
      }
    }
    runningRef.current = null
    setSessionElapsed(0)
    setRunningStageTimer(null)
  }, [addElapsedToStage, recordTimerSession])

  const pauseStageTimer = useCallback(() => {
    const prev = runningRef.current
    if (!prev || prev.isPaused) return
    const delta = Math.floor((Date.now() - prev.segmentStartedAt) / 1000)
    const next: RunningStageTimer = {
      ...prev,
      isPaused: true,
      accumulatedSessionSeconds: prev.accumulatedSessionSeconds + delta,
    }
    runningRef.current = next
    setRunningStageTimer(next)
    setSessionElapsed(next.accumulatedSessionSeconds)
  }, [])

  const resumeStageTimer = useCallback(() => {
    const prev = runningRef.current
    if (!prev || !prev.isPaused) return
    const next: RunningStageTimer = {
      ...prev,
      isPaused: false,
      segmentStartedAt: Date.now(),
    }
    runningRef.current = next
    setRunningStageTimer(next)
    setSessionElapsed(next.accumulatedSessionSeconds)
  }, [])

  const toggleStageTimer = useCallback(
    (projectSlug: string, stageId: string) => {
      const r = runningRef.current
      if (r && r.projectSlug === projectSlug && r.stageId === stageId) {
        stopStageTimer()
      } else {
        startStageTimer(projectSlug, stageId)
      }
    },
    [startStageTimer, stopStageTimer],
  )

  const isStageTimerRunning = useCallback(
    (projectSlug: string, stageId: string) => {
      const r = runningStageTimer
      return (
        r?.projectSlug === projectSlug &&
        r?.stageId === stageId &&
        !r.isPaused
      )
    },
    [runningStageTimer],
  )

  const isStageTimerSessionActive = useCallback(
    (projectSlug: string, stageId: string) => {
      const r = runningStageTimer
      return r?.projectSlug === projectSlug && r?.stageId === stageId
    },
    [runningStageTimer],
  )

  const toggleStageChecklistItem = useCallback(
    (projectSlug: string, stageId: string, itemId: string) => {
      setProjects((prev) =>
        prev.map((p) => {
          if (p.slug !== projectSlug) return p
          const base = [...(p.stages ?? DEFAULT_PROJECT_STAGES)]
          const idx = base.findIndex((s) => s.id === stageId)
          if (idx === -1) return p
          const st = base[idx]
          const list = st.checklist
          if (!list?.length) return p
          base[idx] = {
            ...st,
            checklist: list.map((c) =>
              c.id === itemId ? { ...c, done: !c.done } : c,
            ),
          }
          return { ...p, stages: base }
        }),
      )
      schedulePersistProject(projectSlug)
    },
    [schedulePersistProject],
  )

  const headerTimerSeconds = useMemo(() => {
    let t = 0
    for (const p of projects) {
      t += sumStagesSeconds(p.stages)
    }
    return t + sessionElapsed
  }, [projects, sessionElapsed])

  const getProjectTrackedSeconds = useCallback(
    (projectSlug: string) => {
      const p = projects.find((x) => x.slug === projectSlug)
      let t = sumStagesSeconds(p?.stages)
      if (runningStageTimer?.projectSlug === projectSlug) {
        t += sessionElapsed
      }
      return t
    },
    [projects, sessionElapsed, runningStageTimer],
  )

  const getProjectBySlug = useCallback(
    (slug: string) => projects.find((p) => p.slug === slug),
    [projects],
  )

  const addFinanceTransaction = useCallback(
    (data: Omit<FinanceTransaction, 'id'>) => {
      const id =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `tx-${Date.now()}`
      const row: FinanceTransaction = { ...data, id }
      setFinanceTransactions((prev) => [row, ...prev])
      if (client && userId && !readOnly) {
        setPortfolioSync({ kind: 'saving' })
        void upsertFinanceTransactionRemote(client, userId, row).then((e) =>
          reportSaveError(e),
        )
      }
    },
    [client, userId, readOnly, reportSaveError, setPortfolioSync],
  )

  const addCalendarCustomEvent = useCallback(
    (data: Omit<CalendarCustomEvent, 'id'>) => {
      const id =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `cal-${Date.now()}`
      const row: CalendarCustomEvent = { ...data, id }
      setCalendarCustomEvents((prev) => [...prev, row])
      if (client && userId && !readOnly) {
        setPortfolioSync({ kind: 'saving' })
        void upsertCalendarEventRemote(client, userId, row).then((e) =>
          reportSaveError(e),
        )
      }
    },
    [client, userId, readOnly, reportSaveError, setPortfolioSync],
  )

  const addProject = useCallback(
    (data: CreateProjectForm) => {
      setProjects((prev) => {
        const taken = new Set(prev.map((p) => p.slug))
        const slug = uniqueSlug(data.title.trim() || 'Проект', taken)
        const id =
          typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `p-${Date.now()}`
        const newP = formToProject(data, id, slug)
        if (client && userId && !readOnly) {
          setPortfolioSync({ kind: 'saving' })
          void upsertProjectToSupabase(client, userId, newP).then((e) =>
            reportSaveError(e),
          )
        }
        return [newP, ...prev]
      })
    },
    [client, userId, readOnly, reportSaveError, setPortfolioSync],
  )

  const updateProject = useCallback(
    (projectSlug: string, data: CreateProjectForm) => {
      setProjects((prev) =>
        prev.map((p) => (p.slug === projectSlug ? applyProjectForm(p, data) : p)),
      )
      schedulePersistProject(projectSlug)
    },
    [schedulePersistProject],
  )

  const addProjectStage = useCallback(
    (projectSlug: string, data: CreateStageForm) => {
      setProjects((prev) =>
        prev.map((p) => {
          if (p.slug !== projectSlug) return p
          const base = [...(p.stages ?? DEFAULT_PROJECT_STAGES)]
          const id =
            typeof crypto !== 'undefined' && crypto.randomUUID
              ? crypto.randomUUID()
              : `st-${Date.now()}`
          return {
            ...p,
            stages: [
              ...base,
              {
                ...formToStage(data, id),
                addedAt: new Date().toISOString(),
              },
            ],
          }
        }),
      )
      schedulePersistProject(projectSlug)
    },
    [schedulePersistProject],
  )

  const updateProjectStage = useCallback(
    (projectSlug: string, stageId: string, data: CreateStageForm) => {
      setProjects((prev) =>
        prev.map((p) => {
          if (p.slug !== projectSlug) return p
          const base = [...(p.stages ?? DEFAULT_PROJECT_STAGES)]
          const idx = base.findIndex((s) => s.id === stageId)
          if (idx === -1) return p
          base[idx] = applyStageForm(data, base[idx])
          return { ...p, stages: base }
        }),
      )
      schedulePersistProject(projectSlug)
    },
    [schedulePersistProject],
  )

  const removeProjectStage = useCallback(
    (projectSlug: string, stageId: string) => {
      const r = runningRef.current
      if (r && r.projectSlug === projectSlug && r.stageId === stageId) {
        runningRef.current = null
        setSessionElapsed(0)
        setRunningStageTimer(null)
      }
      setProjects((prev) =>
        prev.map((p) => {
          if (p.slug !== projectSlug) return p
          const base = [...(p.stages ?? DEFAULT_PROJECT_STAGES)]
          return { ...p, stages: base.filter((s) => s.id !== stageId) }
        }),
      )
      schedulePersistProject(projectSlug)
    },
    [schedulePersistProject],
  )

  const value = useMemo(
    () => ({
      projects,
      financeTransactions,
      addFinanceTransaction,
      calendarCustomEvents,
      addCalendarCustomEvent,
      addProject,
      updateProject,
      addProjectStage,
      updateProjectStage,
      removeProjectStage,
      getProjectBySlug,
      runningStageTimer,
      startStageTimer,
      stopStageTimer,
      pauseStageTimer,
      resumeStageTimer,
      toggleStageTimer,
      isStageTimerRunning,
      isStageTimerSessionActive,
      headerTimerSeconds,
      stageTimerSessionSeconds: sessionElapsed,
      getProjectTrackedSeconds,
      toggleStageChecklistItem,
      timerSessionLog,
      clearTimerSessionLog,
      replacePortfolioData,
      syncPortfolioToRemote,
    }),
    [
      projects,
      financeTransactions,
      addFinanceTransaction,
      calendarCustomEvents,
      addCalendarCustomEvent,
      addProject,
      updateProject,
      addProjectStage,
      updateProjectStage,
      removeProjectStage,
      getProjectBySlug,
      runningStageTimer,
      startStageTimer,
      stopStageTimer,
      pauseStageTimer,
      resumeStageTimer,
      toggleStageTimer,
      isStageTimerRunning,
      isStageTimerSessionActive,
      headerTimerSeconds,
      sessionElapsed,
      getProjectTrackedSeconds,
      toggleStageChecklistItem,
      timerSessionLog,
      clearTimerSessionLog,
      replacePortfolioData,
      syncPortfolioToRemote,
    ],
  )

  return (
    <ProjectsContext.Provider value={value}>{children}</ProjectsContext.Provider>
  )
}
