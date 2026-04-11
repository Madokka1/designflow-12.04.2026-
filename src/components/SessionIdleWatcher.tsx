import { useEffect, useRef } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useSettings } from '../hooks/useSettings'

const EVENTS = ['pointerdown', 'keydown', 'scroll', 'touchstart'] as const

export function SessionIdleWatcher() {
  const { session, signOut } = useAuth()
  const { settings } = useSettings()
  const minutes = settings.sessionIdleMinutes
  const lastActivity = useRef(0)

  useEffect(() => {
    if (!session || minutes <= 0) return

    lastActivity.current = Date.now()
    const bump = () => {
      lastActivity.current = Date.now()
    }
    for (const ev of EVENTS) {
      window.addEventListener(ev, bump, { passive: true })
    }

    const id = window.setInterval(() => {
      if (Date.now() - lastActivity.current >= minutes * 60_000) {
        void signOut()
      }
    }, 30_000)

    return () => {
      for (const ev of EVENTS) {
        window.removeEventListener(ev, bump)
      }
      window.clearInterval(id)
    }
  }, [session, minutes, signOut])

  return null
}
