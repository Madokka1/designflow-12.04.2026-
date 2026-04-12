/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  /** Переопределить имя Edge Function для уведомлений (по умолчанию portfolio-notify). */
  readonly VITE_SUPABASE_EDGE_NOTIFY_NAME?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
