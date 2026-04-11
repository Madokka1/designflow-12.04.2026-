import type { SupabaseClient } from '@supabase/supabase-js'
import {
  DEFAULT_APP_SETTINGS,
  type AppSettings,
  type SettingsFontId,
  type SettingsThemeId,
} from '../types/settings'

const FONTS: SettingsFontId[] = ['inter', 'georgia', 'jetbrains', 'system']
const THEMES: SettingsThemeId[] = ['light', 'dark', 'system']

function asFont(v: string | null | undefined): SettingsFontId {
  return FONTS.includes(v as SettingsFontId)
    ? (v as SettingsFontId)
    : DEFAULT_APP_SETTINGS.fontFamily
}

function asTheme(v: string | null | undefined): SettingsThemeId {
  return THEMES.includes(v as SettingsThemeId)
    ? (v as SettingsThemeId)
    : DEFAULT_APP_SETTINGS.theme
}

export type ProfileSettingsRow = {
  first_name: string | null
  last_name: string | null
  email: string | null
  telegram: string | null
  website: string | null
  job_title: string | null
  about: string | null
  font_family: string | null
  accent_color: string | null
  theme: string | null
  remember_auth_password: boolean | null
  supabase_project_url: string | null
  supabase_anon_key: string | null
  supabase_auth_email: string | null
  read_only_mode: boolean | null
  telegram_chat_id: number | string | null
  telegram_deadline_notify_enabled: boolean | null
  telegram_deadline_notify_days_before: number | null
  telegram_notify_creates_enabled: boolean | null
}

const PROFILE_SETTINGS_SELECT =
  'first_name,last_name,email,telegram,website,job_title,about,font_family,accent_color,theme,remember_auth_password,supabase_project_url,supabase_anon_key,supabase_auth_email,read_only_mode,telegram_chat_id,telegram_deadline_notify_enabled,telegram_deadline_notify_days_before,telegram_notify_creates_enabled'

export function profileRowToSettingsPatch(row: ProfileSettingsRow): Partial<AppSettings> {
  return {
    firstName: row.first_name ?? '',
    lastName: row.last_name ?? '',
    email: row.email ?? '',
    telegram: row.telegram ?? '',
    website: row.website ?? '',
    jobTitle: row.job_title ?? '',
    about: row.about ?? '',
    fontFamily: asFont(row.font_family ?? undefined),
    accentColor: row.accent_color?.trim() || DEFAULT_APP_SETTINGS.accentColor,
    theme: asTheme(row.theme ?? undefined),
    rememberAuthPassword: Boolean(row.remember_auth_password),
    supabaseUrl: row.supabase_project_url ?? '',
    supabaseAnonKey: row.supabase_anon_key ?? '',
    supabaseAuthEmail: row.supabase_auth_email ?? '',
    readOnlyMode: Boolean(row.read_only_mode),
    telegramBotLinked:
      row.telegram_chat_id != null && String(row.telegram_chat_id).trim() !== '',
    telegramDeadlineNotifyEnabled: Boolean(row.telegram_deadline_notify_enabled),
    telegramDeadlineNotifyDaysBefore: Math.min(
      14,
      Math.max(
        0,
        typeof row.telegram_deadline_notify_days_before === 'number'
          ? row.telegram_deadline_notify_days_before
          : 3,
      ),
    ),
    telegramNotifyCreatesEnabled:
      row.telegram_notify_creates_enabled !== false,
  }
}

export function settingsToProfileUpsertRow(
  s: AppSettings,
  userId: string,
): Record<string, unknown> {
  return {
    id: userId,
    first_name: s.firstName,
    last_name: s.lastName,
    email: s.email.trim() ? s.email.trim() : null,
    telegram: s.telegram,
    website: s.website,
    job_title: s.jobTitle,
    about: s.about,
    font_family: s.fontFamily,
    accent_color: s.accentColor,
    theme: s.theme,
    remember_auth_password: s.rememberAuthPassword,
    supabase_project_url: s.supabaseUrl,
    supabase_anon_key: s.supabaseAnonKey,
    supabase_auth_email: s.supabaseAuthEmail,
    read_only_mode: s.readOnlyMode,
    telegram_deadline_notify_enabled: s.telegramDeadlineNotifyEnabled,
    telegram_deadline_notify_days_before: s.telegramDeadlineNotifyDaysBefore,
    telegram_notify_creates_enabled: s.telegramNotifyCreatesEnabled,
  }
}

export async function fetchProfileSettings(
  client: SupabaseClient,
  userId: string,
): Promise<ProfileSettingsRow | null> {
  const { data, error } = await client
    .from('profiles')
    .select(PROFILE_SETTINGS_SELECT)
    .eq('id', userId)
    .maybeSingle()
  if (error) return null
  return data as ProfileSettingsRow | null
}

export async function upsertProfileSettings(
  client: SupabaseClient,
  s: AppSettings,
  userId: string,
): Promise<Error | null> {
  const row = settingsToProfileUpsertRow(s, userId)
  const { error } = await client.from('profiles').upsert(row, { onConflict: 'id' })
  return error
}
