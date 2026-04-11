import type { AppSettings } from '../types/settings'
import { isSupabaseConfigFilled } from './createSupabaseBrowserClient'

function envUrl(): string {
  const v = import.meta.env.VITE_SUPABASE_URL
  return typeof v === 'string' ? v.trim() : ''
}

function envAnonKey(): string {
  const v = import.meta.env.VITE_SUPABASE_ANON_KEY
  return typeof v === 'string' ? v.trim() : ''
}

/** URL и ключ: сначала из полей настроек, иначе из переменных окружения Vite. */
export function resolveSupabaseConnectionStrings(
  supabaseUrlSetting: string,
  supabaseAnonKeySetting: string,
): { url: string; anonKey: string } {
  const fromSettingsUrl = supabaseUrlSetting.trim()
  const fromSettingsKey = supabaseAnonKeySetting.trim()
  return {
    url: fromSettingsUrl || envUrl(),
    anonKey: fromSettingsKey || envAnonKey(),
  }
}

/** URL и ключ: сначала из настроек (localStorage), иначе из переменных окружения Vite. */
export function getResolvedSupabaseConnection(settings: AppSettings): {
  url: string
  anonKey: string
} {
  return resolveSupabaseConnectionStrings(
    settings.supabaseUrl,
    settings.supabaseAnonKey,
  )
}

export function hasResolvedSupabaseConnection(settings: AppSettings): boolean {
  const { url, anonKey } = getResolvedSupabaseConnection(settings)
  return isSupabaseConfigFilled(url, anonKey)
}
