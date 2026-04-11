import type { SupabaseClient } from '@supabase/supabase-js'

/** Уведомление о создании сущности (Edge Function `telegram-send`, см. миграцию 007). */
export async function invokeTelegramCreateNotify(
  client: SupabaseClient,
  text: string,
): Promise<void> {
  const t = text.trim()
  if (!t) return
  try {
    const { error } = await client.functions.invoke('telegram-send', {
      body: { text: t },
    })
    if (error) {
      console.warn('[telegram-send]', error.message)
    }
  } catch (e) {
    console.warn('[telegram-send]', e)
  }
}
