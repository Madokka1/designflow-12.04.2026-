import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  DEFAULT_APP_SETTINGS,
  type AppSettings,
  type SettingsFontId,
  type SettingsThemeId,
} from '../types/settings'
import { SettingsContext } from './settingsContext'

const STORAGE_KEY = 'portfolio-settings-v1'

const FONT_STACKS: Record<SettingsFontId, string> = {
  inter: "'Inter', ui-sans-serif, system-ui, sans-serif",
  georgia: "Georgia, 'Times New Roman', serif",
  jetbrains: "'JetBrains Mono', ui-monospace, monospace",
  system: 'ui-sans-serif, system-ui, sans-serif',
}

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_APP_SETTINGS }
    const parsed = JSON.parse(raw) as Partial<AppSettings>
    return { ...DEFAULT_APP_SETTINGS, ...parsed }
  } catch {
    return { ...DEFAULT_APP_SETTINGS }
  }
}

function persistToDisk(s: AppSettings) {
  try {
    const toStore: AppSettings = { ...s }
    if (!toStore.rememberAuthPassword || toStore.readOnlyMode) {
      toStore.supabaseAuthPassword = ''
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore))
  } catch {
    /* ignore */
  }
}

function resolveDark(theme: SettingsThemeId): boolean {
  if (theme === 'dark') return true
  if (theme === 'light') return false
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  )
}

function applyThemeToDocument(s: AppSettings) {
  const root = document.documentElement
  root.style.setProperty(
    '--font-sans',
    FONT_STACKS[s.fontFamily] ?? FONT_STACKS.inter,
  )
  root.style.setProperty(
    '--color-accent',
    s.accentColor || DEFAULT_APP_SETTINGS.accentColor,
  )
  root.classList.toggle('dark', resolveDark(s.theme))
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings())

  useEffect(() => {
    applyThemeToDocument(settings)
    persistToDisk(settings)
  }, [settings])

  useEffect(() => {
    if (settings.theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const sync = () => {
      document.documentElement.classList.toggle('dark', mq.matches)
    }
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [settings.theme])

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }))
  }, [])

  const value = useMemo(
    () => ({ settings, updateSettings }),
    [settings, updateSettings],
  )

  return (
    <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
  )
}
