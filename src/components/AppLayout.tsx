import { useEffect, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { CommandPalette } from './CommandPalette'
import { TimerPickModal } from './TimerPickModal'
import { TimerTrackerWidget } from './TimerTrackerWidget'
import { useRemoteSync } from '../context/remoteSyncContext'
import { useProjects } from '../hooks/useProjects'
import { useSettings } from '../hooks/useSettings'
import { formatDurationRu } from '../lib/formatDurationRu'
import { accentButtonStyle } from '../lib/pickContrastText'

const NAV = [
  { label: 'Главная', to: '/' },
  { label: 'Проекты', to: '/projects' },
  { label: 'Финансы', to: '/finance' },
  { label: 'Календарь', to: '/calendar' },
  { label: 'Заметки', to: '/notes' },
  { label: 'Настройки', to: '/settings' },
] as const

function navActive(pathname: string, item: (typeof NAV)[number]): boolean {
  if (item.label === 'Главная') return pathname === '/'
  if (item.label === 'Финансы') return pathname === '/finance'
  if (item.label === 'Календарь') return pathname === '/calendar'
  if (item.label === 'Заметки') {
    return pathname === '/notes' || pathname.startsWith('/notes/')
  }
  if (item.label === 'Проекты') {
    return pathname === '/projects' || pathname.startsWith('/projects/')
  }
  if (item.label === 'Настройки') return pathname === '/settings'
  return false
}

function HeaderPattern() {
  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-0 h-[min(40vh,420px)] opacity-[0.08]"
      aria-hidden
    >
      <svg
        className="h-full w-full"
        viewBox="0 0 1920 400"
        preserveAspectRatio="xMidYMin slice"
        fill="none"
      >
        <defs>
          <pattern
            id="layout-grid"
            width="48"
            height="48"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M48 0H0V48"
              stroke="currentColor"
              strokeWidth="0.5"
              className="text-ink"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#layout-grid)" />
      </svg>
    </div>
  )
}

function LogoMark() {
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink/5">
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
        <rect x="2" y="2" width="6" height="6" rx="1" className="fill-ink" />
        <rect x="10" y="2" width="6" height="6" rx="1" className="fill-ink/40" />
        <rect x="2" y="10" width="6" height="6" rx="1" className="fill-ink/40" />
        <rect x="10" y="10" width="6" height="6" rx="1" className="fill-ink" />
      </svg>
    </div>
  )
}

