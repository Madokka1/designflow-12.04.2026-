import type { SupabaseClient } from '@supabase/supabase-js'

const LINK_TTL_MS = 15 * 60 * 1000

/** Создаёт одноразовый токен для deep link `t.me/<bot>?start=<token>`. */
export async function createTelegramLinkToken(
  client: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const token = crypto.randomUUID().replace(/-/g, '')
  const expiresAt = new Date(Date.now() + LINK_TTL_MS).toISOString()
  const { error } = await client.from('telegram_link_tokens').insert({
    user_id: userId,
    token,
    expires_at: expiresAt,
  })
  if (error) return null
  return token
}

export async function unlinkTelegramFromProfile(
  client: SupabaseClient,
  userId: string,
): Promise<Error | null> {
  const { error } = await client
    .from('profiles')
    .update({ telegram_chat_id: null })
    .eq('id', userId)
  return error
}
