import { createContext } from 'react'
import type { Note, NoteBlock, NoteBlockType } from '../types/note'

export type NotesContextValue = {
  notes: Note[]
  getNoteBySlug: (slug: string) => Note | undefined
  /** Заметки, у которых в attachedProjectSlugs есть этот проект */
  getNotesByProjectSlug: (projectSlug: string) => Note[]
  createNote: (
    partial?: Partial<Pick<Note, 'title' | 'description' | 'attachedProjectSlugs'>>,
  ) => Note
  updateNote: (
    slug: string,
    patch: Partial<
      Pick<Note, 'title' | 'description' | 'blocks' | 'attachedProjectSlugs'>
    >,
  ) => void
  deleteNote: (slug: string) => void
  /** Полная замена списка (импорт резервной копии) */
  replaceAllNotes: (next: Note[]) => void
  /** Слияние по slug: существующие заметки перезаписываются, новые добавляются. */
  mergeNotesBySlug: (incoming: Note[]) => void
  /** Убрать slug проекта из всех заметок (после удаления проекта); синхронизация с Supabase. */
  detachProjectFromNotes: (projectSlug: string) => void
}

export const NotesContext = createContext<NotesContextValue | null>(null)

export function newBlockId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `b-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function createEmptyBlock(type: NoteBlockType = 'paragraph'): NoteBlock {
  const id = newBlockId()
  switch (type) {
    case 'todo':
      return {
        id,
        type: 'todo',
        text: '',
        todos: [
          { id: newBlockId(), label: '', done: false },
          { id: newBlockId(), label: '', done: false },
          { id: newBlockId(), label: '', done: false },
        ],
      }
    case 'code':
      return { id, type: 'code', text: '', language: 'html' }
    case 'link':
      return { id, type: 'link', text: 'Ссылка', href: 'https://' }
    case 'image':
      return { id, type: 'image', text: '', href: '' }
    case 'video':
      return { id, type: 'video', text: '', href: '' }
    default:
      return { id, type, text: '' }
  }
}
