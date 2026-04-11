import { useEffect, useRef } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useSettings } from '../hooks/useSettings'
import { hasResolvedSupabaseConnection } from '../lib/resolveSupabaseConnection'

/**
 * Если в localStorage пусто, но клиент есть (например из VITE_SUPABASE_*),
 * подтягиваем URL/key из profiles после входа.
 */
export function ProfileConnectionSync() {
  const { client, session } = useAuth()
  const { settings, updateSettings } = useSettings()
  const attemptedForUser = useRef<string | null>(null)

  useEffect(() => {
    const uid = session?.user?.id
    if (!uid) {
      attemptedForUser.current = null
      return
    }
    if (!client) return

    if (hasResolvedSupabaseConnection(settings)) {
      attemptedForUser.current = uid
      return
    }

    if (attemptedForUser.current === uid) return
    attemptedForUser.current = uid

    let cancelled = false
    void client
      .from('profiles')
      .select('supabase_project_url, supabase_anon_key')
      .eq('id', uid)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled || error || !data) return
        const u = data.supabase_project_url?.trim() ?? ''
        const k = data.supabase_anon_key?.trim() ?? ''
        if (u && k) {
          updateSettings({ supabaseUrl: u, supabaseAnonKey: k })
        }
      })

    return () => {
      cancelled = true
    }
  }, [client, session?.user?.id, settings, updateSettings])

  return null
}
