import { useEffect, useMemo, useRef } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useSettings } from '../hooks/useSettings'
import {
  fetchProfileSettings,
  profileRowToSettingsPatch,
  upsertProfileSettings,
} from '../lib/profileSettingsSupabase'
import type { AppSettings } from '../types/settings'

/** Поля профиля, которые храним в `profiles` (пароль Supabase не синхронизируем). */
function settingsDbSnapshot(s: AppSettings): string {
  return JSON.stringify({
    firstName: s.firstName,
    lastName: s.lastName,
    email: s.email,
    telegram: s.telegram,
    website: s.website,
    jobTitle: s.jobTitle,
    about: s.about,
    fontFamily: s.fontFamily,
    accentColor: s.accentColor,
    theme: s.theme,
    rememberAuthPassword: s.rememberAuthPassword,
    supabaseUrl: s.supabaseUrl,
    supabaseAnonKey: s.supabaseAnonKey,
    supabaseAuthEmail: s.supabaseAuthEmail,
    readOnlyMode: s.readOnlyMode,
    telegramDeadlineNotifyEnabled: s.telegramDeadlineNotifyEnabled,
    telegramDeadlineNotifyDaysBefore: s.telegramDeadlineNotifyDaysBefore,
  })
}

/**
 * Подтягивает настройки из `profiles` после входа и сохраняет изменения в БД (debounce).
 */
export function ProfileSettingsDbSync() {
  const { client, session } = useAuth()
  const { settings, updateSettings } = useSettings()
  const userId = session?.user?.id ?? null
  const settingsRef = useRef(settings)
  const fetchedForUser = useRef<string | null>(null)
  const allowSaveRef = useRef(false)

  useEffect(() => {
    settingsRef.current = settings
  }, [settings])

  const snapshot = useMemo(() => settingsDbSnapshot(settings), [settings])

  useEffect(() => {
    allowSaveRef.current = false
    if (!client || !userId) {
      fetchedForUser.current = null
      return
    }
    if (fetchedForUser.current === userId) {
      allowSaveRef.current = true
      return
    }
    let cancelled = false
    void fetchProfileSettings(client, userId).then((row) => {
      if (cancelled) return
      if (row) updateSettings(profileRowToSettingsPatch(row))
      fetchedForUser.current = userId
      allowSaveRef.current = true
    })
    return () => {
      cancelled = true
    }
  }, [client, userId, updateSettings])

  useEffect(() => {
    if (!client || !userId) return
    const t = window.setTimeout(() => {
      if (!allowSaveRef.current) return
      if (fetchedForUser.current !== userId) return
      void upsertProfileSettings(client, settingsRef.current, userId)
    }, 650)
    return () => window.clearTimeout(t)
  }, [client, userId, snapshot])

  return null
}
