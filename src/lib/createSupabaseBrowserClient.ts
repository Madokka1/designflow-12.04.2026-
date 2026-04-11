import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/** Клиент для браузера: сессия в localStorage, автообновление токена. */
export function createSupabaseBrowserClient(
  url: string,
  anonKey: string,
): SupabaseClient {
  return createClient(url.trim(), anonKey.trim(), {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })
}

export function isSupabaseConfigFilled(url: string, anonKey: string): boolean {
  return url.trim().length > 0 && anonKey.trim().length > 0
}
