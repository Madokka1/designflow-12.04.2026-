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
import { invokeTelegramCreateNotify } from '../lib/invokeTelegramCreateNotify'
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
import { cloneStagesWithNewIds } from '../lib/cloneStages'
import { mergeProjectsBySlug, mergeRecordsById } from '../lib/portfolioMerge'
import {
  deleteClientRemote,
  deleteTaskRemote,
  deleteTemplateRemote,
  fetchPortfolioBundle,
  upsertCalendarEventRemote,
  upsertClientRemote,
  upsertFinanceTransactionRemote,
  upsertProjectToSupabase,
  upsertTaskRemote,
  upsertTemplateRemote,
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
import type { ProjectTemplate } from '../types/projectTemplate'
import type { TimerSessionLogEntry } from '../types/timerSessionLog'
import type { WorkspaceClient } from '../types/workspaceClient'
import type { WorkspaceTask } from '../types/workspaceTask'
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
  const cid = data.clientId.trim()
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
    archived: false,
    clientId: cid ? cid : null,
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
  const cid = data.clientId.trim()
  return {
    ...p,
    title,
    client,
    amount,
    deadline,
    tags: [...tags],
    comment: data.comment.trim() || undefined,
    clientId: cid ? cid : null,
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
  const readOnlyPrev = useRef(readOnly)
  const [financeTransactions, setFinanceTransactions] = useState<
    FinanceTransaction[]
  >([])
  const [calendarCustomEvents, setCalendarCustomEvents] = useState<
    CalendarCustomEvent[]
  >([])
  const [clients, setClients] = useState<WorkspaceClient[]>([])
  const [tasks, setTasks] = useState<WorkspaceTask[]>([])
  const [templates, setTemplates] = useState<ProjectTemplate[]>([])
  const financeRef = useRef(financeTransactions)
  const calendarRef = useRef(calendarCustomEvents)
  const clientsRef = useRef(clients)
  const tasksRef = useRef(tasks)
  const templatesRef = useRef(templates)
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
    clientsRef.current = clients
  }, [clients])

  useEffect(() => {
    tasksRef.current = tasks
  }, [tasks])

  useEffect(() => {
    templatesRef.current = templates
  }, [templates])

  useEffect(() => {
    if (session?.user?.id) return
    portfolioLoadedFor.current = null
    setProjects([])
    setFinanceTransactions([])
    setCalendarCustomEvents([])
    setClients([])
    setTasks([])
    setTemplates([])
  }, [session?.user?.id])

  useEffect(() => {
    if (readOnlyPrev.current && !readOnly) {
      timerRemoteSyncedFor.current = null
    }
    readOnlyPrev.current = readOnly
  }, [readOnly])

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
    setClients(payload.clients ?? [])
    setTasks(payload.tasks ?? [])
    setTemplates(payload.templates ?? [])
  }, [])

  const mergePortfolioData = useCallback((payload: PortfolioBundle) => {
    setProjects((prev) => mergeProjectsBySlug(prev, payload.projects))
    setFinanceTransactions((prev) =>
      mergeRecordsById(prev, payload.financeTransactions),
    )
    setCalendarCustomEvents((prev) =>
      mergeRecordsById(prev, payload.calendarCustomEvents),
    )
    setClients((prev) => mergeRecordsById(prev, payload.clients ?? []))
    setTasks((prev) => mergeRecordsById(prev, payload.tasks ?? []))
    setTemplates((prev) => mergeRecordsById(prev, payload.templates ?? []))
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
      for (const cl of clientsRef.current) {
        const e = await upsertClientRemote(client, userId, cl)
        if (e) throw e
      }
      for (const t of tasksRef.current) {
        const e = await upsertTaskRemote(client, userId, t)
        if (e) throw e
      }
      for (const tpl of templatesRef.current) {
        const e = await upsertTemplateRemote(client, userId, tpl)
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
        setClients(bundle.clients ?? [])
        setTasks(bundle.tasks ?? [])
        setTemplates(bundle.templates ?? [])
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
          if (
            !readOnly &&
            !remote.some((r) => r.id === e.id)
          ) {
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
  }, [client, session?.user?.id, readOnly])

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
    (
      data: CreateProjectForm,
      options?: { stages?: readonly ProjectStage[] },
    ) => {
      setProjects((prev) => {
        const taken = new Set(prev.map((p) => p.slug))
        const slug = uniqueSlug(data.title.trim() || 'Проект', taken)
        const id =
          typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `p-${Date.now()}`
        let newP = formToProject(data, id, slug)
        if (options?.stages?.length) {
          newP = {
            ...newP,
            stages: cloneStagesWithNewIds(options.stages),
          }
        }
        if (client && userId && !readOnly) {
          setPortfolioSync({ kind: 'saving' })
          void upsertProjectToSupabase(client, userId, newP).then((e) => {
            reportSaveError(e)
            if (!e) {
              void invokeTelegramCreateNotify(
                client,
                `📁 Новый проект: «${newP.title}»`,
              )
            }
          })
        }
        return [newP, ...prev]
      })
    },
    [client, userId, readOnly, reportSaveError, setPortfolioSync],
  )

  const addProjectFromTemplate = useCallback(
    (data: CreateProjectForm, templateId: string) => {
      const tpl = templatesRef.current.find((t) => t.id === templateId)
      addProject(data, tpl?.stages?.length ? { stages: tpl.stages } : undefined)
    },
    [addProject],
  )

  const duplicateProject = useCallback(
    (projectSlug: string): string | null => {
      const p = projectsRef.current.find((x) => x.slug === projectSlug)
      if (!p) return null
      const prev = projectsRef.current
      const taken = new Set(prev.map((x) => x.slug))
      const title = `${p.title.trim() || 'Проект'} (копия)`
      const slug = uniqueSlug(title, taken)
      const id =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `p-${Date.now()}`
      const baseStages = p.stages?.length ? [...p.stages] : [...DEFAULT_PROJECT_STAGES]
      const stages = cloneStagesWithNewIds(baseStages).map((s) => ({
        ...s,
        timeSpentSeconds: undefined,
      }))
      const newP: Project = {
        ...p,
        id,
        slug,
        title,
        stages,
        archived: false,
      }
      setProjects((list) => [newP, ...list])
      if (client && userId && !readOnly) {
        setPortfolioSync({ kind: 'saving' })
        void upsertProjectToSupabase(client, userId, newP).then((e) =>
          reportSaveError(e),
        )
      }
      return slug
    },
    [client, userId, readOnly, reportSaveError, setPortfolioSync],
  )

  const setProjectArchived = useCallback(
    (projectSlug: string, archived: boolean) => {
      setProjects((prev) =>
        prev.map((p) => (p.slug === projectSlug ? { ...p, archived } : p)),
      )
      schedulePersistProject(projectSlug)
    },
    [schedulePersistProject],
  )

  const saveProjectAsTemplate = useCallback(
    (projectSlug: string, templateName: string) => {
      const p = projectsRef.current.find((x) => x.slug === projectSlug)
      if (!p?.stages?.length) return
      const stages = p.stages
      const id =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `tpl-${Date.now()}`
      const tpl: ProjectTemplate = {
        id,
        name: templateName.trim() || p.title,
        stages: stages.map((s) => ({ ...s })),
      }
      setTemplates((prev) => [tpl, ...prev])
      if (client && userId && !readOnly) {
        setPortfolioSync({ kind: 'saving' })
        void upsertTemplateRemote(client, userId, tpl).then((e) =>
          reportSaveError(e),
        )
      }
    },
    [client, userId, readOnly, reportSaveError, setPortfolioSync],
  )

  const getClientById = useCallback(
    (id: string) => clients.find((c) => c.id === id),
    [clients],
  )

  const addClient = useCallback(
    (data: Omit<WorkspaceClient, 'id'>) => {
      const id =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `cl-${Date.now()}`
      const row: WorkspaceClient = {
        id,
        name: data.name.trim() || 'Клиент',
        email: data.email ?? '',
        phone: data.phone ?? '',
        company: data.company ?? '',
        notes: data.notes ?? '',
      }
      setClients((prev) =>
        [...prev, row].sort((a, b) => a.name.localeCompare(b.name, 'ru')),
      )
      if (client && userId && !readOnly) {
        setPortfolioSync({ kind: 'saving' })
        void upsertClientRemote(client, userId, row).then((e) => {
          reportSaveError(e)
          if (!e) {
            void invokeTelegramCreateNotify(
              client,
              `👤 Новый клиент: «${row.name}»`,
            )
          }
        })
      }
      return row
    },
    [client, userId, readOnly, reportSaveError, setPortfolioSync],
  )

  const updateClient = useCallback(
    (id: string, patch: Partial<Omit<WorkspaceClient, 'id'>>) => {
      setClients((prev) => {
        const next = prev.map((c) => {
          if (c.id !== id) return c
          const merged = { ...c, ...patch }
          if (patch.name !== undefined) {
            merged.name = patch.name.trim() || c.name
          }
          return merged
        })
        const updated = next.find((c) => c.id === id)
        if (updated && client && userId && !readOnly) {
          setPortfolioSync({ kind: 'saving' })
          void upsertClientRemote(client, userId, updated).then((e) =>
            reportSaveError(e),
          )
        }
        return next.sort((a, b) => a.name.localeCompare(b.name, 'ru'))
      })
    },
    [client, userId, readOnly, reportSaveError, setPortfolioSync],
  )

  const deleteClient = useCallback(
    (id: string) => {
      const slugs = projectsRef.current
        .filter((p) => p.clientId === id)
        .map((p) => p.slug)
      setClients((prev) => prev.filter((c) => c.id !== id))
      setProjects((prev) =>
        prev.map((p) => (p.clientId === id ? { ...p, clientId: null } : p)),
      )
      if (client && userId && !readOnly) {
        void deleteClientRemote(client, id)
      }
      for (const s of slugs) schedulePersistProject(s)
    },
    [client, userId, readOnly, schedulePersistProject],
  )

  const addTask = useCallback(
    (
      partial: Omit<WorkspaceTask, 'id' | 'sortOrder'> & { sortOrder?: number },
    ) => {
      const id =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `task-${Date.now()}`
      const sortOrder =
        partial.sortOrder ??
        tasksRef.current.reduce((m, t) => Math.max(m, t.sortOrder), -1) + 1
      const row: WorkspaceTask = {
        id,
        title: partial.title.trim() || 'Задача',
        done: partial.done ?? false,
        dueDate: partial.dueDate ?? '',
        projectSlug: partial.projectSlug ?? null,
        labels: partial.labels ?? [],
        sortOrder,
      }
      setTasks((prev) => [...prev, row])
      if (client && userId && !readOnly) {
        setPortfolioSync({ kind: 'saving' })
        void upsertTaskRemote(client, userId, row).then((e) => {
          reportSaveError(e)
          if (!e) {
            void invokeTelegramCreateNotify(
              client,
              `✓ Новая задача: «${row.title}»`,
            )
          }
        })
      }
      return row
    },
    [client, userId, readOnly, reportSaveError, setPortfolioSync],
  )

  const updateTask = useCallback(
    (id: string, patch: Partial<Omit<WorkspaceTask, 'id'>>) => {
      setTasks((prev) => {
        const next = prev.map((t) => (t.id === id ? { ...t, ...patch } : t))
        const updated = next.find((t) => t.id === id)
        if (updated && client && userId && !readOnly) {
          setPortfolioSync({ kind: 'saving' })
          void upsertTaskRemote(client, userId, updated).then((e) =>
            reportSaveError(e),
          )
        }
        return next
      })
    },
    [client, userId, readOnly, reportSaveError, setPortfolioSync],
  )

  const toggleTaskDone = useCallback(
    (id: string) => {
      setTasks((prev) => {
        const next = prev.map((t) =>
          t.id === id ? { ...t, done: !t.done } : t,
        )
        const updated = next.find((t) => t.id === id)
        if (updated && client && userId && !readOnly) {
          void upsertTaskRemote(client, userId, updated).then((e) =>
            reportSaveError(e),
          )
        }
        return next
      })
    },
    [client, userId, readOnly, reportSaveError],
  )

  const deleteTask = useCallback(
    (id: string) => {
      setTasks((prev) => prev.filter((t) => t.id !== id))
      if (client && userId && !readOnly) {
        void deleteTaskRemote(client, id)
      }
    },
    [client, userId, readOnly],
  )

  const deleteTemplate = useCallback(
    (id: string) => {
      setTemplates((prev) => prev.filter((t) => t.id !== id))
      if (client && userId && !readOnly) {
        void deleteTemplateRemote(client, id)
      }
    },
    [client, userId, readOnly],
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
      const pBefore = projectsRef.current.find((x) => x.slug === projectSlug)
      const projTitle = pBefore?.title ?? projectSlug
      const stageName = data.name.trim() || 'Этап'
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
      if (client && userId && !readOnly) {
        void invokeTelegramCreateNotify(
          client,
          `📌 Новый этап: «${stageName}» · проект «${projTitle}»`,
        )
      }
    },
    [client, userId, readOnly, schedulePersistProject],
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
      addProjectFromTemplate,
      updateProject,
      addProjectStage,
      updateProjectStage,
      removeProjectStage,
      getProjectBySlug,
      setProjectArchived,
      saveProjectAsTemplate,
      duplicateProject,
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
      mergePortfolioData,
      syncPortfolioToRemote,
      clients,
      getClientById,
      addClient,
      updateClient,
      deleteClient,
      tasks,
      addTask,
      updateTask,
      toggleTaskDone,
      deleteTask,
      templates,
      deleteTemplate,
    }),
    [
      projects,
      financeTransactions,
      addFinanceTransaction,
      calendarCustomEvents,
      addCalendarCustomEvent,
      addProject,
      addProjectFromTemplate,
      updateProject,
      addProjectStage,
      updateProjectStage,
      removeProjectStage,
      getProjectBySlug,
      setProjectArchived,
      saveProjectAsTemplate,
      duplicateProject,
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
      mergePortfolioData,
      syncPortfolioToRemote,
      clients,
      getClientById,
      addClient,
      updateClient,
      deleteClient,
      tasks,
      addTask,
      updateTask,
      toggleTaskDone,
      deleteTask,
      templates,
      deleteTemplate,
    ],
  )

  return (
    <ProjectsContext.Provider value={value}>{children}</ProjectsContext.Provider>
  )
}
