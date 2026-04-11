import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { AuthError, Session, SupabaseClient } from '@supabase/supabase-js'
import { useSettings } from '../hooks/useSettings'
import {
  createSupabaseBrowserClient,
  isSupabaseConfigFilled,
} from '../lib/createSupabaseBrowserClient'
import { getResolvedSupabaseConnection } from '../lib/resolveSupabaseConnection'
import { AuthContext } from './authContext'

function offlineAuthError(message: string): AuthError {
  return { message, name: 'AuthError', status: 400 } as AuthError
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings()

  const client = useMemo<SupabaseClient | null>(() => {
    const { url, anonKey } = getResolvedSupabaseConnection(settings)
    if (!isSupabaseConfigFilled(url, anonKey)) return null
    try {
      return createSupabaseBrowserClient(url, anonKey)
    } catch {
      return null
    }
  }, [settings])

  const [sessionForClient, setSessionForClient] = useState<Session | null>(null)
  const [clientReady, setClientReady] = useState(false)

  const session = client ? sessionForClient : null
  const loading = Boolean(client) && !clientReady

  useEffect(() => {
    if (!client) return

    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      setSessionForClient(null)
      setClientReady(false)
    })

    void client.auth.getSession().then(({ data }) => {
      if (cancelled) return
      setSessionForClient(data.session ?? null)
      setClientReady(true)
    })

    const { data: sub } = client.auth.onAuthStateChange((_event, next) => {
      setSessionForClient(next)
      setClientReady(true)
    })

    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
  }, [client])

  const signInWithPassword = useCallback(
    (email: string, password: string) => {
      if (!client) {
        return Promise.resolve({
          data: { user: null, session: null },
          error: offlineAuthError(
            'Нет подключения к проекту: зарегистрируйтесь на этом устройстве, задайте VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY или укажите URL и ключ вручную на экране входа.',
          ),
        })
      }
      return client.auth.signInWithPassword({ email, password })
    },
    [client],
  )

  const signOut = useCallback(async () => {
    if (!client) return
    await client.auth.signOut()
  }, [client])

  const value = useMemo(
    () => ({
      client,
      session,
      loading,
      signInWithPassword,
      signOut,
    }),
    [client, session, loading, signInWithPassword, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
