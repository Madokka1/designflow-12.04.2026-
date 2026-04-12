import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from 'react'
import { useNavigate } from 'react-router-dom'
import {
  buildPortfolioCsvExport,
  downloadUtf8Csv,
} from '../lib/exportPortfolioCsv'
import {
  buildPortfolioJsonBackup,
  parsePortfolioJsonBackup,
  type ParsedPortfolioBackup,
} from '../lib/portfolioJsonBackup'
import { APP_CHANGELOG } from '../data/changelog'
import { upsertNoteToSupabase } from '../lib/notesSupabase'
import { buildTimerSessionsCsv } from '../lib/exportTimerSessionsCsv'
import {
  fetchProfileSettings,
  profileRowToSettingsPatch,
} from '../lib/profileSettingsSupabase'
import { accentButtonStyle } from '../lib/pickContrastText'
import {
  HEADER_QUICK_NAV_CANDIDATES,
  HEADER_QUICK_NAV_MAX,
} from '../lib/appNav'
import {
  PORTFOLIO_SCHEMA_SQL,
  SUPABASE_SQL_INSTRUCTION,
} from '../lib/portfolioSchemaSql'
import { useAuth } from '../hooks/useAuth'
import { useNotesContext } from '../hooks/useNotesContext'
import { useProjects } from '../hooks/useProjects'
import { useSettings } from '../hooks/useSettings'
import { PageTabButton, PageTabList } from '../components/PageTabs'
import { formInputUnderlineClass } from '../lib/formInputClasses'
import {
  createTelegramLinkToken,
  unlinkTelegramFromProfile,
} from '../lib/telegramLinkSupabase'
import type { SettingsFontId, SettingsThemeId } from '../types/settings'

const BORDER = 'border-card-border'

type SettingsTabId = 'general' | 'security'

const FONT_OPTIONS: { id: SettingsFontId; label: string }[] = [
  { id: 'inter', label: 'Inter' },
  { id: 'georgia', label: 'Georgia' },
  { id: 'jetbrains', label: 'JetBrains Mono' },
  { id: 'system', label: 'Системный' },
]

const THEME_OPTIONS: { id: SettingsThemeId; label: string }[] = [
  { id: 'system', label: 'Как в системе' },
  { id: 'light', label: 'Светлая' },
  { id: 'dark', label: 'Тёмная' },
]

const inputClass = formInputUnderlineClass

const defaultJsonImportSections = {
  profile: true,
  projects: true,
  finance: true,
  calendar: true,
  notes: true,
  clients: true,
  tasks: true,
  templates: true,
} as const

type JsonImportSections = {
  [K in keyof typeof defaultJsonImportSections]: boolean
}

/** Стрелка выпадающего списка: тёмная в светлой теме, светлая в `html.dark`. */
const selectClass = `${formInputUnderlineClass} cursor-pointer appearance-none bg-[length:1rem] bg-[right_0.25rem_center] bg-no-repeat pr-8 bg-[url("data:image/svg+xml,%3Csvg%20xmlns%3D%27http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%27%20width%3D%2712%27%20height%3D%2712%27%20fill%3D%27none%27%20viewBox%3D%270%200%2012%2012%27%3E%3Cpath%20stroke%3D%27%230a0a0a%27%20stroke-linecap%3D%27round%27%20stroke-width%3D%271%27%20d%3D%27m3%204.5%203%203%203-3%27%2F%3E%3C%2Fsvg%3E")] dark:bg-[url("data:image/svg+xml,%3Csvg%20xmlns%3D%27http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%27%20width%3D%2712%27%20height%3D%2712%27%20fill%3D%27none%27%20viewBox%3D%270%200%2012%2012%27%3E%3Cpath%20stroke%3D%27%23fafafa%27%20stroke-linecap%3D%27round%27%20stroke-width%3D%271%27%20d%3D%27m3%204.5%203%203%203-3%27%2F%3E%3C%2Fsvg%3E")]`

function Field({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10px] font-light uppercase tracking-[-0.02em] text-ink/55">
        {label}
      </span>
      {children}
    </div>
  )
}

function SettingsCard({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: ReactNode
  children: ReactNode
}) {
  return (
    <section
      className={`flex flex-col gap-6 border ${BORDER} p-5 sm:p-6`}
    >
      <header className="flex flex-col gap-1">
        <h2 className="text-[10px] font-light uppercase tracking-[-0.02em] text-ink/55">
          {title}
        </h2>
        {subtitle ? (
          <p className="max-w-2xl text-sm font-light leading-snug tracking-[-0.02em] text-ink/70">
            {subtitle}
          </p>
        ) : null}
      </header>
      {children}
    </section>
  )
}

