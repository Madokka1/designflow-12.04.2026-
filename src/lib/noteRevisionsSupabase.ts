import type { SupabaseClient } from '@supabase/supabase-js'
import type { Note } from '../types/note'

export type NoteRevisionRow = {
  id: string
  created_at: string
}

export async function insertNoteRevision(
  client: SupabaseClient,
  userId: string,
  noteSlug: string,
  snapshot: Note,
): Promise<Error | null> {
  const { error } = await client.from('note_revisions').insert({
    user_id: userId,
    note_slug: noteSlug,
    snapshot: snapshot as unknown as Record<string, unknown>,
  })
  return error
}

/** Одна резервная копия на заметку: старые строки для slug удаляются, затем вставляется снимок. */
export async function replaceNoteRevision(
  client: SupabaseClient,
  userId: string,
  noteSlug: string,
  snapshot: Note,
): Promise<Error | null> {
  const { error: delErr } = await client
    .from('note_revisions')
    .delete()
    .eq('user_id', userId)
    .eq('note_slug', noteSlug)
  if (delErr) return delErr
  return insertNoteRevision(client, userId, noteSlug, snapshot)
}

export async function fetchNoteRevisions(
  client: SupabaseClient,
  userId: string,
  noteSlug: string,
  limit = 30,
): Promise<{ id: string; createdAt: string; snapshot: Note }[]> {
  const { data, error } = await client
    .from('note_revisions')
    .select('id, created_at, snapshot')
    .eq('user_id', userId)
    .eq('note_slug', noteSlug)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error || !data) return []
  return data.map((r: { id: string; created_at: string; snapshot: unknown }) => ({
    id: r.id,
    createdAt: new Date(r.created_at).toISOString(),
    snapshot: r.snapshot as Note,
  }))
}
