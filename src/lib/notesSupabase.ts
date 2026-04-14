import type { SupabaseClient } from '@supabase/supabase-js'
import type { Note } from '../types/note'
import { isUuid } from './isUuid'

function normalizeNoteRow(
  row: {
    id: string
    slug: string
    title: string
    description: string
    body_html?: string | null
    created_at: string
    blocks: unknown
    attached_project_slugs: unknown
  },
): Note {
  const slugs = Array.isArray(row.attached_project_slugs)
    ? row.attached_project_slugs.filter((x): x is string => typeof x === 'string')
    : []
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    bodyHtml: typeof row.body_html === 'string' ? row.body_html : '',
    createdAt: new Date(row.created_at).toISOString(),
    blocks: Array.isArray(row.blocks) ? (row.blocks as Note['blocks']) : [],
    attachedProjectSlugs: slugs,
  }
}

export async function fetchNotesFromSupabase(
  client: SupabaseClient,
  userId: string,
): Promise<Note[]> {
  const { data, error } = await client
    .from('notes')
    .select('id,slug,title,description,body_html,created_at,blocks,attached_project_slugs')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []).map((r) =>
    normalizeNoteRow(r as Parameters<typeof normalizeNoteRow>[0]),
  )
}

export async function upsertNoteToSupabase(
  client: SupabaseClient,
  userId: string,
  note: Note,
): Promise<{ id: string } | null> {
  const base: Record<string, unknown> = {
    user_id: userId,
    slug: note.slug,
    title: note.title,
    description: note.description,
    body_html: note.bodyHtml ?? '',
    created_at: note.createdAt,
    blocks: note.blocks,
    attached_project_slugs: note.attachedProjectSlugs ?? [],
  }
  if (isUuid(note.id)) {
    base.id = note.id
  }

  const { data, error } = await client
    .from('notes')
    .upsert(base, { onConflict: 'user_id,slug' })
    .select('id')
    .maybeSingle()

  if (error) {
    console.warn('[notes upsert]', error.code, error.message)
    return null
  }
  const id = data && typeof (data as { id: string }).id === 'string' ? (data as { id: string }).id : null
  return id ? { id } : null
}

export async function deleteNoteFromSupabase(
  client: SupabaseClient,
  userId: string,
  slug: string,
): Promise<Error | null> {
  const { error } = await client
    .from('notes')
    .delete()
    .eq('user_id', userId)
    .eq('slug', slug)
  return error
}
