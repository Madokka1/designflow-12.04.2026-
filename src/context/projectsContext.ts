import { createContext } from 'react'
import type { CreateProjectForm } from '../types/projectForm'
import type { CreateStageForm } from '../types/stageForm'
import type { CalendarCustomEvent } from '../types/calendarCustomEvent'
import type { FinanceTransaction } from '../types/financeTransaction'
import type { Project, ProjectStage } from '../types/project'
import type { ProjectTemplate } from '../types/projectTemplate'
import type { TimerSessionLogEntry } from '../types/timerSessionLog'
import type { WorkspaceClient } from '../types/workspaceClient'
import type { WorkspaceTask } from '../types/workspaceTask'
import type { PortfolioBundle } from '../lib/portfolioSupabase'

export type RunningStageTimer = {
  projectSlug: string
  stageId: string
  /** Начало текущего отрезка отсчёта (после старта или снятия с паузы) */
  segmentStartedAt: number
  /** Секунды сеанса до текущего отрезка (включая завершённые отрезки до пауз) */
  accumulatedSessionSeconds: number
  isPaused: boolean
}

export type ProjectsContextValue = {
  projects: Project[]
  financeTransactions: FinanceTransaction[]
  addFinanceTransaction: (
    data: Omit<FinanceTransaction, 'id'>,
  ) => void
  calendarCustomEvents: CalendarCustomEvent[]
  addCalendarCustomEvent: (
    data: Omit<CalendarCustomEvent, 'id'>,
  ) => void
  addProject: (
    data: CreateProjectForm,
    options?: { stages?: readonly ProjectStage[] },
  ) => void
  addProjectFromTemplate: (data: CreateProjectForm, templateId: string) => void
  updateProject: (projectSlug: string, data: CreateProjectForm) => void
  addProjectStage: (projectSlug: string, data: CreateStageForm) => void
  updateProjectStage: (
    projectSlug: string,
    stageId: string,
    data: CreateStageForm,
  ) => void
  removeProjectStage: (projectSlug: string, stageId: string) => void
  /** Поменять этап местами с соседом (порядок в массиве = порядок в UI и в Supabase sort_order). */
  moveProjectStage: (
    projectSlug: string,
    stageId: string,
    direction: 'up' | 'down',
  ) => void
  getProjectBySlug: (slug: string) => Project | undefined
  setProjectArchived: (projectSlug: string, archived: boolean) => void
  saveProjectAsTemplate: (projectSlug: string, templateName: string) => void
  /** Один активный таймер на весь интерфейс; время пишется в этап при смене/стопе */
  runningStageTimer: RunningStageTimer | null
  startStageTimer: (projectSlug: string, stageId: string) => void
  stopStageTimer: () => void
  pauseStageTimer: () => void
  resumeStageTimer: () => void
  toggleStageTimer: (projectSlug: string, stageId: string) => void
  /** Таймер тикает (не на паузе) */
  isStageTimerRunning: (projectSlug: string, stageId: string) => boolean
  /** Сеанс на этапе активен: идёт или на паузе */
  isStageTimerSessionActive: (projectSlug: string, stageId: string) => boolean
  /** Сумма секунд по всем проектам + текущий сеанс (для шапки) */
  headerTimerSeconds: number
  /** Секунды только текущего запущенного сеанса таймера (0, если таймер выключен) */
  stageTimerSessionSeconds: number
  /** Сумма по этапам проекта + активный сеанс, если он на этом проекте */
  getProjectTrackedSeconds: (projectSlug: string) => number
  toggleStageChecklistItem: (
    projectSlug: string,
    stageId: string,
    itemId: string,
  ) => void
  /** Журнал завершённых сегментов таймера (localStorage) */
  timerSessionLog: TimerSessionLogEntry[]
  clearTimerSessionLog: () => void
  /** Заменить проекты / финансы / календарь (импорт JSON и т.п.) */
  replacePortfolioData: (payload: PortfolioBundle) => void
  /** Слияние с текущими данными по slug/id (импорт JSON). */
  mergePortfolioData: (payload: PortfolioBundle) => void
  /** Копия проекта с новым slug и новыми id этапов; сброс учёта времени на этапах. */
  duplicateProject: (projectSlug: string) => string | null
  /** Полное удаление проекта из состояния и Supabase (этапы, задачи по slug, записи таймера). */
  deleteProject: (projectSlug: string) => Promise<Error | null>
  /** Отправить текущее состояние портфеля в Supabase */
  syncPortfolioToRemote: () => Promise<void>

  clients: WorkspaceClient[]
  getClientById: (id: string) => WorkspaceClient | undefined
  addClient: (data: Omit<WorkspaceClient, 'id'>) => WorkspaceClient
  updateClient: (id: string, patch: Partial<Omit<WorkspaceClient, 'id'>>) => void
  deleteClient: (id: string) => void

  tasks: WorkspaceTask[]
  addTask: (
    partial: Omit<WorkspaceTask, 'id' | 'sortOrder'> & { sortOrder?: number },
  ) => WorkspaceTask
  updateTask: (id: string, patch: Partial<Omit<WorkspaceTask, 'id'>>) => void
  toggleTaskDone: (id: string) => void
  deleteTask: (id: string) => void

  templates: ProjectTemplate[]
  deleteTemplate: (id: string) => void
}

export const ProjectsContext = createContext<ProjectsContextValue | null>(null)
