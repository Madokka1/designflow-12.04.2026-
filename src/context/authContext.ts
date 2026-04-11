import { createContext } from 'react'
import type { Session, SupabaseClient } from '@supabase/supabase-js'

export type AuthMode = 'login' | 'register'

export type AuthContextValue = {
  client: SupabaseClient | null
  session: Session | null
  loading: boolean
  signInWithPassword: (
    email: string,
    password: string,
  ) => ReturnType<SupabaseClient['auth']['signInWithPassword']>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
