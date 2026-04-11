import { useEffect, useState } from 'react'

export function OfflineBanner() {
  const [online, setOnline] = useState(
    () => typeof navigator !== 'undefined' && navigator.onLine,
  )

  useEffect(() => {
    const up = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [])

  if (online) return null

  return (
    <div
      className="relative z-[60] mx-auto w-full max-w-[1840px] px-4 pt-2 sm:px-10"
      role="status"
    >
      <p className="border border-amber-700/35 bg-amber-500/15 px-4 py-2 text-center text-xs font-light text-amber-950 dark:border-amber-400/25 dark:bg-amber-400/10 dark:text-amber-100">
        Нет сети. Данные из кэша могут отображаться неполно; синхронизация с Supabase
        недоступна, пока соединение не восстановится.
      </p>
    </div>
  )
}
