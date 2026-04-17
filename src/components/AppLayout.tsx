import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { DesignFlowLogo } from './DesignFlowLogo'
import { CommandPalette } from './CommandPalette'
import { DeadlineNotificationScheduler } from './DeadlineNotificationScheduler'
import { OfflineBanner } from './OfflineBanner'
import { SessionIdleWatcher } from './SessionIdleWatcher'
import { TimerPickModal } from './TimerPickModal'
import { TimerTrackerWidget } from './TimerTrackerWidget'
import { useRemoteSync } from '../context/remoteSyncContext'
import { useProjects } from '../hooks/useProjects'
import { useSettings } from '../hooks/useSettings'
import {
  NAV_MENU_GROUPS,
  navActive,
  navEntry,
  normalizeHeaderQuickNavLabels,
} from '../lib/appNav'
import { formatDurationRu } from '../lib/formatDurationRu'

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

function BurgerIcon({ open, light }: { open: boolean; light?: boolean }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 22 22"
      fill="none"
      aria-hidden
      className={`transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
        light ? 'text-white' : 'text-ink'
      }`}
    >
      {open ? (
        <path
          d="M5 5l12 12M17 5L5 17"
          stroke="currentColor"
          strokeWidth="1.35"
          strokeLinecap="round"
        />
      ) : (
        <>
          <path
            d="M4 8h14"
            stroke="currentColor"
            strokeWidth="1.35"
            strokeLinecap="round"
          />
          <path
            d="M4 14h14"
            stroke="currentColor"
            strokeWidth="1.35"
            strokeLinecap="round"
          />
        </>
      )}
    </svg>
  )
}