export function SettingsPage() {
  const navigate = useNavigate()
  const { session, signOut, client } = useAuth()
  const { settings, updateSettings } = useSettings()
  const {
    projects,
    financeTransactions,
    calendarCustomEvents,
    clients,
    tasks,
    templates,
    timerSessionLog,
    clearTimerSessionLog,
    replacePortfolioData,
    mergePortfolioData,
    syncPortfolioToRemote,
  } = useProjects()
  const { notes, replaceAllNotes, mergeNotesBySlug } = useNotesContext()
  const jsonImportRef = useRef<HTMLInputElement>(null)
  const [tab, setTab] = useState<SettingsTabId>('general')
  const [copyState, setCopyState] = useState<'idle' | 'ok' | 'err'>('idle')
  const [accentHexDraft, setAccentHexDraft] = useState(settings.accentColor)
  const [pwdNew, setPwdNew] = useState('')
  const [pwdRepeat, setPwdRepeat] = useState('')
  const [pwdFeedback, setPwdFeedback] = useState<
    'idle' | 'ok' | 'mismatch' | 'empty'
  >('idle')
  const [telegramUiHint, setTelegramUiHint] = useState<string | null>(null)
  const [telegramLinkBusy, setTelegramLinkBusy] = useState(false)
  /** Последний выданный код; можно вставить в бота: /link КОД */
  const [telegramPairCode, setTelegramPairCode] = useState<string | null>(null)
  const telegramLinkPollRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (telegramLinkPollRef.current != null) {
        window.clearInterval(telegramLinkPollRef.current)
        telegramLinkPollRef.current = null
      }
    }
  }, [])

  const refreshProfileFromSupabase = useCallback(async () => {
    if (!client || !session?.user?.id) return
    const row = await fetchProfileSettings(client, session.user.id)
    if (row) updateSettings(profileRowToSettingsPatch(row))
  }, [client, session?.user?.id, updateSettings])

  const [jsonImportDraft, setJsonImportDraft] = useState<{
    data: ParsedPortfolioBackup
    warnings: string[]
  } | null>(null)
  const [jsonImportMode, setJsonImportMode] = useState<'replace' | 'merge'>(
    'replace',
  )
  const [jsonImportSections, setJsonImportSections] =
    useState<JsonImportSections>(() => ({ ...defaultJsonImportSections }))

  const [pwaDeferred, setPwaDeferred] = useState<{
    prompt: () => Promise<void>
  } | null>(null)

  useEffect(() => {
    const onBip = (e: Event) => {
      e.preventDefault()
      const ev = e as Event & { prompt?: () => Promise<void> }
      if (typeof ev.prompt === 'function') {
        setPwaDeferred({ prompt: () => ev.prompt!() })
      }
    }
    window.addEventListener('beforeinstallprompt', onBip)
    return () => window.removeEventListener('beforeinstallprompt', onBip)
  }, [])

  const handleExportCsv = useCallback(() => {
    const csv = buildPortfolioCsvExport({
      projects,
      financeTransactions,
      calendarCustomEvents,
      notes,
      settingsProfile: {
        firstName: settings.firstName,
        lastName: settings.lastName,
        email: settings.email,
        telegram: settings.telegram,
        website: settings.website,
        jobTitle: settings.jobTitle,
        about: settings.about,
        fontFamily: settings.fontFamily,
        accentColor: settings.accentColor,
      },
    })
    downloadUtf8Csv(`portfolio-export-${new Date().toISOString().slice(0, 10)}.csv`, csv)
  }, [
    projects,
    financeTransactions,
    calendarCustomEvents,
    notes,
    settings.firstName,
    settings.lastName,
    settings.email,
    settings.telegram,
    settings.website,
    settings.jobTitle,
    settings.about,
    settings.fontFamily,
    settings.accentColor,
  ])

  const handleExportTimerCsv = useCallback(() => {
    const csv = buildTimerSessionsCsv(timerSessionLog)
    downloadUtf8Csv(
      `timer-sessions-${new Date().toISOString().slice(0, 10)}.csv`,
      csv,
    )
  }, [timerSessionLog])

  const handleExportJson = useCallback(() => {
    const json = buildPortfolioJsonBackup({
      projects,
      financeTransactions,
      calendarCustomEvents,
      notes,
      clients,
      tasks,
      templates,
      settingsProfile: {
        firstName: settings.firstName,
        lastName: settings.lastName,
        email: settings.email,
        telegram: settings.telegram,
        website: settings.website,
        jobTitle: settings.jobTitle,
        about: settings.about,
        fontFamily: settings.fontFamily,
        accentColor: settings.accentColor,
      },
    })
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `portfolio-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [
    projects,
    financeTransactions,
    calendarCustomEvents,
    notes,
    settings.firstName,
    settings.lastName,
    settings.email,
    settings.telegram,
    settings.website,
    settings.jobTitle,
    settings.about,
    settings.fontFamily,
    settings.accentColor,
    clients,
    tasks,
    templates,
  ])

  const onJsonFileChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      e.target.value = ''
      if (!file) return
      if (settings.readOnlyMode) {
        window.alert('Импорт недоступен в режиме только чтения.')
        return
      }
      const reader = new FileReader()
      reader.onload = () => {
        const text = String(reader.result ?? '')
        const parsed = parsePortfolioJsonBackup(text)
        if (parsed.ok === false) {
          window.alert(parsed.error)
          return
        }
        setJsonImportDraft({
          data: parsed.data,
          warnings: parsed.warnings,
        })
        setJsonImportMode('replace')
        setJsonImportSections({ ...defaultJsonImportSections })
      }
      reader.readAsText(file, 'utf-8')
    },
    [settings.readOnlyMode],
  )

  const commitJsonImport = useCallback(() => {
    if (!jsonImportDraft || settings.readOnlyMode) return
    const { data } = jsonImportDraft
    const sec = jsonImportSections
    const sp = data.settingsProfile

    if (jsonImportMode === 'replace') {
      replacePortfolioData({
        projects: sec.projects ? data.projects : projects,
        financeTransactions: sec.finance
          ? data.financeTransactions
          : financeTransactions,
        calendarCustomEvents: sec.calendar
          ? data.calendarCustomEvents
          : calendarCustomEvents,
        clients: sec.clients ? (data.clients ?? []) : clients,
        tasks: sec.tasks ? (data.tasks ?? []) : tasks,
        templates: sec.templates ? (data.templates ?? []) : templates,
      })
      if (sec.notes) replaceAllNotes(data.notes)
    } else {
      mergePortfolioData({
        projects: sec.projects ? data.projects : [],
        financeTransactions: sec.finance ? data.financeTransactions : [],
        calendarCustomEvents: sec.calendar ? data.calendarCustomEvents : [],
        clients: sec.clients ? (data.clients ?? []) : [],
        tasks: sec.tasks ? (data.tasks ?? []) : [],
        templates: sec.templates ? (data.templates ?? []) : [],
      })
      if (sec.notes) mergeNotesBySlug(data.notes)
    }

    if (sec.profile) {
      updateSettings({
        firstName: sp.firstName,
        lastName: sp.lastName,
        email: sp.email,
        telegram: sp.telegram,
        website: sp.website,
        jobTitle: sp.jobTitle,
        about: sp.about,
        fontFamily: sp.fontFamily as SettingsFontId,
        accentColor: sp.accentColor,
      })
    }

    setJsonImportDraft(null)
    setJsonImportSections({ ...defaultJsonImportSections })

    const uid = session?.user?.id
    void (async () => {
      await syncPortfolioToRemote()
      if (client && uid && sec.notes) {
        for (const n of data.notes) {
          await upsertNoteToSupabase(client, uid, n)
        }
      }
    })()
  }, [
    jsonImportDraft,
    jsonImportMode,
    jsonImportSections,
    settings.readOnlyMode,
    projects,
    financeTransactions,
    calendarCustomEvents,
    clients,
    tasks,
    templates,
    replacePortfolioData,
    mergePortfolioData,
    replaceAllNotes,
    mergeNotesBySlug,
    updateSettings,
    syncPortfolioToRemote,
    client,
    session?.user?.id,
  ])

  const cancelJsonImport = useCallback(() => {
    setJsonImportDraft(null)
    setJsonImportSections({ ...defaultJsonImportSections })
  }, [])

  const copyPrompt = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(PORTFOLIO_SCHEMA_SQL)
      setCopyState('ok')
      window.setTimeout(() => setCopyState('idle'), 2000)
    } catch {
      setCopyState('err')
      window.setTimeout(() => setCopyState('idle'), 2500)
    }
  }, [])

  const applySupabasePassword = useCallback(() => {
    const a = pwdNew.trim()
    const b = pwdRepeat.trim()
    if (!a && !b) {
      setPwdFeedback('empty')
      window.setTimeout(() => setPwdFeedback('idle'), 2000)
      return
    }
    if (a !== b) {
      setPwdFeedback('mismatch')
      return
    }
    updateSettings({ supabaseAuthPassword: a })
    setPwdNew('')
    setPwdRepeat('')
    setPwdFeedback('ok')
    window.setTimeout(() => setPwdFeedback('idle'), 2500)
  }, [pwdNew, pwdRepeat, updateSettings])

  const clearSupabasePassword = useCallback(() => {
    updateSettings({ supabaseAuthPassword: '' })
    setPwdNew('')
    setPwdRepeat('')
    setPwdFeedback('idle')
  }, [updateSettings])

  const hasStoredSupabasePassword = settings.supabaseAuthPassword.length > 0

  const tabs: { id: SettingsTabId; label: string }[] = [
    { id: 'general', label: 'Общее' },
    { id: 'security', label: 'Безопасность' },
  ]

  return (
    <main className="relative z-10 mx-auto w-full max-w-[1840px] px-4 pb-16 pt-8 sm:px-10 sm:pt-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="mt-1 text-[clamp(2rem,5vw,3.5rem)] font-light leading-[0.9] tracking-[-0.09em]">
            {tab === 'security' ? 'Безопасность и Supabase' : 'Профиль и данные'}
          </h1>
        </div>
      </div>

      <PageTabList
        className="mt-8"
        role="tablist"
        aria-label="Разделы настроек"
      >
        {tabs.map((t) => {
          const selected = tab === t.id
          return (
            <PageTabButton
              key={t.id}
              selected={selected}
              id={`settings-tab-${t.id}`}
              aria-controls={`settings-panel-${t.id}`}
              onClick={() => {
                if (t.id !== 'security') setPwdFeedback('idle')
                setTab(t.id)
              }}
            >
              {t.label}
            </PageTabButton>
          )
        })}
      </PageTabList>

      <div className="mt-10 max-w-4xl">
        <div
          id="settings-panel-general"
          role="tabpanel"
          hidden={tab !== 'general'}
          aria-labelledby="settings-tab-general"
          className="grid grid-cols-1 gap-6"
        >
        <SettingsCard
          title="Профиль"
          subtitle="Контакты и кратко о себе. Дублируются в Supabase (profiles) после входа и в localStorage."
        >
          <div className="grid gap-6 sm:grid-cols-2">
            <Field label="Имя">
              <input
                className={inputClass}
                value={settings.firstName}
                onChange={(e) => updateSettings({ firstName: e.target.value })}
                autoComplete="given-name"
              />
            </Field>
            <Field label="Фамилия">
              <input
                className={inputClass}
                value={settings.lastName}
                onChange={(e) => updateSettings({ lastName: e.target.value })}
                autoComplete="family-name"
              />
            </Field>
            <Field label="Почта">
              <input
                className={inputClass}
                type="email"
                inputMode="email"
                value={settings.email}
                onChange={(e) => updateSettings({ email: e.target.value })}
                autoComplete="email"
              />
            </Field>
            <Field label="Telegram">
              <input
                className={inputClass}
                placeholder="@username или ссылка"
                value={settings.telegram}
                onChange={(e) => updateSettings({ telegram: e.target.value })}
              />
            </Field>
            <Field label="Сайт">
              <input
                className={inputClass}
                placeholder="https://"
                value={settings.website}
                onChange={(e) => updateSettings({ website: e.target.value })}
                autoComplete="url"
              />
            </Field>
            <Field label="Должность">
              <input
                className={inputClass}
                value={settings.jobTitle}
                onChange={(e) => updateSettings({ jobTitle: e.target.value })}
              />
            </Field>
          </div>
          <Field label="О себе">
            <textarea
              className={`${inputClass} min-h-[6rem] resize-y border-b`}
              rows={4}
              value={settings.about}
              onChange={(e) => updateSettings({ about: e.target.value })}
            />
          </Field>
        </SettingsCard>

        <SettingsCard
          title="Оформление"
          subtitle="Шрифт, тема и акцент: в Supabase (profiles) и localStorage; применяются ко всему интерфейсу."
        >
          <Field label="Шрифт">
            <select
              className={selectClass}
              value={settings.fontFamily}
              onChange={(e) =>
                updateSettings({ fontFamily: e.target.value as SettingsFontId })
              }
            >
              {FONT_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Тема оформления">
            <select
              className={selectClass}
              value={settings.theme}
              onChange={(e) =>
                updateSettings({ theme: e.target.value as SettingsThemeId })
              }
            >
              {THEME_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Акцентный цвет">
            <div className="flex flex-wrap items-center gap-4">
              <input
                type="color"
                className="h-10 w-14 cursor-pointer border border-[rgba(10,10,10,0.2)] bg-surface p-1"
                value={
                  /^#[0-9A-Fa-f]{6}$/.test(settings.accentColor)
                    ? settings.accentColor
                    : '#0a0a0a'
                }
                onChange={(e) => {
                  const v = e.target.value
                  updateSettings({ accentColor: v })
                  setAccentHexDraft(v)
                }}
                aria-label="Выбор цвета"
              />
              <input
                className={`${inputClass} max-w-[10rem] flex-1`}
                value={accentHexDraft}
                onChange={(e) => setAccentHexDraft(e.target.value)}
                onBlur={() => {
                  const t = accentHexDraft.trim()
                  if (/^#[0-9A-Fa-f]{6}$/.test(t)) {
                    updateSettings({ accentColor: t })
                  } else {
                    setAccentHexDraft(settings.accentColor)
                  }
                }}
                spellCheck={false}
                placeholder="#0a0a0a"
              />
            </div>
          </Field>
        </SettingsCard>

        <SettingsCard
          title="Шапка"
          subtitle="Часто используемые разделы между логотипом и таймером на экранах от ~640px. Остальные пункты — в полном меню справа. Порядок как в списке ниже. Только в этом браузере (не синхронизируется с Supabase)."
        >
          <div className="flex flex-wrap gap-x-6 gap-y-3">
            {HEADER_QUICK_NAV_CANDIDATES.map((label) => {
              const checked = settings.headerQuickNavLabels.includes(label)
              const blockAdd =
                !checked &&
                settings.headerQuickNavLabels.length >= HEADER_QUICK_NAV_MAX
              return (
                <label
                  key={label}
                  className={`flex items-center gap-2 text-sm font-light tracking-[-0.02em] text-ink ${
                    blockAdd ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 shrink-0 rounded-sm border border-ink/30 accent-ink dark:border-white/25"
                    checked={checked}
                    disabled={blockAdd}
                    onChange={(e) => {
                      const on = e.target.checked
                      if (
                        on &&
                        settings.headerQuickNavLabels.length >= HEADER_QUICK_NAV_MAX
                      ) {
                        return
                      }
                      const set = new Set(settings.headerQuickNavLabels)
                      if (on) set.add(label)
                      else set.delete(label)
                      updateSettings({
                        headerQuickNavLabels:
                          HEADER_QUICK_NAV_CANDIDATES.filter((l) => set.has(l)),
                      })
                    }}
                  />
                  {label}
                </label>
              )
            })}
          </div>
          <p className="text-xs font-light text-ink/55">
            В шапке: {settings.headerQuickNavLabels.length} из {HEADER_QUICK_NAV_MAX}{' '}
            ссылок
          </p>
        </SettingsCard>

        <SettingsCard
          title="Журнал таймера"
          subtitle="Завершённые сессии учёта времени по этапам: в Supabase (таблица timer_session_log) и копия в localStorage. Экспорт — из текущего журнала в приложении."
        >
          <p className="text-sm font-light text-ink/60">
            Записей: {timerSessionLog.length}
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="h-9 w-fit rounded-full px-5 text-sm font-light tracking-[-0.05em] transition-opacity hover:opacity-90 disabled:opacity-40"
              style={accentButtonStyle(settings.accentColor)}
              disabled={timerSessionLog.length === 0}
              onClick={handleExportTimerCsv}
            >
              Скачать журнал (CSV)
            </button>
            <button
              type="button"
              className="h-9 w-fit rounded-full border border-[rgba(10,10,10,0.2)] bg-surface px-5 text-sm font-light tracking-[-0.05em] text-ink transition-colors hover:bg-ink/[0.04] disabled:opacity-40 dark:border-white/15"
              disabled={timerSessionLog.length === 0}
              onClick={() => {
                if (
                  timerSessionLog.length === 0 ||
                  !window.confirm('Очистить весь журнал таймера? Это нельзя отменить.')
                ) {
                  return
                }
                clearTimerSessionLog()
              }}
            >
              Очистить журнал
            </button>
          </div>
        </SettingsCard>

        <SettingsCard
          title="Экспорт данных"
          subtitle="Один CSV-файл: профиль (без ключей Supabase и без пароля входа), проекты, этапы, транзакции, события календаря, заметки."
        >
          <button
            type="button"
            className="h-9 w-fit rounded-full px-5 text-sm font-light tracking-[-0.05em] transition-opacity hover:opacity-90"
            style={accentButtonStyle(settings.accentColor)}
            onClick={handleExportCsv}
          >
            Скачать все данные (CSV)
          </button>
        </SettingsCard>

        <SettingsCard
          title="Резервная копия JSON"
          subtitle="В файле нет паролей Supabase и ключа service_role. Полный снимок данных и полей профиля (имя, контакты, шрифт, акцент). Схема v2 включает клиентов, задачи и шаблоны. После выбора файла откроется предпросмотр: режим замены или слияния и выбор разделов."
        >
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="h-9 w-fit rounded-full px-5 text-sm font-light tracking-[-0.05em] transition-opacity hover:opacity-90"
              style={accentButtonStyle(settings.accentColor)}
              onClick={handleExportJson}
            >
              Скачать JSON
            </button>
            <input
              ref={jsonImportRef}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              aria-hidden
              onChange={onJsonFileChange}
            />
            <button
              type="button"
              className="h-9 w-fit rounded-full border border-[rgba(10,10,10,0.2)] bg-surface px-5 text-sm font-light tracking-[-0.05em] text-ink transition-colors hover:bg-ink/[0.04] disabled:opacity-40 dark:border-white/15"
              disabled={settings.readOnlyMode}
              onClick={() => jsonImportRef.current?.click()}
            >
              Импортировать из JSON…
            </button>
          </div>

          {jsonImportDraft ? (
            <div className="flex flex-col gap-4 border border-card-border bg-ink/[0.02] p-4 dark:bg-white/[0.03]">
              <p className="text-sm font-light text-ink">
                <span className="text-ink/55">Схема:</span> v
                {jsonImportDraft.data.schemaVersion}
                {jsonImportDraft.data.exportedAt ? (
                  <>
                    {' '}
                    · <span className="text-ink/55">экспорт:</span>{' '}
                    {jsonImportDraft.data.exportedAt}
                  </>
                ) : null}
              </p>
              <ul className="text-xs font-light text-ink/70">
                <li>Проекты: {jsonImportDraft.data.projects.length}</li>
                <li>Заметки: {jsonImportDraft.data.notes.length}</li>
                <li>Транзакции: {jsonImportDraft.data.financeTransactions.length}</li>
                <li>События календаря: {jsonImportDraft.data.calendarCustomEvents.length}</li>
                <li>Клиенты: {jsonImportDraft.data.clients?.length ?? 0}</li>
                <li>Задачи: {jsonImportDraft.data.tasks?.length ?? 0}</li>
                <li>Шаблоны: {jsonImportDraft.data.templates?.length ?? 0}</li>
              </ul>
              {jsonImportDraft.warnings.length > 0 ? (
                <div>
                  <p className="text-[10px] font-light uppercase text-amber-800 dark:text-amber-200">
                    Предупреждения при разборе
                  </p>
                  <ul className="mt-1 list-inside list-disc text-xs font-light text-ink/75">
                    {jsonImportDraft.warnings.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <div className="flex flex-wrap gap-4 text-sm font-light">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="json-import-mode"
                    checked={jsonImportMode === 'replace'}
                    onChange={() => setJsonImportMode('replace')}
                    className="accent-ink"
                  />
                  Полная замена (по выбранным разделам)
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="json-import-mode"
                    checked={jsonImportMode === 'merge'}
                    onChange={() => setJsonImportMode('merge')}
                    className="accent-ink"
                  />
                  Слияние по slug/id
                </label>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {(
                  Object.keys(defaultJsonImportSections) as (keyof JsonImportSections)[]
                ).map((key) => (
                  <label key={key} className="flex cursor-pointer items-center gap-2 text-xs font-light">
                    <input
                      type="checkbox"
                      className="accent-ink"
                      checked={jsonImportSections[key]}
                      onChange={(e) =>
                        setJsonImportSections((s) => ({
                          ...s,
                          [key]: e.target.checked,
                        }))
                      }
                    />
                    {key === 'profile'
                      ? 'Профиль'
                      : key === 'projects'
                        ? 'Проекты'
                        : key === 'finance'
                          ? 'Финансы'
                          : key === 'calendar'
                            ? 'Календарь'
                            : key === 'notes'
                              ? 'Заметки'
                              : key === 'clients'
                                ? 'Клиенты'
                                : key === 'tasks'
                                  ? 'Задачи'
                                  : 'Шаблоны'}
                  </label>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="h-9 rounded-full px-5 text-sm font-light"
                  style={accentButtonStyle(settings.accentColor)}
                  onClick={commitJsonImport}
                >
                  Применить импорт
                </button>
                <button
                  type="button"
                  className="h-9 rounded-full border border-card-border px-5 text-sm font-light"
                  onClick={cancelJsonImport}
                >
                  Отмена
                </button>
              </div>
            </div>
          ) : null}
        </SettingsCard>

        <SettingsCard
          title="Уведомления, сессия и приложение"
          subtitle="Напоминания о сроках — в браузере или в Telegram (отдельный воркер с BotFather и service_role). Автовыход обнуляет сессию Supabase на этом устройстве. Установка PWA — в поддерживаемых браузерах."
        >
          <div className="flex flex-col gap-4">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                className="mt-1 h-3.5 w-3.5 accent-ink"
                checked={settings.deadlineNotifyEnabled}
                onChange={(e) =>
                  updateSettings({ deadlineNotifyEnabled: e.target.checked })
                }
              />
              <span className="text-sm font-light text-ink/70">
                Напоминания о дедлайнах проектов, этапов и задач (раз в час проверка).
              </span>
            </label>
            <Field label="За сколько дней заранее (0 — только в день срока)">
              <input
                type="number"
                min={0}
                max={14}
                className={inputClass}
                value={settings.deadlineNotifyDaysBefore}
                onChange={(e) =>
                  updateSettings({
                    deadlineNotifyDaysBefore: Math.min(
                      14,
                      Math.max(0, Number(e.target.value) || 0),
                    ),
                  })
                }
              />
            </Field>

            <div className="border-t border-card-border pt-4">
              <p className="text-[10px] font-light uppercase tracking-[-0.02em] text-ink/55">
                Telegram
              </p>
              <p className="mt-2 text-sm font-light text-ink/70">
                Это <span className="text-ink">один общий бот</span> для всех пользователей.
                Если бот <span className="text-ink">не отвечает</span> на <code className="text-xs">/link</code> — до Telegram не подключён сервер: разверните{' '}
                <span className="text-ink">Supabase Edge Function</span>{' '}
                <code className="text-xs text-ink/85">telegram-webhook</code> (шаги в{' '}
                <code className="text-xs text-ink/85">telegram-notify-bot/README.md</code>, раздел
                «Вариант A») или держите запущенным <code className="text-xs">npm start</code> в{' '}
                <code className="text-xs text-ink/85">telegram-notify-bot/</code>. Нужна миграция{' '}
                <code className="text-xs text-ink/85">006_telegram_notifications.sql</code>.
                Привязка: кнопка ниже или <code className="text-xs">/link</code> с кодом; ответ бота
                «Бот привязан».
              </p>
              {import.meta.env.VITE_TELEGRAM_BOT_USERNAME ? null : (
                <p className="mt-2 text-xs font-light text-amber-800 dark:text-amber-200/90">
                  Без <code className="text-[11px]">VITE_TELEGRAM_BOT_USERNAME</code> в .env кнопка
                  не откроет чат — скопируйте команду <code className="text-[11px]">/link</code> с
                  кодом и отправьте боту вручную.
                </p>
              )}
              {telegramUiHint ? (
                <p className="mt-2 text-xs font-light text-ink/60">{telegramUiHint}</p>
              ) : null}
              {telegramPairCode ? (
                <div className="mt-3 rounded-lg border border-card-border bg-ink/[0.03] px-3 py-2 dark:bg-white/[0.04]">
                  <p className="text-[10px] font-light uppercase tracking-[-0.02em] text-ink/50">
                    Команда для бота (если не открылась ссылка)
                  </p>
                  <code className="mt-1 block break-all text-xs text-ink/90">{`/link ${telegramPairCode}`}</code>
                  <button
                    type="button"
                    className="mt-2 h-8 rounded-full border border-card-border px-3 text-xs font-light"
                    onClick={() => {
                      void navigator.clipboard.writeText(`/link ${telegramPairCode}`)
                      setTelegramUiHint('Скопировано в буфер — вставьте в чат с ботом.')
                    }}
                  >
                    Копировать /link …
                  </button>
                </div>
              ) : null}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-sm font-light text-ink/80">
                  Статус:{' '}
                  {settings.telegramBotLinked ? (
                    <span className="text-ink">привязан</span>
                  ) : (
                    <span className="text-ink/55">не привязан</span>
                  )}
                </span>
                <button
                  type="button"
                  className="h-9 rounded-full border border-card-border px-4 text-sm font-light disabled:opacity-45"
                  disabled={
                    !client ||
                    !session?.user?.id ||
                    settings.readOnlyMode ||
                    telegramLinkBusy
                  }
                  onClick={async () => {
                    setTelegramUiHint(null)
                    if (!client || !session?.user?.id) return
                    const bot = String(
                      import.meta.env.VITE_TELEGRAM_BOT_USERNAME ?? '',
                    ).replace(/^@/, '')
                    setTelegramLinkBusy(true)
                    try {
                      const token = await createTelegramLinkToken(
                        client,
                        session.user.id,
                      )
                      if (!token) {
                        setTelegramUiHint(
                          'Не удалось создать код. Проверьте миграцию 006 и RLS.',
                        )
                        return
                      }
                      setTelegramPairCode(token)
                      if (bot) {
                        window.open(
                          `https://t.me/${bot}?start=${encodeURIComponent(token)}`,
                          '_blank',
                          'noopener,noreferrer',
                        )
                        setTelegramUiHint(
                          'В Telegram нажмите «Start». Когда бот ответит «Бот привязан», статус здесь обновится.',
                        )
                      } else {
                        setTelegramUiHint(
                          'Скопируйте команду /link выше и отправьте её боту в Telegram.',
                        )
                      }
                      if (telegramLinkPollRef.current != null) {
                        window.clearInterval(telegramLinkPollRef.current)
                      }
                      let n = 0
                      telegramLinkPollRef.current = window.setInterval(() => {
                        n += 1
                        void (async () => {
                          if (!client || !session?.user?.id) return
                          const row = await fetchProfileSettings(
                            client,
                            session.user.id,
                          )
                          if (row) {
                            const patch = profileRowToSettingsPatch(row)
                            updateSettings(patch)
                            if (patch.telegramBotLinked) {
                              if (telegramLinkPollRef.current != null) {
                                window.clearInterval(telegramLinkPollRef.current)
                                telegramLinkPollRef.current = null
                              }
                              setTelegramPairCode(null)
                              setTelegramUiHint(
                                'В Telegram должно было прийти: «Бот привязан». Статус обновлён.',
                              )
                            }
                          }
                          if (
                            n >= 20 &&
                            telegramLinkPollRef.current != null
                          ) {
                            window.clearInterval(telegramLinkPollRef.current)
                            telegramLinkPollRef.current = null
                            setTelegramUiHint((prev) =>
                              prev?.includes('обновлён')
                                ? prev
                                : 'Статус не обновился. Убедитесь, что сервер бота запущен, и отправьте /link с кодом или Start по ссылке. Нажмите «Обновить статус».',
                            )
                          }
                        })()
                      }, 2000)
                    } finally {
                      setTelegramLinkBusy(false)
                    }
                  }}
                >
                  Получить код и открыть бота
                </button>
                <button
                  type="button"
                  className="h-9 rounded-full border border-card-border px-4 text-sm font-light disabled:opacity-45"
                  disabled={!client || !session?.user?.id}
                  onClick={() => void refreshProfileFromSupabase()}
                >
                  Обновить статус
                </button>
                <button
                  type="button"
                  className="h-9 rounded-full border border-card-border px-4 text-sm font-light disabled:opacity-45"
                  disabled={
                    !client ||
                    !session?.user?.id ||
                    settings.readOnlyMode ||
                    !settings.telegramBotLinked
                  }
                  onClick={async () => {
                    if (!client || !session?.user?.id) return
                    setTelegramUiHint(null)
                    const err = await unlinkTelegramFromProfile(
                      client,
                      session.user.id,
                    )
                    if (err) {
                      setTelegramUiHint(err.message)
                      return
                    }
                    updateSettings({ telegramBotLinked: false })
                    setTelegramPairCode(null)
                    setTelegramUiHint(
                      'Чат отвязан. Чтобы снова привязать — получите новый код кнопкой выше.',
                    )
                  }}
                >
                  Отвязать Telegram
                </button>
              </div>
              <label className="mt-4 flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1 h-3.5 w-3.5 accent-ink"
                  checked={settings.telegramDeadlineNotifyEnabled}
                  disabled={settings.readOnlyMode}
                  onChange={(e) =>
                    updateSettings({
                      telegramDeadlineNotifyEnabled: e.target.checked,
                    })
                  }
                />
                <span className="text-sm font-light text-ink/70">
                  Напоминания о дедлайнах в Telegram (раз в час проверяет воркер; нужен запущенный
                  бот).
                </span>
              </label>
              <Field label="За сколько дней заранее в Telegram (0 — только в день срока)">
                <input
                  type="number"
                  min={0}
                  max={14}
                  className={inputClass}
                  disabled={settings.readOnlyMode}
                  value={settings.telegramDeadlineNotifyDaysBefore}
                  onChange={(e) =>
                    updateSettings({
                      telegramDeadlineNotifyDaysBefore: Math.min(
                        14,
                        Math.max(0, Number(e.target.value) || 0),
                      ),
                    })
                  }
                />
              </Field>
              <label className="mt-4 flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1 h-3.5 w-3.5 accent-ink"
                  checked={settings.telegramNotifyCreatesEnabled}
                  disabled={settings.readOnlyMode}
                  onChange={(e) =>
                    updateSettings({
                      telegramNotifyCreatesEnabled: e.target.checked,
                    })
                  }
                />
                <span className="text-sm font-light text-ink/70">
                  Уведомлять в Telegram о новых проектах, этапах, клиентах и задачах (нужны
                  привязанный чат и Edge Function{' '}
                  <code className="text-xs text-ink/85">telegram-send</code>).
                </span>
              </label>
            </div>

            <Field label="Автовыход при простое (минуты, 0 — не выходить)">
              <input
                type="number"
                min={0}
                max={1440}
                className={inputClass}
                value={settings.sessionIdleMinutes}
                onChange={(e) =>
                  updateSettings({
                    sessionIdleMinutes: Math.min(
                      1440,
                      Math.max(0, Number(e.target.value) || 0),
                    ),
                  })
                }
              />
            </Field>
            {pwaDeferred ? (
              <button
                type="button"
                className="h-9 w-fit rounded-full border border-card-border px-5 text-sm font-light"
                onClick={() => {
                  void pwaDeferred.prompt().finally(() => setPwaDeferred(null))
                }}
              >
                Установить приложение (PWA)
              </button>
            ) : (
              <p className="text-xs font-light text-ink/50">
                Подсказка: откройте сайт в Chrome/Edge; кнопка установки появится, когда
                браузер предложит PWA.
              </p>
            )}
          </div>
        </SettingsCard>

        <SettingsCard title="Что нового" subtitle="Краткий журнал возможностей.">
          <ul className="flex flex-col gap-4">
            {APP_CHANGELOG.map((block) => (
              <li key={block.date}>
                <p className="text-[10px] font-light uppercase text-ink/55">{block.date}</p>
                <ul className="mt-2 list-inside list-disc text-sm font-light text-ink/80">
                  {block.items.map((it) => (
                    <li key={it}>{it}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </SettingsCard>
        </div>

        <div
          id="settings-panel-security"
          role="tabpanel"
          hidden={tab !== 'security'}
          aria-labelledby="settings-tab-security"
          className="grid grid-cols-1 gap-6"
        >
            <SettingsCard
              title="Режим только чтения"
              subtitle="Пока включено: данные не записываются в Supabase (проекты, заметки, журнал таймера на сервере), пароль входа не попадает в localStorage. Флаг синхронизируется с колонкой profiles.read_only_mode после применения миграции 004."
            >
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1 h-3.5 w-3.5 shrink-0 rounded border border-[rgba(10,10,10,0.25)] accent-ink dark:border-white/25"
                  checked={settings.readOnlyMode}
                  onChange={(e) =>
                    updateSettings({ readOnlyMode: e.target.checked })
                  }
                />
                <span className="text-sm font-light leading-snug text-ink/70">
                  Не отправлять изменения в Supabase и не сохранять пароль входа на диске.
                </span>
              </label>
            </SettingsCard>

            <SettingsCard
              title="Аккаунт"
              subtitle="Выйти из Supabase можно только здесь — в шапке кнопки выхода нет."
            >
              {session?.user?.email ? (
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm font-light text-ink/70">
                    Вы вошли как{' '}
                    <span className="text-ink">{session.user.email}</span>
                  </p>
                  <button
                    type="button"
                    className="h-9 w-fit shrink-0 rounded-full border border-[rgba(10,10,10,0.2)] bg-surface px-5 text-sm font-light tracking-[-0.05em] text-ink transition-colors hover:bg-ink/[0.04]"
                    onClick={() => {
                      void signOut().then(() => navigate('/', { replace: true }))
                    }}
                  >
                    Выйти из аккаунта
                  </button>
                </div>
              ) : (
                <p className="text-sm font-light text-ink/55">
                  Сессия не найдена. Обновите страницу или войдите снова с экрана
                  входа.
                </p>
              )}
            </SettingsCard>

            <SettingsCard
              title="Подключение к Supabase"
              subtitle="Локально в браузере и дублируются в таблице profiles после входа (колонки supabase_project_url, supabase_anon_key). В CSV не попадают. На чужих устройствах не оставляйте ключи."
            >
              <Field label="URL проекта (Supabase)">
                <input
                  className={inputClass}
                  placeholder="https://xxxx.supabase.co"
                  value={settings.supabaseUrl}
                  onChange={(e) =>
                    updateSettings({ supabaseUrl: e.target.value })
                  }
                  autoComplete="off"
                />
              </Field>
              <Field label="Anon (public) key">
                <input
                  className={inputClass}
                  type="password"
                  autoComplete="off"
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9…"
                  value={settings.supabaseAnonKey}
                  onChange={(e) =>
                    updateSettings({ supabaseAnonKey: e.target.value })
                  }
                />
              </Field>
            </SettingsCard>

            <SettingsCard
              title="Вход в Supabase (email и пароль)"
              subtitle="Логин и пароль для Supabase Auth при подключении клиента @supabase/supabase-js. Сохранённый пароль здесь не показывается — задайте новый дважды и нажмите «Сохранить пароль»."
            >
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1 h-3.5 w-3.5 shrink-0 rounded border border-[rgba(10,10,10,0.25)] accent-ink dark:border-white/25"
                  checked={settings.rememberAuthPassword}
                  onChange={(e) => {
                    const on = e.target.checked
                    updateSettings(
                      on
                        ? { rememberAuthPassword: true }
                        : {
                            rememberAuthPassword: false,
                            supabaseAuthPassword: '',
                          },
                    )
                  }}
                />
                <span className="text-sm font-light leading-snug text-ink/70">
                  Запоминать пароль входа в localStorage. Если выключено, пароль не
                  попадёт в файл настроек на диске (остаётся только в памяти до
                  закрытия вкладки).
                </span>
              </label>
              <Field label="Email (логин)">
                <input
                  className={inputClass}
                  type="email"
                  inputMode="email"
                  placeholder="you@example.com"
                  value={settings.supabaseAuthEmail}
                  onChange={(e) =>
                    updateSettings({ supabaseAuthEmail: e.target.value })
                  }
                  autoComplete="username"
                />
              </Field>
              <Field label="Новый пароль">
                <input
                  className={inputClass}
                  type="password"
                  value={pwdNew}
                  onChange={(e) => {
                    setPwdNew(e.target.value)
                    setPwdFeedback('idle')
                  }}
                  autoComplete="new-password"
                />
              </Field>
              <Field label="Повторите пароль">
                <input
                  className={inputClass}
                  type="password"
                  value={pwdRepeat}
                  onChange={(e) => {
                    setPwdRepeat(e.target.value)
                    setPwdFeedback('idle')
                  }}
                  autoComplete="new-password"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') applySupabasePassword()
                  }}
                />
              </Field>
              {pwdFeedback === 'mismatch' ? (
                <p className="text-sm font-light text-red-700/90">
                  Пароли не совпадают.
                </p>
              ) : null}
              {pwdFeedback === 'empty' ? (
                <p className="text-sm font-light text-ink/60">
                  Введите новый пароль в оба поля.
                </p>
              ) : null}
              {pwdFeedback === 'ok' ? (
                <p className="text-sm font-light text-ink/70">
                  Пароль сохранён локально.
                </p>
              ) : null}
              {hasStoredSupabasePassword ? (
                <p className="text-sm font-light text-ink/55">
                  Сохранён пароль для входа (не отображается).
                </p>
              ) : null}
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  className="h-9 rounded-full px-5 text-sm font-light tracking-[-0.05em] transition-opacity hover:opacity-90"
                  style={accentButtonStyle(settings.accentColor)}
                  onClick={applySupabasePassword}
                >
                  Сохранить пароль
                </button>
                {hasStoredSupabasePassword ? (
                  <button
                    type="button"
                    className="h-9 rounded-full border border-[rgba(10,10,10,0.2)] bg-surface px-5 text-sm font-light tracking-[-0.05em] text-ink transition-colors hover:bg-ink/[0.04]"
                    onClick={clearSupabasePassword}
                  >
                    Удалить сохранённый пароль
                  </button>
                ) : null}
              </div>
            </SettingsCard>

            <SettingsCard
              title="SQL для создания базы"
              subtitle={
                <>
                  {SUPABASE_SQL_INSTRUCTION} Исходник в репозитории:{' '}
                  <code className="rounded bg-ink/[0.06] px-1 py-0.5 font-mono text-[11px]">
                    supabase/migrations/001_portfolio_schema.sql
                  </code>
                  .
                </>
              }
            >
              <textarea
                readOnly
                className="min-h-[min(50vh,420px)] w-full resize-y border border-[rgba(10,10,10,0.12)] bg-ink/[0.02] p-3 font-mono text-[11px] font-light leading-relaxed text-ink/90"
                value={PORTFOLIO_SCHEMA_SQL}
                spellCheck={false}
              />
              <button
                type="button"
                className="h-9 w-fit rounded-full border border-[rgba(10,10,10,0.2)] bg-surface px-5 text-sm font-light tracking-[-0.05em] text-ink transition-colors hover:bg-ink/[0.04]"
                onClick={copyPrompt}
              >
                {copyState === 'ok'
                  ? 'Скопировано'
                  : copyState === 'err'
                    ? 'Не удалось скопировать'
                    : 'Копировать SQL'}
              </button>
            </SettingsCard>
        </div>
      </div>
    </main>
  )
}
