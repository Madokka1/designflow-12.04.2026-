import { useCallback, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  buildPortfolioCsvExport,
  downloadUtf8Csv,
} from '../lib/exportPortfolioCsv'
import {
  buildPortfolioJsonBackup,
  parsePortfolioJsonBackup,
} from '../lib/portfolioJsonBackup'
import { upsertNoteToSupabase } from '../lib/notesSupabase'
import { buildTimerSessionsCsv } from '../lib/exportTimerSessionsCsv'
import { accentButtonStyle } from '../lib/pickContrastText'
import {
  PORTFOLIO_SCHEMA_SQL,
  SUPABASE_SQL_INSTRUCTION,
} from '../lib/portfolioSchemaSql'
import { useAuth } from '../hooks/useAuth'
import { useNotesContext } from '../hooks/useNotesContext'
import { useProjects } from '../hooks/useProjects'
import { useSettings } from '../hooks/useSettings'
import { formInputUnderlineClass } from '../lib/formInputClasses'
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
    timerSessionLog,
    clearTimerSessionLog,
    replacePortfolioData,
    syncPortfolioToRemote,
  } = useProjects()
  const { notes, replaceAllNotes } = useNotesContext()
  const jsonImportRef = useRef<HTMLInputElement>(null)
  const [tab, setTab] = useState<SettingsTabId>('general')
  const [copyState, setCopyState] = useState<'idle' | 'ok' | 'err'>('idle')
  const [accentHexDraft, setAccentHexDraft] = useState(settings.accentColor)
  const [pwdNew, setPwdNew] = useState('')
  const [pwdRepeat, setPwdRepeat] = useState('')
  const [pwdFeedback, setPwdFeedback] = useState<
    'idle' | 'ok' | 'mismatch' | 'empty'
  >('idle')

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
  ])

  const handleImportJson = useCallback(
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
        if (!parsed.ok) {
          window.alert(parsed.error)
          return
        }
        if (
          !window.confirm(
            'Заменить проекты, финансы, календарь, заметки и поля профиля из файла? Данные отправятся в Supabase.',
          )
        ) {
          return
        }
        const { data } = parsed
        const sp = data.settingsProfile
        updateSettings({
          firstName: sp.firstName,
          lastName: sp.lastName,
          email: sp.email,
          telegram: sp.telegram,
          website: sp.website,
          jobTitle: sp.jobTitle,
          about: sp.about,
          fontFamily: sp.fontFamily as typeof settings.fontFamily,
          accentColor: sp.accentColor,
        })
        replacePortfolioData({
          projects: data.projects,
          financeTransactions: data.financeTransactions,
          calendarCustomEvents: data.calendarCustomEvents,
        })
        replaceAllNotes(data.notes)
        const uid = session?.user?.id
        void (async () => {
          await syncPortfolioToRemote()
          if (client && uid) {
            for (const n of data.notes) {
              await upsertNoteToSupabase(client, uid, n)
            }
          }
        })()
      }
      reader.readAsText(file, 'utf-8')
    },
    [
      client,
      session?.user?.id,
      settings,
      updateSettings,
      replacePortfolioData,
      replaceAllNotes,
      syncPortfolioToRemote,
    ],
  )

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
          <p className="text-[10px] font-light uppercase tracking-[-0.02em] text-ink/55">
            Настройки
          </p>
          <h1 className="mt-1 text-[clamp(2rem,5vw,3.5rem)] font-light leading-[0.9] tracking-[-0.09em]">
            {tab === 'security' ? 'Безопасность и Supabase' : 'Профиль и данные'}
          </h1>
        </div>
      </div>

      <div
        className={`mt-8 flex flex-wrap gap-1 border-b ${BORDER}`}
        role="tablist"
        aria-label="Разделы настроек"
      >
        {tabs.map((t) => {
          const selected = tab === t.id
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={selected}
              id={`settings-tab-${t.id}`}
              aria-controls={`settings-panel-${t.id}`}
              onClick={() => {
                if (t.id !== 'security') setPwdFeedback('idle')
                setTab(t.id)
              }}
              className={`relative -mb-px border-b-2 px-3 py-2.5 text-sm font-light tracking-[-0.04em] transition-colors duration-200 ${
                selected
                  ? 'border-ink text-ink'
                  : 'border-transparent text-ink/55 hover:text-ink/80'
              }`}
            >
              {t.label}
            </button>
          )
        })}
      </div>

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
          subtitle="Полный снимок для восстановления: те же данные, что в CSV, в одном JSON. Импорт заменяет текущие проекты, финансы, календарь и заметки и синхронизирует их с Supabase (если не включён режим только чтения)."
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
              onChange={handleImportJson}
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
