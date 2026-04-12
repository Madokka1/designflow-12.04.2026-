import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { Note } from '../types/note'
import { useAuth } from '../hooks/useAuth'
import { useSettings } from '../hooks/useSettings'
import { newNoteId } from '../lib/newNoteId'
import { insertNoteRevision } from '../lib/noteRevisionsSupabase'
import {
  deleteNoteFromSupabase,
  fetchNotesFromSupabase,
  upsertNoteToSupabase,
} from '../lib/notesSupabase'
import { useRemoteSync } from './remoteSyncContext'
import {
  createEmptyBlock,
  newBlockId,
  NotesContext,
} from './notesContext'

const STORAGE_KEY = 'portfolio-notes-v2'
/** Не чаще одной ревизии на заметку (снимок до сохранения), чтобы не забивать БД при автосохранении. */
const NOTE_REVISION_MIN_INTERVAL_MS = 90_000

function noteSlug(title: string): string {
  const base =
    title
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9а-яё]+/gi, '-')
      .replace(/^-|-$/g, '') || 'zametka'
  return `${base}-${newBlockId().slice(0, 6)}`
}

function normalizeNote(n: Note): Note {
  return {
    ...n,
    attachedProjectSlugs: Array.isArray(n.attachedProjectSlugs)
      ? n.attachedProjectSlugs
      : [],
  }
}

function loadNotes(): Note[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Note[]
    if (!Array.isArray(parsed)) return []
    return parsed.map((n) => normalizeNote(n))
  } catch {
    return []
  }
}

function saveNotes(notes: Note[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes))
  } catch {
    /* ignore */
  }
}

