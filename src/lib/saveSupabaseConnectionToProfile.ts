import type { SupabaseClient } from '@supabase/supabase-js'

/** Сохраняет URL и anon key в строке profiles (для переноса между устройствами). */
export async function saveSupabaseConnectionToProfile(
  client: SupabaseClient,
  userId: string,
  projectUrl: string,
  anonKey: string,
): Promise<{ error: Error | null }> {
  const { error } = await client
    .from('profiles')
    .update({
      supabase_project_url: projectUrl,
      supabase_anon_key: anonKey,
    })
    .eq('id', userId)

  if (error) {
    return { error: new Error(error.message) }
  }
  return { error: null }
}
