import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { DEFAULT_PROJECT_STAGES } from '../data/defaultStages'
import { useProjects } from '../hooks/useProjects'
import { formatDurationRu } from '../lib/formatDurationRu'
import { playPomodoroChime } from '../lib/playPomodoroChime'
import type { Project, ProjectStage } from '../types/project'

const POMODORO_SECONDS = 25 * 60

function stagesForProject(p: Project): ProjectStage[] {
  const s = p.stages
  if (s && s.length > 0) return [...s]
  return [...DEFAULT_PROJECT_STAGES]
}

const btn =
  'text-xs font-light tracking-[-0.02em] text-ink/70 underline-offset-[3px] transition-colors hover:text-ink hover:underline'

function formatMmSs(totalSec: number): string {
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function TimerTrackerWidget() {
  const {
    runningStageTimer,
    projects,
    stopStageTimer,
    pauseStageTimer,
    resumeStageTimer,
    stageTimerSessionSeconds,
  } = useProjects()

  const [pomodoroEndsAt, setPomodoroEndsAt] = useState<number | null>(null)
  const [pomodoroLeft, setPomodoroLeft] = useState(0)

  useEffect(() => {
    if (!pomodoroEndsAt) return
    const id = window.setInterval(() => {
      const left = Math.max(
        0,
        Math.ceil((pomodoroEndsAt - Date.now()) / 1000),
      )
      setPomodoroLeft(left)
      if (left <= 0) {
        setPomodoroEndsAt(null)
        setPomodoroLeft(0)
        playPomodoroChime()
      }
    }, 500)
    return () => window.clearInterval(id)
  }, [pomodoroEndsAt])

  if (!runningStageTimer) return null

  const project = projects.find((p) => p.slug === runningStageTimer.projectSlug)
  const stages = project ? stagesForProject(project) : []
  const stage = stages.find((st) => st.id === runningStageTimer.stageId)

  const projectTitle = project?.title ?? runningStageTimer.projectSlug
  const stageTitle = stage?.name ?? 'Этап'
  const isPaused = runningStageTimer.isPaused

  const startPomodoro = () => {
    setPomodoroEndsAt(Date.now() + POMODORO_SECONDS * 1000)
    setPomodoroLeft(POMODORO_SECONDS)
  }

  const cancelPomodoro = () => {
    setPomodoroEndsAt(null)
    setPomodoroLeft(0)
  }

  return (
    <aside
      className="ui-drawer-bottom-enter fixed inset-x-0 bottom-0 z-40 border-t border-[rgba(10,10,10,0.12)] bg-surface pb-[max(0px,env(safe-area-inset-bottom))] dark:border-white/10"
      aria-label="Таймтрекер"
    >
      <div className="mx-auto flex max-w-[1840px] flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2 sm:gap-5 sm:px-10">
        <span
          className={`shrink-0 font-mono text-sm tabular-nums tracking-tight text-ink ${isPaused ? 'opacity-50' : ''}`}
          aria-live="polite"
        >
          {formatDurationRu(stageTimerSessionSeconds)}
        </span>
        {pomodoroEndsAt != null && pomodoroLeft > 0 ? (
          <span
            className="shrink-0 rounded-[3px] border border-card-border px-2 py-0.5 font-mono text-xs tabular-nums text-ink/90"
            title="Помодоро 25 минут"
          >
            {formatMmSs(pomodoroLeft)}
          </span>
        ) : null}
        <Link
          to={`/projects/${runningStageTimer.projectSlug}`}
          className="min-w-0 flex-1 truncate text-left text-xs font-light tracking-[-0.02em] text-ink/50 transition-colors hover:text-ink"
        >
          <span className="text-ink/80">{projectTitle}</span>
          <span className="text-ink/35"> — </span>
          <span>{stageTitle}</span>
        </Link>
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:gap-4">
          {pomodoroEndsAt == null || pomodoroLeft <= 0 ? (
            <button
              type="button"
              className={btn}
              onClick={startPomodoro}
              title="Таймер фокуса 25 минут (не добавляет время к этапу)"
            >
              Помодоро 25′
            </button>
          ) : (
            <button type="button" className={btn} onClick={cancelPomodoro}>
              Сброс помодоро
            </button>
          )}
          {isPaused ? (
            <button type="button" className={btn} onClick={() => resumeStageTimer()}>
              Продолжить
            </button>
          ) : (
            <button type="button" className={btn} onClick={() => pauseStageTimer()}>
              Пауза
            </button>
          )}
          <button type="button" className={btn} onClick={() => stopStageTimer()}>
            Стоп
          </button>
        </div>
      </div>
    </aside>
  )
}
