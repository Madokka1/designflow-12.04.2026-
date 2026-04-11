import { createContext } from 'react'
import type { CreateProjectForm } from '../types/projectForm'
import type { CreateStageForm } from '../types/stageForm'
import type { CalendarCustomEvent } from '../types/calendarCustomEvent'
import type { FinanceTransaction } from '../types/financeTransaction'
import type { Project } from '../types/project'
import type { TimerSessionLogEntry } from '../types/timerSessionLog'
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
  addProject: (data: CreateProjectForm) => void
  updateProject: (projectSlug: string, data: CreateProjectForm) => void
  addProjectStage: (projectSlug: string, data: CreateStageForm) => void
  updateProjectStage: (
    projectSlug: string,
    stageId: string,
    data: CreateStageForm,
  ) => void
  removeProjectStage: (projectSlug: string, stageId: string) => void
  getProjectBySlug: (slug: string) => Project | undefined
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
  /** Отправить текущее состояние портфеля в Supabase */
  syncPortfolioToRemote: () => Promise<void>
}

export const ProjectsContext = createContext<ProjectsContextValue | null>(null)