function HeaderBarGrid({ patternId }: { patternId: string }) {
  return (
    <div
      className="pointer-events-none absolute inset-0 opacity-[0.14] dark:opacity-[0.12]"
      aria-hidden
    >
      <svg className="h-full w-full" preserveAspectRatio="none">
        <defs>
          <pattern
            id={patternId}
            width="32"
            height="32"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M32 0H0"
              stroke="currentColor"
              strokeWidth="0.5"
              className="text-ink"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${patternId})`} />
      </svg>
    </div>
  )
}

export function AppLayout() {
  const location = useLocation()
  const navMenuId = useId()
  const headerGridPatternId = useId().replace(/:/g, '')
  const {
    headerTimerSeconds,
    projects,
    runningStageTimer,
    startStageTimer,
    stopStageTimer,
  } = useProjects()
  const { settings } = useSettings()
  const { portfolio, setPortfolioSync } = useRemoteSync()

  const headerQuickNavLabels = useMemo(
    () => normalizeHeaderQuickNavLabels(settings.headerQuickNavLabels),
    [settings.headerQuickNavLabels],
  )
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

  const isNoteEditorRoute =
    location.pathname.startsWith('/notes/') && location.pathname !== '/notes'

  return (
    <div
      className={`relative w-full overflow-x-hidden bg-surface text-ink ${
        isNoteEditorRoute ? 'flex h-dvh flex-col overflow-hidden' : 'min-h-svh'
      }`}
    >
      <HeaderPattern />

      <header className="relative z-50 border-b border-ink/10 bg-surface">
        <HeaderBarGrid patternId={headerGridPatternId} />
        <div className="relative mx-auto flex h-[4.25rem] w-full max-w-[1840px] items-center gap-4 px-4 sm:h-[4.5rem] sm:gap-6 sm:px-10">
          <Link
            to="/"
            className="flex shrink-0 items-center text-ink transition-opacity duration-200 hover:opacity-80"
            onClick={() => {
              if (mobileNavOpen) beginCloseMobileNav()
            }}
            aria-label="DesignFlow — на главную"
          >
            <DesignFlowLogo className="h-[1.35rem] w-auto sm:h-6" />
          </Link>
          {headerQuickNavLabels.length > 0 ? (
            <nav
              className="mx-auto hidden min-w-0 max-w-[min(100%,52rem)] flex-1 flex-wrap items-center justify-center gap-x-0.5 gap-y-1 sm:flex md:gap-x-1"
              aria-label="Частые разделы"
            >
              {headerQuickNavLabels.map((label) => {
                const item = navEntry(label)
                const active = navActive(location.pathname, item)
                return (
                  <Link
                    key={label}
                    to={item.to}
                    className={`whitespace-nowrap rounded-sm px-2 py-1 text-sm font-light tracking-[-0.02em] transition-colors md:px-2.5 ${
                      active
                        ? 'text-ink'
                        : 'text-ink/50 hover:text-ink dark:text-ink/45 dark:hover:text-ink'
                    }`}
                    aria-current={active ? 'page' : undefined}
                  >
                    {item.label}
                  </Link>
                )
              })}
            </nav>
          ) : (
            <div className="hidden min-w-0 flex-1 sm:block" aria-hidden />
          )}
          <div className="ml-auto flex shrink-0 items-center gap-5 sm:gap-7">
            <button
              type="button"
              className="rounded-full border border-black bg-black px-4 py-2 text-sm font-light tabular-nums tracking-[-0.04em] text-white transition-[background-color,opacity] duration-200 hover:bg-neutral-900 active:opacity-90"
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
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-ink/15 text-ink transition-[background-color,transform] duration-200 hover:bg-ink/[0.05] active:scale-95 dark:border-white/20 dark:hover:bg-white/[0.06]"
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
              <BurgerIcon open={mobileNavOpen && !mobileNavExiting} />
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
          className={`fixed bottom-5 right-5 z-[70] w-[min(calc(100vw-2.5rem),24rem)] ${
            portfolio.kind === 'error' ? 'text-red-800 dark:text-red-200' : ''
          }`}
          role="status"
          aria-live="polite"
        >
          <p
            className={`rounded-[3px] border px-4 py-2 text-center text-xs font-light shadow-sm ${
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

      <div
        key={location.pathname}
        className={`ui-page-enter ${
          isNoteEditorRoute ? 'min-h-0 flex-1 overflow-hidden' : ''
        }`}
      >
        <Outlet />
      </div>

      {showMobileNavPortal && typeof document !== 'undefined'
        ? createPortal(
            <div
              key={mobileNavPortalKey}
              className={`fixed inset-0 z-[100] flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-black text-white ${
                mobileNavExiting
                  ? 'pointer-events-none opacity-0 translate-y-3 scale-[0.985] motion-reduce:translate-y-0 motion-reduce:scale-100 transition-[opacity,transform] duration-[320ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none'
                  : 'ui-mobile-nav-portal-enter motion-reduce:animate-none motion-reduce:opacity-100 motion-reduce:translate-y-0 motion-reduce:scale-100'
              }`}
              style={{
                paddingTop: 'env(safe-area-inset-top, 0px)',
                paddingBottom: 'env(safe-area-inset-bottom, 0px)',
              }}
              role="dialog"
              aria-modal="true"
              aria-label="Меню навигации"
            >
              <div className="relative flex shrink-0 items-center justify-between gap-4 border-b border-white/10 px-4 py-5 sm:px-10">
                <Link
                  to="/"
                  className="flex shrink-0 items-center text-white transition-opacity duration-200 hover:opacity-80"
                  onClick={() => {
                    if (mobileNavOpen) beginCloseMobileNav()
                  }}
                  aria-label="DesignFlow — на главную"
                >
                  <DesignFlowLogo className="h-[1.35rem] w-auto sm:h-6" />
                </Link>
                <div className="flex items-center gap-4 sm:gap-5">
                  <button
                    type="button"
                    className="rounded-full border border-white/25 bg-black px-4 py-2 text-sm font-light tabular-nums tracking-[-0.04em] text-white transition-[background-color,opacity] duration-200 hover:bg-neutral-900 active:opacity-90"
                    aria-live="polite"
                    title={
                      timerRunning
                        ? 'Сохранить время и закрыть сеанс'
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
                  <button
                    type="button"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/25 text-white transition-[background-color,transform] duration-200 hover:bg-white/10 active:scale-95"
                    aria-label="Закрыть меню"
                    onClick={beginCloseMobileNav}
                  >
                    <BurgerIcon open light />
                  </button>
                </div>
              </div>

              <nav
                id={`${navMenuId}-panel`}
                className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-4 pb-10 pt-8 sm:px-10 sm:pb-14 sm:pt-12"
                aria-label="Разделы приложения"
              >
                <div className="grid flex-1 grid-cols-1 gap-10 sm:grid-cols-2 sm:gap-x-12 sm:gap-y-12 lg:grid-cols-4 lg:gap-x-10 xl:gap-x-14">
                  {NAV_MENU_GROUPS.map((group, gi) => (
                    <div key={group.title} className="flex flex-col gap-0">
                      <p className="mb-4 text-[11px] font-light uppercase tracking-[0.14em] text-white/40">
                        {group.title}
                      </p>
                      <ul className="flex flex-col gap-1">
                        {group.labels.map((label, li) => {
                          const item = navEntry(label)
                          const active = navActive(location.pathname, item)
                          const i =
                            NAV_MENU_GROUPS.slice(0, gi).reduce(
                              (n, g) => n + g.labels.length,
                              0,
                            ) + li
                          return (
                            <li key={label}>
                              <Link
                                to={item.to}
                                className={`ui-mobile-nav-link-anim block py-1.5 text-[15px] font-light tracking-[-0.02em] transition-opacity duration-200 sm:text-base ${
                                  active
                                    ? 'text-white'
                                    : 'text-white/80 hover:text-white'
                                }`}
                                style={{
                                  animationDelay: `${i * 32}ms`,
                                }}
                                aria-current={active ? 'page' : undefined}
                                onClick={beginCloseMobileNav}
                              >
                                {item.label}
                              </Link>
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
              </nav>
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
