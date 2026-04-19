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
import { buildActualFromStageForm } from '../lib/stageToForm'
import {
  normalizeDeadlineStored,
  normalizeTaskDueRaw,
} from '../lib/parseRuDate'
import { uniqueSlug } from '../lib/slug'
import { useAuth } from '../hooks/useAuth'
import { useNotesContext } from '../hooks/useNotesContext'
import { useSettings } from '../hooks/useSettings'
import { useRemoteSync } from './remoteSyncContext'
import {
  clearTimerSessionLog as clearTimerSessionsStorage,
  getTimerSessionLog,
  appendTimerSessionLog,
  replaceTimerSessionLog,
} from '../lib/timerSessionsStorage'
import { cloneStagesWithNewIds } from '../lib/cloneStages'
import { projectProgressPercentFromStages } from '../lib/projectProgressFromStages'
import {
  sumStageCostsRub,
  syncStagedProjectAmount,
} from '../lib/stageCostSum'
import { mergeProjectsBySlug, mergeRecordsById } from '../lib/portfolioMerge'
import { normalizeWorkspaceTask } from '../lib/workspaceTaskNormalize'
import {
  deleteClientRemote,
  deleteProjectFromSupabase,
  deleteTasksForProjectSlugRemote,
  deleteCalendarEventRemote,
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
  deleteTimerLogForProjectSlugRemote,
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

/** Сумма по этапам (поэтапная оплата) + прогресс по завершённым этапам. */
function refreshProjectDerived(p: Project): Project {
  const s = syncStagedProjectAmount(p)
  return { ...s, progress: projectProgressPercentFromStages(s.stages) }
}

function mapSyncStagedProjects(projects: readonly Project[]): Project[] {
  return projects.map(refreshProjectDerived)
}

function formToProject(
  data: CreateProjectForm,
  id: string,
  slug: string,
  stagesFromTemplate?: readonly ProjectStage[],
): Project {
  const title = data.title.trim() || 'Название проекта'
  const client = data.client.trim() || 'Клиент'
  const stages = stagesFromTemplate?.length
    ? cloneStagesWithNewIds(stagesFromTemplate)
    : cloneStagesWithNewIds(DEFAULT_PROJECT_STAGES)
  const deadline = normalizeDeadlineStored(data.deadline)
  const tags = [
    data.projectStatus,
    data.paymentStatus,
    data.section,
  ] as const
  const cid = data.clientId.trim()
  const rateRub = parseAmountRub(data.hourlyRate)
  const stagedCostCtx = {
    tags: [...tags],
    employeeHourlyRateRub: rateRub > 0 ? rateRub : undefined,
  }
  const rub =
    data.paymentStatus === 'поэтапная оплата'
      ? sumStageCostsRub(stages, stagedCostCtx)
      : parseAmountRub(data.cost)
  const amount = formatRubDots(rub)
  return {
    id,
    slug,
    title,
    client,
    amount,
    deadline,
    progress: projectProgressPercentFromStages(stages),
    tags,
    stages,
    comment: data.comment.trim() || undefined,
    archived: false,
    clientId: cid ? cid : null,
    employeeHourlyRateRub: rateRub > 0 ? rateRub : undefined,
  }
}

function applyProjectForm(p: Project, data: CreateProjectForm): Project {
  const title = data.title.trim() || 'Название проекта'
  const client = data.client.trim() || 'Клиент'
  const deadline = normalizeDeadlineStored(data.deadline)
  const tags = [
    data.projectStatus,
    data.paymentStatus,
    data.section,
  ] as const
  const cid = data.clientId.trim()
  const rateRub = parseAmountRub(data.hourlyRate)
  const stagedCostCtx = {
    tags: [...tags],
    employeeHourlyRateRub: rateRub > 0 ? rateRub : undefined,
  }
  const rub =
    data.paymentStatus === 'поэтапная оплата'
      ? sumStageCostsRub(p.stages, stagedCostCtx)
      : parseAmountRub(data.cost)
  const amount = formatRubDots(rub)
  return {
    ...p,
    title,
    client,
    amount,
    deadline,
    progress: projectProgressPercentFromStages(p.stages),
    tags: [...tags],
    comment: data.comment.trim() || undefined,
    clientId: cid ? cid : null,
    employeeHourlyRateRub: rateRub > 0 ? rateRub : undefined,
  }
}

function applyStageForm(data: CreateStageForm, previous: ProjectStage): ProjectStage {
  const next = formToStage(data, previous.id)
  return {
    ...next,
    addedAt: previous.addedAt,
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
  const { actual, timeSpentSeconds } = buildActualFromStageForm(data)
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
    deadline: normalizeDeadlineStored(data.deadline),
    planned,
    actual,
    actualInPill: false,
    description: comment || undefined,
    modalTags: [data.paymentStatus],
    checklist,
    timeSpentSeconds,
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
  const { detachProjectFromNotes } = useNotesContext()
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
      void upsertProjectToSupabase(client, userId, p).then((res) => {
        if (res.remappedProject) {
          setProjects((prev) =>
            prev.map((x) => (x.slug === slug ? res.remappedProject! : x)),
          )
        }
        reportSaveError(res.error)
      })
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
    setProjects(mapSyncStagedProjects(payload.projects))
    setFinanceTransactions(payload.financeTransactions)
    setCalendarCustomEvents(payload.calendarCustomEvents)
    setClients(payload.clients ?? [])
    setTasks((payload.tasks ?? []).map((t) => normalizeWorkspaceTask(t)))
    setTemplates(payload.templates ?? [])
  }, [])

  const mergePortfolioData = useCallback((payload: PortfolioBundle) => {
    setProjects((prev) =>
      mapSyncStagedProjects(mergeProjectsBySlug(prev, payload.projects)),
    )
    setFinanceTransactions((prev) =>
      mergeRecordsById(prev, payload.financeTransactions),
    )
    setCalendarCustomEvents((prev) =>
      mergeRecordsById(prev, payload.calendarCustomEvents),
    )
    setClients((prev) => mergeRecordsById(prev, payload.clients ?? []))
    setTasks((prev) =>
      mergeRecordsById(prev, payload.tasks ?? []).map((t) =>
        normalizeWorkspaceTask(t),
      ),
    )
    setTemplates((prev) => mergeRecordsById(prev, payload.templates ?? []))
  }, [])

  const syncPortfolioToRemote = useCallback(async () => {
    if (!client || !userId || readOnly) return
    setPortfolioSync({ kind: 'saving' })
    try {
      for (const p of projectsRef.current) {
        const res = await upsertProjectToSupabase(client, userId, p)
        if (res.error) throw res.error
        if (res.remappedProject) {
          setProjects((prev) =>
            prev.map((x) =>
              x.slug === res.remappedProject!.slug ? res.remappedProject! : x,
            ),
          )
        }
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
        setProjects(mapSyncStagedProjects(bundle.projects))
        setFinanceTransactions(bundle.financeTransactions)
        setCalendarCustomEvents(bundle.calendarCustomEvents)
        setClients(bundle.clients ?? [])
        setTasks((bundle.tasks ?? []).map((t) => normalizeWorkspaceTask(t)))
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
          const desc = st.description?.trim()
          base[idx] = {
            ...st,
            timeSpentSeconds: nextSec,
            actual: desc
              ? `фактическое время: ${formatDurationRu(nextSec)} · ${desc}`
              : `фактическое время: ${formatDurationRu(nextSec)}`,
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
    return sessionElapsed
  }, [sessionElapsed])

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
      const row: FinanceTransaction = {
        ...data,
        id,
        createdAt: data.createdAt ?? new Date().toISOString(),
      }
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
        const newP = formToProject(data, id, slug, options?.stages)
        if (client && userId && !readOnly) {
          setPortfolioSync({ kind: 'saving' })
          void upsertProjectToSupabase(client, userId, newP).then((res) => {
            if (res.remappedProject) {
              setProjects((prev) =>
                prev.map((x) =>
                  x.slug === newP.slug ? res.remappedProject! : x,
                ),
              )
            }
            reportSaveError(res.error)
            if (!res.error) {
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
      const newP = refreshProjectDerived({
        ...p,
        id,
        slug,
        title,
        stages,
        archived: false,
      })
      setProjects((list) => [newP, ...list])
      if (client && userId && !readOnly) {
        setPortfolioSync({ kind: 'saving' })
        void upsertProjectToSupabase(client, userId, newP).then((res) => {
          if (res.remappedProject) {
            setProjects((prev) =>
              prev.map((x) =>
                x.slug === newP.slug ? res.remappedProject! : x,
              ),
            )
          }
          reportSaveError(res.error)
        })
      }
      return slug
    },
    [client, userId, readOnly, reportSaveError, setPortfolioSync],
  )

  const deleteProject = useCallback(
    async (projectSlug: string): Promise<Error | null> => {
      const p = projectsRef.current.find((x) => x.slug === projectSlug)
      if (!p) return new Error('Проект не найден')
      if (readOnly) {
        return new Error('Режим только чтения: удаление отключено')
      }
      const tid = persistProjectTimers.current.get(projectSlug)
      if (tid != null) {
        window.clearTimeout(tid)
        persistProjectTimers.current.delete(projectSlug)
      }
      const r = runningRef.current
      if (r?.projectSlug === projectSlug) {
        runningRef.current = null
        setSessionElapsed(0)
        setRunningStageTimer(null)
      }

      const applyLocalCleanup = () => {
        detachProjectFromNotes(projectSlug)
        const nextLog = getTimerSessionLog().filter(
          (e) => e.projectSlug !== projectSlug,
        )
        replaceTimerSessionLog(nextLog)
        setTimerSessionLog(nextLog)
        setTasks((prev) => prev.filter((t) => t.projectSlug !== projectSlug))
        setProjects((prev) => prev.filter((x) => x.slug !== projectSlug))
      }

      if (!client || !userId) {
        applyLocalCleanup()
        touchSaved()
        return null
      }

      setPortfolioSync({ kind: 'saving' })
      const e1 = await deleteTasksForProjectSlugRemote(
        client,
        userId,
        projectSlug,
      )
      if (e1) {
        reportSaveError(e1)
        return e1
      }
      const e2 = await deleteTimerLogForProjectSlugRemote(
        client,
        userId,
        projectSlug,
      )
      if (e2) {
        reportSaveError(e2)
        return e2
      }
      const e3 = await deleteProjectFromSupabase(client, p.id)
      if (e3) {
        reportSaveError(e3)
        return e3
      }
      applyLocalCleanup()
      reportSaveError(null)
      return null
    },
    [
      client,
      userId,
      readOnly,
      detachProjectFromNotes,
      reportSaveError,
      setPortfolioSync,
      touchSaved,
    ],
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
      const row = normalizeWorkspaceTask({
        id,
        title: partial.title.trim() || 'Задача',
        done: partial.done ?? false,
        dueDate: normalizeTaskDueRaw(partial.dueDate ?? ''),
        projectSlug: partial.projectSlug ?? null,
        labels: partial.labels ?? [],
        sortOrder,
        comment: partial.comment ?? '',
        reminderPreset: partial.reminderPreset ?? 'none',
        reminderAtCustom: partial.reminderAtCustom ?? '',
      })
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

  const addCalendarCustomEvent = useCallback(
    (data: Omit<CalendarCustomEvent, 'id' | 'taskId'>) => {
      const calId =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `cal-${Date.now()}`
      const taskRow = addTask({
        title: data.title.trim() || 'Событие',
        done: false,
        dueDate: data.dateRaw.trim(),
        comment: data.comment?.trim() ?? '',
        projectSlug: null,
        labels: ['календарь'],
        reminderPreset: 'none',
        reminderAtCustom: '',
      })
      const row: CalendarCustomEvent = {
        ...data,
        id: calId,
        taskId: taskRow.id,
      }
      setCalendarCustomEvents((prev) => [...prev, row])
      if (client && userId && !readOnly) {
        setPortfolioSync({ kind: 'saving' })
        void upsertCalendarEventRemote(client, userId, row).then((e) =>
          reportSaveError(e),
        )
      }
    },
    [addTask, client, userId, readOnly, reportSaveError, setPortfolioSync],
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
      setCalendarCustomEvents((prev) => {
        const linked = prev.filter((c) => c.taskId === id)
        if (linked.length && client && userId && !readOnly) {
          for (const c of linked) {
            void deleteCalendarEventRemote(client, c.id).then((e) =>
              reportSaveError(e),
            )
          }
        }
        return prev.filter((c) => c.taskId !== id)
      })
      setTasks((prev) => prev.filter((t) => t.id !== id))
      if (client && userId && !readOnly) {
        void deleteTaskRemote(client, id)
      }
    },
    [client, userId, readOnly, reportSaveError],
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
          return refreshProjectDerived({
            ...p,
            stages: [
              {
                ...formToStage(data, id),
                addedAt: new Date().toISOString(),
              },
              ...base,
            ],
          })
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

  const moveProjectStage = useCallback(
    (projectSlug: string, stageId: string, direction: 'up' | 'down') => {
      setProjects((prev) =>
        prev.map((p) => {
          if (p.slug !== projectSlug) return p
          const base = [...(p.stages ?? DEFAULT_PROJECT_STAGES)]
          const idx = base.findIndex((s) => s.id === stageId)
          if (idx === -1) return p
          const j = direction === 'up' ? idx - 1 : idx + 1
          if (j < 0 || j >= base.length) return p
          const a = base[idx]
          const b = base[j]
          if (!a || !b) return p
          base[idx] = b
          base[j] = a
          return refreshProjectDerived({ ...p, stages: base })
        }),
      )
      schedulePersistProject(projectSlug)
    },
    [schedulePersistProject],
  )

  const reorderProjectStages = useCallback(
    (projectSlug: string, nextStages: readonly ProjectStage[]) => {
      setProjects((prev) =>
        prev.map((p) => {
          if (p.slug !== projectSlug) return p
          const prevStages = [...(p.stages ?? DEFAULT_PROJECT_STAGES)]
          if (nextStages.length !== prevStages.length) return p
          const prevIds = new Set(prevStages.map((s) => s.id))
          for (const s of nextStages) {
            if (!prevIds.has(s.id)) return p
          }
          return refreshProjectDerived({ ...p, stages: [...nextStages] })
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
          return refreshProjectDerived({ ...p, stages: base })
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
          return refreshProjectDerived({
            ...p,
            stages: base.filter((s) => s.id !== stageId),
          })
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
      moveProjectStage,
      reorderProjectStages,
      getProjectBySlug,
      setProjectArchived,
      saveProjectAsTemplate,
      duplicateProject,
      deleteProject,
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
      moveProjectStage,
      reorderProjectStages,
      getProjectBySlug,
      setProjectArchived,
      saveProjectAsTemplate,
      duplicateProject,
      deleteProject,
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