export function NotesProvider({ children }: { children: ReactNode }) {
  const { client, session } = useAuth()
  const userId = session?.user?.id ?? null
  const { settings } = useSettings()
  const readOnly = settings.readOnlyMode
  const { setPortfolioSync, touchSaved } = useRemoteSync()

  const [notes, setNotes] = useState<Note[]>(() => loadNotes())
  const notesMergedForUser = useRef<string | null>(null)
  const readOnlyPrev = useRef(readOnly)
  const noteRevisionLastAtRef = useRef<Map<string, number>>(new Map())

  useEffect(() => {
    saveNotes(notes)
  }, [notes])

  useEffect(() => {
    if (userId) return
    notesMergedForUser.current = null
  }, [userId])

  useEffect(() => {
    if (readOnlyPrev.current && !readOnly) {
      notesMergedForUser.current = null
    }
    readOnlyPrev.current = readOnly
  }, [readOnly])

  useEffect(() => {
    if (!client || !userId) return
    if (notesMergedForUser.current === userId) return
    let cancelled = false
    void (async () => {
      try {
        const remote = await fetchNotesFromSupabase(client, userId)
        if (cancelled) return
        const local = loadNotes()
        const bySlug = new Map(remote.map((n) => [n.slug, n]))
        const merged: Note[] = [...remote]
        for (const n of local) {
          if (bySlug.has(n.slug)) continue
          merged.push(n)
          if (!readOnly) {
            const res = await upsertNoteToSupabase(client, userId, n)
            if (res && res.id !== n.id) {
              const idx = merged.findIndex((x) => x.slug === n.slug)
              if (idx >= 0) {
                merged[idx] = { ...merged[idx], id: res.id }
              }
            }
          }
        }
        merged.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        if (!cancelled) {
          setNotes(merged)
          notesMergedForUser.current = userId
        }
      } catch {
        if (!cancelled) notesMergedForUser.current = userId
      }
    })()
    return () => {
      cancelled = true
    }
  }, [client, userId, readOnly])

  const getNoteBySlug = useCallback(
    (slug: string) => notes.find((n) => n.slug === slug),
    [notes],
  )

  const getNotesByProjectSlug = useCallback(
    (projectSlug: string) =>
      notes.filter((n) => (n.attachedProjectSlugs ?? []).includes(projectSlug)),
    [notes],
  )

  const createNote = useCallback(
    (
      partial?: Partial<
        Pick<Note, 'title' | 'description' | 'attachedProjectSlugs'>
      >,
    ) => {
      const id = newNoteId()
      const title = partial?.title?.trim() || 'Без названия'
      const slug = noteSlug(title)
      const note: Note = {
        id,
        slug,
        title,
        description: partial?.description ?? 'Описание',
        createdAt: new Date().toISOString(),
        blocks: [createEmptyBlock('paragraph')],
        attachedProjectSlugs: partial?.attachedProjectSlugs?.length
          ? [...partial.attachedProjectSlugs]
          : [],
      }
      setNotes((prev) => [note, ...prev])
      if (client && userId && !readOnly) {
        setPortfolioSync({ kind: 'saving' })
        void upsertNoteToSupabase(client, userId, note).then((res) => {
          if (!res) {
            setPortfolioSync({
              kind: 'error',
              message: 'Не удалось сохранить заметку в Supabase',
            })
            return
          }
          if (res.id !== note.id) {
            setNotes((prev) =>
              prev.map((x) => (x.slug === note.slug ? { ...x, id: res.id } : x)),
            )
          }
          touchSaved()
        })
      }
      return note
    },
    [client, userId, readOnly, setPortfolioSync, touchSaved],
  )

  const updateNote = useCallback(
    (
      slug: string,
      patch: Partial<
        Pick<Note, 'title' | 'description' | 'blocks' | 'attachedProjectSlugs'>
      >,
    ) => {
      setNotes((prev) => {
        const prevNote = prev.find((n) => n.slug === slug)
        const next = prev.map((n) => (n.slug === slug ? { ...n, ...patch } : n))
        const updated = next.find((n) => n.slug === slug)
        if (updated && prevNote && client && userId && !readOnly) {
          const snapshot =
            typeof structuredClone === 'function'
              ? structuredClone(prevNote)
              : (JSON.parse(JSON.stringify(prevNote)) as Note)
          queueMicrotask(() => {
            void (async () => {
              setPortfolioSync({ kind: 'saving' })
              const now = Date.now()
              const last = noteRevisionLastAtRef.current.get(slug) ?? 0
              if (now - last >= NOTE_REVISION_MIN_INTERVAL_MS) {
                noteRevisionLastAtRef.current.set(slug, now)
                const revErr = await insertNoteRevision(
                  client,
                  userId,
                  slug,
                  snapshot,
                )
                if (revErr) {
                  console.warn('[note revision]', revErr.message)
                }
              }
              const res = await upsertNoteToSupabase(client, userId, updated)
              if (!res) {
                setPortfolioSync({
                  kind: 'error',
                  message: 'Не удалось сохранить заметку в Supabase',
                })
                return
              }
              if (res.id !== updated.id) {
                setNotes((p) =>
                  p.map((x) => (x.slug === slug ? { ...x, id: res.id } : x)),
                )
              }
              touchSaved()
            })()
          })
        }
        return next
      })
    },
    [client, userId, readOnly, setPortfolioSync, touchSaved],
  )

  const deleteNote = useCallback(
    (slug: string) => {
      setNotes((prev) => prev.filter((n) => n.slug !== slug))
      if (client && userId && !readOnly) {
        void deleteNoteFromSupabase(client, userId, slug)
      }
    },
    [client, userId, readOnly],
  )

  const replaceAllNotes = useCallback((next: Note[]) => {
    setNotes(next.map(normalizeNote))
  }, [])

  const mergeNotesBySlug = useCallback((incoming: Note[]) => {
    setNotes((prev) => {
      const bySlug = new Map(prev.map((n) => [n.slug, n]))
      const order = prev.map((n) => n.slug)
      const seen = new Set(order)
      for (const n of incoming) {
        const x = normalizeNote(n)
        if (!seen.has(x.slug)) {
          order.unshift(x.slug)
          seen.add(x.slug)
        }
        bySlug.set(x.slug, x)
      }
      return order
        .map((slug) => bySlug.get(slug)!)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    })
  }, [])

  const detachProjectFromNotes = useCallback(
    (projectSlug: string) => {
      setNotes((prev) => {
        const next = prev.map((n) => {
          const slugs = n.attachedProjectSlugs ?? []
          if (!slugs.includes(projectSlug)) return n
          return {
            ...n,
            attachedProjectSlugs: slugs.filter((s) => s !== projectSlug),
          }
        })
        const changedSlugs = new Set<string>()
        for (let i = 0; i < prev.length; i++) {
          if (prev[i] !== next[i]) changedSlugs.add(prev[i].slug)
        }
        if (changedSlugs.size && client && userId && !readOnly) {
          setPortfolioSync({ kind: 'saving' })
          queueMicrotask(() => {
            void (async () => {
              try {
                for (const slug of changedSlugs) {
                  const n = next.find((x) => x.slug === slug)
                  if (n) {
                    const res = await upsertNoteToSupabase(client, userId, n)
                    if (!res) {
                      setPortfolioSync({
                        kind: 'error',
                        message: 'Не удалось обновить привязку заметок в Supabase',
                      })
                      return
                    }
                  }
                }
                touchSaved()
              } catch {
                setPortfolioSync({
                  kind: 'error',
                  message: 'Не удалось обновить привязку заметок в Supabase',
                })
              }
            })()
          })
        }
        return next
      })
    },
    [client, userId, readOnly, setPortfolioSync, touchSaved],
  )

  const value = useMemo(
    () => ({
      notes,
      getNoteBySlug,
      getNotesByProjectSlug,
      createNote,
      updateNote,
      deleteNote,
      replaceAllNotes,
      mergeNotesBySlug,
      detachProjectFromNotes,
    }),
    [
      notes,
      getNoteBySlug,
      getNotesByProjectSlug,
      createNote,
      updateNote,
      deleteNote,
      replaceAllNotes,
      mergeNotesBySlug,
      detachProjectFromNotes,
    ],
  )

  return (
    <NotesContext.Provider value={value}>{children}</NotesContext.Provider>
  )
}