export function AppLayout() {
  const location = useLocation()
  const {
    headerTimerSeconds,
    projects,
    runningStageTimer,
    startStageTimer,
    stopStageTimer,
  } = useProjects()
  const { settings } = useSettings()
  const { portfolio, setPortfolioSync } = useRemoteSync()
  const [timerPickOpen, setTimerPickOpen] = useState(false)
  const [timerPickKey, setTimerPickKey] = useState(0)

  const timerRunning = runningStageTimer != null

  useEffect(() => {
    if (portfolio.kind !== 'saved') return
    const id = window.setTimeout(() => setPortfolioSync({ kind: 'idle' }), 2200)
    return () => clearTimeout(id)
  }, [portfolio, setPortfolioSync])

  const syncLabel =
    portfolio.kind === 'loading'
      ? 'Загрузка данных…'
      : portfolio.kind === 'saving'
        ? 'Сохранение в Supabase…'
        : portfolio.kind === 'saved'
          ? 'Сохранено в Supabase'
          : portfolio.kind === 'error'
            ? portfolio.message
            : null

  return (
    <div className="relative min-h-svh w-full overflow-x-hidden bg-surface text-ink">
      <HeaderPattern />

      <header className="relative z-10 flex justify-center px-4 pt-5 sm:px-10">
        <div className="flex w-full max-w-[1840px] justify-center">
          <div className="flex w-full max-w-max flex-wrap items-center gap-2 rounded-full border border-[rgba(255,255,255,0.05)] bg-[rgba(0,0,0,0.05)] px-2.5 py-2 pl-4 backdrop-blur-[20px] sm:gap-2.5 sm:pl-5">
            <Link to="/" className="flex items-center gap-2.5">
              <LogoMark />
              <div
                className="hidden h-full min-h-[1rem] w-px self-stretch bg-[rgba(255,255,255,0.1)] sm:block"
                aria-hidden
              />
            </Link>
            <nav className="flex flex-wrap items-center gap-1 sm:gap-0 sm:pl-0">
              {NAV.map((item) => {
                const active = navActive(location.pathname, item)
                return (
                  <Link
                    key={item.label}
                    to={item.to}
                    className={`rounded-md px-1.5 py-1 text-center text-sm font-light tracking-[-0.02em] transition-colors duration-200 sm:px-2 ${
                      active ? 'text-ink' : 'text-ink/80 hover:text-ink'
                    }`}
                    aria-current={active ? 'page' : undefined}
                  >
                    {item.label}
                  </Link>
                )
              })}
            </nav>
            <div
              className="mx-0.5 hidden h-6 w-px shrink-0 bg-[rgba(10,10,10,0.12)] sm:block"
              aria-hidden
            />
            <button
              type="button"
              className="flex h-8 shrink-0 items-center justify-center rounded-full px-4 text-sm font-light tracking-[-0.05em] transition-[opacity,transform] duration-200 hover:opacity-90 active:scale-[0.98] motion-reduce:active:scale-100 sm:px-5"
              style={accentButtonStyle(settings.accentColor)}
              aria-live="polite"
              title={
                timerRunning
                  ? 'Сохранить время и закрыть сеанс (панель скроется)'
                  : 'Выбрать проект и этап для таймера'
              }
              onClick={() => {
                if (timerRunning) stopStageTimer()
                else {
                  setTimerPickKey((n) => n + 1)
                  setTimerPickOpen(true)
                }
              }}
            >
              {formatDurationRu(headerTimerSeconds)}
            </button>
          </div>
        </div>
      </header>

      {settings.readOnlyMode ? (
        <div
          className="relative z-10 mx-auto mt-3 w-full max-w-[1840px] px-4 sm:px-10"
          role="status"
        >
          <p className="border border-amber-700/35 bg-amber-500/10 px-4 py-2 text-center text-xs font-light text-amber-950 dark:border-amber-400/25 dark:bg-amber-400/10 dark:text-amber-100">
            Режим только чтения: изменения не отправляются в Supabase, пароль входа не
            сохраняется в localStorage.
          </p>
        </div>
      ) : null}

      {syncLabel && portfolio.kind !== 'idle' ? (
        <div
          className={`relative z-10 mx-auto mt-3 w-full max-w-[1840px] px-4 sm:px-10 ${
            portfolio.kind === 'error' ? 'text-red-800 dark:text-red-200' : ''
          }`}
          role="status"
          aria-live="polite"
        >
          <p
            className={`border px-4 py-2 text-center text-xs font-light ${
              portfolio.kind === 'error'
                ? 'border-red-700/30 bg-red-500/10'
                : 'border-card-border bg-surface text-ink/70'
            }`}
          >
            {syncLabel}
            {portfolio.kind === 'error' ? (
              <button
                type="button"
                className="ml-3 underline underline-offset-2"
                onClick={() => setPortfolioSync({ kind: 'idle' })}
              >
                Скрыть
              </button>
            ) : null}
          </p>
        </div>
      ) : null}

      <TimerPickModal
        key={timerPickKey}
        open={timerPickOpen}
        onClose={() => setTimerPickOpen(false)}
        projects={projects}
        onStart={(slug, stageId) => startStageTimer(slug, stageId)}
      />

      <TimerTrackerWidget />

      <CommandPalette />

      <div key={location.pathname} className="ui-page-enter">
        <Outlet />
      </div>
    </div>
  )
}
