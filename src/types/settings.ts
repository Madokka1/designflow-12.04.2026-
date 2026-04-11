export type SettingsFontId = 'inter' | 'georgia' | 'jetbrains' | 'system'

export type SettingsThemeId = 'light' | 'dark' | 'system'

export type AppSettings = {
  firstName: string
  lastName: string
  email: string
  telegram: string
  website: string
  jobTitle: string
  about: string
  fontFamily: SettingsFontId
  accentColor: string
  /** Светлая / тёмная / как в системе. */
  theme: SettingsThemeId
  /** Сохранять пароль Supabase в localStorage (иначе только в памяти до закрытия вкладки). */
  rememberAuthPassword: boolean
  supabaseUrl: string
  supabaseAnonKey: string
  /** Email для входа через Supabase Auth (отдельно от почты в профиле). */
  supabaseAuthEmail: string
  /** Пароль для Supabase Auth; в хранилище только если rememberAuthPassword. */
  supabaseAuthPassword: string
  /**
   * Не записывать данные в Supabase (синхронизируется из profiles.read_only_mode).
   * Пароль входа в localStorage при этом не сохраняется.
   */
  readOnlyMode: boolean
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  firstName: '',
  lastName: '',
  email: '',
  telegram: '',
  website: '',
  jobTitle: '',
  about: '',
  fontFamily: 'inter',
  accentColor: '#0a0a0a',
  theme: 'system',
  rememberAuthPassword: false,
  supabaseUrl: '',
  supabaseAnonKey: '',
  supabaseAuthEmail: '',
  supabaseAuthPassword: '',
  readOnlyMode: false,
}
