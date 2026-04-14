import {
  useCallback,
  useEffect,
  useId,
  useState,
  type FormEvent,
} from 'react'
import { authErrorMessageRu } from '../lib/authErrorMessageRu'
import {
  createSupabaseBrowserClient,
  isSupabaseConfigFilled,
} from '../lib/createSupabaseBrowserClient'
import {
  formInputUnderlineClass,
  modalEdgeBorderClass,
} from '../lib/formInputClasses'
import {
  getResolvedSupabaseConnection,
  hasResolvedSupabaseConnection,
} from '../lib/resolveSupabaseConnection'
import {
  PORTFOLIO_SCHEMA_SQL,
  SUPABASE_SQL_INSTRUCTION,
} from '../lib/portfolioSchemaSql'
import { saveSupabaseConnectionToProfile } from '../lib/saveSupabaseConnectionToProfile'
import { useSettings } from '../hooks/useSettings'
import { accentButtonStyle } from '../lib/pickContrastText'
import type { AuthMode } from '../context/authContext'

const inputClass = formInputUnderlineClass

function LogoMark() {
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink/5">
      <svg width="20" height="20" viewBox="0 0 18 18" fill="none" aria-hidden>
        <rect x="2" y="2" width="6" height="6" rx="1" className="fill-ink" />
        <rect x="10" y="2" width="6" height="6" rx="1" className="fill-ink/40" />
        <rect x="2" y="10" width="6" height="6" rx="1" className="fill-ink/40" />
        <rect x="10" y="10" width="6" height="6" rx="1" className="fill-ink" />
      </svg>
    </div>
  )
}

