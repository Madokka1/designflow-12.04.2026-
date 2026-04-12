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
  /** Напоминания о приближающихся дедлайнах (браузерные уведомления). */
  deadlineNotifyEnabled: boolean
  /** За сколько календарных дней до даты показывать уведомление (включая день дедлайна). */
  deadlineNotifyDaysBefore: number
  /** Чат Telegram привязан (после /start в боте); синхронизируется из profiles.telegram_chat_id. */
  telegramBotLinked: boolean
  /** Напоминания о дедлайнах в Telegram (воркер с service_role). */
  telegramDeadlineNotifyEnabled: boolean
  /** За сколько дней до срока слать в Telegram (0–14). */
  telegramDeadlineNotifyDaysBefore: number
  /** Уведомления в Telegram о новых проектах, этапах, клиентах, задачах. */
  telegramNotifyCreatesEnabled: boolean
  /** Автовыход при простое, минуты; 0 — выключено. */
  sessionIdleMinutes: number
  /**
   * Ярлыки разделов между логотипом и таймером (от sm). Подписи как в меню навигации.
   * Только localStorage, в Supabase не синхронизируется.
   */
  headerQuickNavLabels: string[]
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
  deadlineNotifyEnabled: false,
  deadlineNotifyDaysBefore: 3,
  telegramBotLinked: false,
  telegramDeadlineNotifyEnabled: false,
  telegramDeadlineNotifyDaysBefore: 3,
  telegramNotifyCreatesEnabled: true,
  sessionIdleMinutes: 0,
  headerQuickNavLabels: ['Проекты', 'Финансы', 'Календарь', 'Заметки'],
}
