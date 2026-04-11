import { useCallback, useEffect, useId, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { CommandPalette } from './CommandPalette'
import { DeadlineNotificationScheduler } from './DeadlineNotificationScheduler'
import { OfflineBanner } from './OfflineBanner'
import { SessionIdleWatcher } from './SessionIdleWatcher'
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
  { label: 'Задачи', to: '/tasks' },
  { label: 'Клиенты', to: '/clients' },
  { label: 'Шаблоны', to: '/templates' },
  { label: 'Финансы', to: '/finance' },
  { label: 'Календарь', to: '/calendar' },
  { label: 'Сроки', to: '/deadlines' },
  { label: 'Отчёты', to: '/reports' },
  { label: 'Заметки', to: '/notes' },
  { label: 'Настройки', to: '/settings' },
] as const

function navActive(pathname: string, item: (typeof NAV)[number]): boolean {
  if (item.label === 'Главная') return pathname === '/'
  if (item.label === 'Финансы') return pathname === '/finance'
  if (item.label === 'Календарь') return pathname === '/calendar'
  if (item.label === 'Задачи') return pathname === '/tasks'
  if (item.label === 'Клиенты') return pathname === '/clients'
  if (item.label === 'Шаблоны') return pathname === '/templates'
  if (item.label === 'Сроки') return pathname === '/deadlines'
  if (item.label === 'Отчёты') return pathname === '/reports'
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

const MOBILE_NAV_CLOSE_MS = 340

function BurgerIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden
      className={`text-ink transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
        open ? 'rotate-90' : 'rotate-0'
      }`}
    >
      {open ? (
        <>
          <path
            d="M4 4l12 12M16 4L4 16"
            stroke="currentColor"
            strokeWidth="1.25"
            strokeLinecap="round"
            className="transition-opacity duration-200"
          />
        </>
      ) : (
        <>
          <path
            d="M3 5h14M3 10h14M3 15h14"
            stroke="currentColor"
            strokeWidth="1.25"
            strokeLinecap="round"
          />
        </>
      )}
    </svg>
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
  const navMenuId = useId()
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
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [mobileNavExiting, setMobileNavExiting] = useState(false)
  const [mobileNavPortalKey, setMobileNavPortalKey] = useState(0)

  const showMobileNavPortal = mobileNavOpen || mobileNavExiting

  const beginCloseMobileNav = useCallback(() => {
    if (!mobileNavOpen || mobileNavExiting) return
    setMobileNavExiting(true)
  }, [mobileNavOpen, mobileNavExiting])

  const timerRunning = runningStageTimer != null

  useEffect(() => {
    queueMicrotask(() => {
      setMobileNavOpen(false)
      setMobileNavExiting(false)
    })
  }, [location.pathname])

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 961px)')
    const close = () => {
      if (mq.matches) {
        setMobileNavOpen(false)
        setMobileNavExiting(false)
      }
    }
    mq.addEventListener('change', close)
    return () => mq.removeEventListener('change', close)
  }, [])

  useEffect(() => {
    if (!mobileNavExiting) return
    const t = window.setTimeout(() => {
      setMobileNavOpen(false)
      setMobileNavExiting(false)
    }, MOBILE_NAV_CLOSE_MS)
    return () => window.clearTimeout(t)
  }, [mobileNavExiting])

  useEffect(() => {
    if (!showMobileNavPortal) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') beginCloseMobileNav()
    }
    window.addEventListener('keydown', onKey)

    const html = document.documentElement
    const body = document.body
    const prevHtmlOverflow = html.style.overflow
    const prevBodyOverflow = body.style.overflow
    const prevHtmlOverscroll = html.style.overscrollBehavior
    html.style.overflow = 'hidden'
    body.style.overflow = 'hidden'
    html.style.overscrollBehavior = 'none'

    return () => {
      window.removeEventListener('keydown', onKey)
      html.style.overflow = prevHtmlOverflow
      body.style.overflow = prevBodyOverflow
      html.style.overscrollBehavior = prevHtmlOverscroll
    }
  }, [showMobileNavPortal, beginCloseMobileNav])

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

      <header className="relative z-50 flex justify-center px-4 pt-5 sm:px-10">
        <div className="flex w-full max-w-[1840px] justify-center">
          <div className="relative flex w-full min-[961px]:max-w-max min-[961px]:flex-wrap items-center gap-2 rounded-full border border-[rgba(255,255,255,0.05)] bg-[rgba(0,0,0,0.05)] px-2.5 py-2 pl-4 backdrop-blur-[20px] max-[960px]:max-w-full max-[960px]:justify-between sm:gap-2.5 sm:pl-5">
            <Link
              to="/"
              className="flex items-center gap-2.5 transition-opacity duration-200 hover:opacity-85"
              onClick={() => {
                if (mobileNavOpen) beginCloseMobileNav()
              }}
            >
              <LogoMark />
              <div
                className="hidden h-full min-h-[1rem] w-px self-stretch bg-[rgba(255,255,255,0.1)] min-[961px]:block"
                aria-hidden
              />
            </Link>
            <nav
              className="hidden min-[961px]:flex min-[961px]:flex-wrap min-[961px]:items-center min-[961px]:gap-0 min-[961px]:pl-0"
              aria-label="Основное меню"
            >
              {NAV.map((item) => {
                const active = navActive(location.pathname, item)
                return (
                  <Link
                    key={item.label}
                    to={item.to}
                    className={`rounded-md px-1.5 py-1 text-center text-sm font-light tracking-[-0.02em] transition-colors duration-200 min-[961px]:px-2 ${
                      active ? 'text-ink' : 'text-ink/80 hover:text-ink'
                    }`}
                    aria-current={active ? 'page' : undefined}
                  >
                    {item.label}
                  </Link>
                )
              })}
            </nav>
            <button
              type="button"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[rgba(10,10,10,0.12)] text-ink transition-[transform,background-color,box-shadow] duration-200 ease-out hover:bg-ink/[0.06] active:scale-95 min-[961px]:hidden dark:border-white/15"
              aria-expanded={mobileNavOpen && !mobileNavExiting}
              aria-controls={`${navMenuId}-panel`}
              aria-label={mobileNavOpen ? 'Закрыть меню' : 'Открыть меню'}
              onClick={() => {
                if (mobileNavOpen && !mobileNavExiting) beginCloseMobileNav()
                else if (!mobileNavOpen) {
                  setMobileNavExiting(false)
                  setMobileNavPortalKey((k) => k + 1)
                  setMobileNavOpen(true)
                }
              }}
            >
              <BurgerIcon open={mobileNavOpen} />
            </button>
            <div
              className="mx-0.5 hidden h-6 w-px shrink-0 bg-[rgba(10,10,10,0.12)] min-[961px]:block"
              aria-hidden
            />
            <button
              type="button"
              className="flex h-8 shrink-0 items-center justify-center rounded-full px-4 text-sm font-light tracking-[-0.05em] transition-[opacity,transform] duration-200 hover:opacity-90 active:scale-[0.98] motion-reduce:active:scale-100 min-[961px]:px-5"
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

      <OfflineBanner />
      <SessionIdleWatcher />
      <DeadlineNotificationScheduler />

      <CommandPalette />

      <div key={location.pathname} className="ui-page-enter">
        <Outlet />
      </div>

      {showMobileNavPortal && typeof document !== 'undefined'
        ? createPortal(
            <div
              key={mobileNavPortalKey}
              className={`fixed inset-0 z-[100] flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden text-ink ${
                mobileNavExiting
                  ? 'pointer-events-none opacity-0 translate-y-3 scale-[0.985] motion-reduce:translate-y-0 motion-reduce:scale-100 transition-[opacity,transform] duration-[320ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none'
                  : 'ui-mobile-nav-portal-enter motion-reduce:animate-none motion-reduce:opacity-100 motion-reduce:translate-y-0 motion-reduce:scale-100'
              }`}
              style={{
                paddingTop: 'env(safe-area-inset-top, 0px)',
                paddingBottom: 'env(safe-area-inset-bottom, 0px)',
                background: `radial-gradient(130% 55% at 50% -15%, color-mix(in srgb, ${settings.accentColor} 22%, transparent), transparent 50%), var(--color-surface)`,
              }}
              role="dialog"
              aria-modal="true"
              aria-label="Меню навигации"
            >
              <div className="relative flex shrink-0 items-center justify-between gap-3 border-b border-card-border/80 bg-surface/75 px-4 py-4 backdrop-blur-md supports-[backdrop-filter]:bg-surface/55 dark:bg-surface/70 dark:supports-[backdrop-filter]:bg-surface/45">
                <Link
                  to="/"
                  className="flex shrink-0 items-center transition-opacity duration-200 hover:opacity-85"
                  onClick={() => {
                    if (mobileNavOpen) beginCloseMobileNav()
                  }}
                >
                  <LogoMark />
                </Link>
                <span className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-sm font-light uppercase tracking-[-0.02em] text-ink/55">
                  Разделы
                </span>
                <button
                  type="button"
                  className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-card-border text-ink transition-[transform,background-color,box-shadow] duration-200 ease-out hover:bg-ink/[0.06] active:scale-95 dark:border-white/15"
                  aria-label="Закрыть меню"
                  onClick={beginCloseMobileNav}
                >
                  <BurgerIcon open />
                </button>
              </div>
              <div className="shrink-0 border-b border-card-border/80 px-4 py-3">
                <p className="mb-2 text-xs font-light uppercase tracking-[-0.02em] text-ink/50">
                  Таймер
                </p>
                <button
                  type="button"
                  className="flex w-full items-center justify-center rounded-xl px-4 py-3.5 text-base font-light tracking-[-0.05em] transition-[opacity,transform] duration-200 hover:opacity-90 active:scale-[0.99] motion-reduce:active:scale-100"
                  style={accentButtonStyle(settings.accentColor)}
                  aria-live="polite"
                  title={
                    timerRunning
                      ? 'Сохранить время и закрыть сеанс (панель скроется)'
                      : 'Выбрать проект и этап для таймера'
                  }
                  onClick={() => {
                    if (timerRunning) {
                      stopStageTimer()
                    } else {
                      setMobileNavExiting(false)
                      setMobileNavOpen(false)
                      setTimerPickKey((n) => n + 1)
                      setTimerPickOpen(true)
                    }
                  }}
                >
                  {formatDurationRu(headerTimerSeconds)}
                </button>
              </div>
              <nav
                id={`${navMenuId}-panel`}
                className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-3 py-3"
              >
                {NAV.map((item, i) => {
                  const active = navActive(location.pathname, item)
                  return (
                    <Link
                      key={item.label}
                      to={item.to}
                      className={`ui-mobile-nav-link-anim mb-1 block rounded-xl border-l-[3px] border-transparent py-4 pl-[13px] pr-4 text-left text-base font-light tracking-[-0.02em] transition-[background-color,color,box-shadow,border-color] duration-200 ease-out last:mb-0 ${
                        active
                          ? 'bg-ink/[0.08] text-ink shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]'
                          : 'text-ink/85 hover:bg-ink/[0.04] hover:text-ink active:scale-[0.99] motion-reduce:active:scale-100'
                      }`}
                      style={{
                        animationDelay: `${i * 42}ms`,
                        ...(active ? { borderLeftColor: settings.accentColor } : {}),
                      }}
                      aria-current={active ? 'page' : undefined}
                      onClick={beginCloseMobileNav}
                    >
                      {item.label}
                    </Link>
                  )
                })}
              </nav>
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