export function AuthGateScreen() {
  const titleId = useId()
  const { settings, updateSettings } = useSettings()

  const [mode, setMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState(settings.supabaseAuthEmail)
  const [password, setPassword] = useState(settings.supabaseAuthPassword)
  /** Только регистрация: URL и anon key не показываем на входе. */
  const [regUrl, setRegUrl] = useState(settings.supabaseUrl)
  const [regKey, setRegKey] = useState(settings.supabaseAnonKey)
  /** Резерв, если нет ни localStorage, ни VITE_* (другой браузер). */
  const [recoveryUrl, setRecoveryUrl] = useState('')
  const [recoveryKey, setRecoveryKey] = useState('')

  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [sqlCopyState, setSqlCopyState] = useState<'idle' | 'ok' | 'err'>(
    'idle',
  )

  const copySchemaSql = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(PORTFOLIO_SCHEMA_SQL)
      setSqlCopyState('ok')
      window.setTimeout(() => setSqlCopyState('idle'), 2000)
    } catch {
      setSqlCopyState('err')
      window.setTimeout(() => setSqlCopyState('idle'), 2500)
    }
  }, [])

  const canConnect = hasResolvedSupabaseConnection(settings)
  const showRecovery = mode === 'login' && !canConnect

  useEffect(() => {
    setEmail(settings.supabaseAuthEmail)
    setPassword(settings.supabaseAuthPassword)
    setRegUrl(settings.supabaseUrl)
    setRegKey(settings.supabaseAnonKey)
  }, [
    settings.supabaseAuthEmail,
    settings.supabaseAuthPassword,
    settings.supabaseUrl,
    settings.supabaseAnonKey,
  ])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setFormError(null)
    setInfo(null)
    const em = email.trim()
    const pw = password
    if (!em) {
      setFormError('Введите email')
      return
    }
    if (!pw) {
      setFormError('Введите пароль')
      return
    }

    setBusy(true)
    try {
      if (mode === 'login') {
        const resolved = getResolvedSupabaseConnection(settings)
        const url = resolved.url || recoveryUrl.trim()
        const key = resolved.anonKey || recoveryKey.trim()
        if (!isSupabaseConfigFilled(url, key)) {
          setFormError(
            'Укажите URL и anon key ниже или задайте VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY в .env',
          )
          return
        }

        const loginClient = createSupabaseBrowserClient(url, key)
        const { data, error } = await loginClient.auth.signInWithPassword({
          email: em,
          password: pw,
        })
        if (error) {
          setFormError(authErrorMessageRu(error))
          return
        }
        updateSettings({
          supabaseUrl: url.trim(),
          supabaseAnonKey: key.trim(),
          supabaseAuthEmail: em,
          supabaseAuthPassword:
            settings.rememberAuthPassword && !settings.readOnlyMode ? pw : '',
        })
        if (data.session?.user) {
          void saveSupabaseConnectionToProfile(
            loginClient,
            data.session.user.id,
            url.trim(),
            key.trim(),
          )
        }
        return
      }

      const ru = regUrl.trim()
      const rk = regKey.trim()
      if (!isSupabaseConfigFilled(ru, rk)) {
        setFormError('Укажите URL проекта и anon key — они нужны только при регистрации')
        return
      }

      const signupClient = createSupabaseBrowserClient(ru, rk)
      const redirect =
        typeof window !== 'undefined' ? `${window.location.origin}/` : undefined
      const { data, error } = await signupClient.auth.signUp({
        email: em,
        password: pw,
        options: redirect ? { emailRedirectTo: redirect } : undefined,
      })
      if (error) {
        setFormError(authErrorMessageRu(error))
        return
      }

      updateSettings({
        supabaseUrl: ru,
        supabaseAnonKey: rk,
        supabaseAuthEmail: em,
        supabaseAuthPassword:
          settings.rememberAuthPassword && !settings.readOnlyMode ? pw : '',
      })

      if (data.session?.user) {
        void saveSupabaseConnectionToProfile(
          signupClient,
          data.session.user.id,
          ru,
          rk,
        )
        return
      }
      if (data.user) {
        setInfo(
          'Аккаунт создан. Если в проекте Supabase включено подтверждение email, проверьте почту и перейдите по ссылке, затем войдите.',
        )
        setPassword('')
        return
      }
      setInfo('Проверьте почту и завершите регистрацию, если требуется.')
    } finally {
      setBusy(false)
    }
  }

  const switchMode = (next: AuthMode) => {
    setMode(next)
    setFormError(null)
    setInfo(null)
    setSqlCopyState('idle')
    if (next === 'register') {
      setPassword('')
      setRegUrl(settings.supabaseUrl)
      setRegKey(settings.supabaseAnonKey)
    } else {
      setPassword(settings.supabaseAuthPassword)
      setEmail(settings.supabaseAuthEmail)
    }
  }

  return (
    <div className="relative flex min-h-svh w-full flex-col items-center justify-center overflow-x-hidden bg-surface px-4 py-12 text-ink">
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
              id="auth-gate-grid"
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
          <rect width="100%" height="100%" fill="url(#auth-gate-grid)" />
        </svg>
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <LogoMark />
          <h1
            id={titleId}
            className="text-[clamp(1.5rem,4vw,2rem)] font-light leading-tight tracking-[-0.06em]"
          >
            Вход в приложение
          </h1>
          <p className="max-w-sm text-sm font-light leading-snug text-ink/60">
            При регистрации укажите проект Supabase; при входе — только email и
            пароль. Подключение сохраняется в браузере и дублируется в таблице{' '}
            <code className="rounded bg-ink/[0.06] px-1 font-mono text-[11px]">
              profiles
            </code>
            .
          </p>
        </div>

        <div
          className="flex flex-col border border-card-border bg-surface shadow-sm"
          role="region"
          aria-labelledby={titleId}
        >
          <div
            className={`flex border-b px-5 ${modalEdgeBorderClass}`}
            role="tablist"
            aria-label="Режим"
          >
            {(
              [
                ['login', 'Вход'],
                ['register', 'Регистрация'],
              ] as const
            ).map(([id, label]) => {
              const selected = mode === id
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => switchMode(id)}
                  className={`relative -mb-px border-b-2 px-3 py-3 text-sm font-light tracking-[-0.04em] transition-colors duration-200 ${
                    selected
                      ? 'border-ink text-ink'
                      : 'border-transparent text-ink/50 hover:text-ink/75'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>

          {mode === 'register' ? (
            <div className={`border-b px-5 py-4 ${modalEdgeBorderClass}`}>
              <h2 className="text-[10px] font-light uppercase tracking-[-0.02em] text-ink/55">
                Проект Supabase (только регистрация)
              </h2>
              <p className="mt-3 text-sm font-light leading-snug text-ink/65">
                {SUPABASE_SQL_INSTRUCTION}
              </p>
              <button
                type="button"
                disabled={busy}
                className="mt-3 h-8 w-fit rounded-full border border-card-border bg-surface px-4 text-xs font-light tracking-[-0.02em] text-ink transition-colors hover:bg-ink/[0.04] disabled:opacity-40"
                onClick={() => void copySchemaSql()}
              >
                {sqlCopyState === 'ok'
                  ? 'Скопировано'
                  : sqlCopyState === 'err'
                    ? 'Не удалось скопировать'
                    : 'Скопировать SQL для Supabase'}
              </button>
              <div className="mt-4 flex flex-col gap-4">
                <label className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-light uppercase tracking-[-0.02em] text-ink/55">
                    URL проекта
                  </span>
                  <input
                    className={inputClass}
                    placeholder="https://xxxx.supabase.co"
                    value={regUrl}
                    onChange={(e) => setRegUrl(e.target.value)}
                    autoComplete="off"
                    disabled={busy}
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-light uppercase tracking-[-0.02em] text-ink/55">
                    Anon (public) key
                  </span>
                  <input
                    className={inputClass}
                    type="password"
                    autoComplete="off"
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9…"
                    value={regKey}
                    onChange={(e) => setRegKey(e.target.value)}
                    disabled={busy}
                  />
                </label>
              </div>
            </div>
          ) : null}

          {showRecovery ? (
            <div className={`border-b px-5 py-4 ${modalEdgeBorderClass}`}>
              <h2 className="text-[10px] font-light uppercase tracking-[-0.02em] text-ink/55">
                Подключение к проекту
              </h2>
              <p className="mt-2 text-sm font-light leading-snug text-ink/60">
                На этом устройстве нет сохранённого URL/ключа. Введите те же,
                что при регистрации (или задайте VITE_SUPABASE_* в .env для
                сборки).
              </p>
              <div className="mt-4 flex flex-col gap-4">
                <label className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-light uppercase tracking-[-0.02em] text-ink/55">
                    URL проекта
                  </span>
                  <input
                    className={inputClass}
                    placeholder="https://xxxx.supabase.co"
                    value={recoveryUrl}
                    onChange={(e) => setRecoveryUrl(e.target.value)}
                    autoComplete="off"
                    disabled={busy}
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-light uppercase tracking-[-0.02em] text-ink/55">
                    Anon key
                  </span>
                  <input
                    className={inputClass}
                    type="password"
                    value={recoveryKey}
                    onChange={(e) => setRecoveryKey(e.target.value)}
                    autoComplete="off"
                    disabled={busy}
                  />
                </label>
              </div>
            </div>
          ) : null}

          <form
            className="flex flex-col gap-4 px-5 py-5"
            onSubmit={handleSubmit}
          >
            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] font-light uppercase tracking-[-0.02em] text-ink/55">
                Email
              </span>
              <input
                className={inputClass}
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={busy}
                aria-invalid={!!formError}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] font-light uppercase tracking-[-0.02em] text-ink/55">
                Пароль
              </span>
              <input
                className={inputClass}
                type="password"
                autoComplete={
                  mode === 'login' ? 'current-password' : 'new-password'
                }
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={busy}
              />
            </label>
            <label className="flex cursor-pointer items-start gap-3 py-0.5">
              <input
                type="checkbox"
                className="mt-1 h-3.5 w-3.5 shrink-0 rounded border border-card-border accent-ink"
                checked={settings.rememberAuthPassword}
                onChange={(e) =>
                  updateSettings({ rememberAuthPassword: e.target.checked })
                }
                disabled={busy || settings.readOnlyMode}
              />
              <span className="text-xs font-light leading-snug text-ink/65">
                Запоминать пароль на этом устройстве (сохраняется в
                localStorage). Выключите на общих компьютерах.
                {settings.readOnlyMode
                  ? ' В режиме только чтения сохранение пароля отключено.'
                  : ''}
              </span>
            </label>

            {formError ? (
              <p className="text-sm font-light text-red-700/90" role="alert">
                {formError}
              </p>
            ) : null}
            {info ? (
              <p className="text-sm font-light leading-snug text-ink/70">
                {info}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={busy}
              className="mt-1 h-10 w-full rounded-full text-sm font-light tracking-[-0.05em] transition-opacity enabled:hover:opacity-90 disabled:opacity-40 sm:w-fit sm:px-8"
              style={accentButtonStyle(settings.accentColor)}
            >
              {busy
                ? 'Подождите…'
                : mode === 'login'
                  ? 'Войти'
                  : 'Зарегистрироваться'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
