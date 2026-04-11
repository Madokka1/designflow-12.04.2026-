import type { Note } from '../types/note'

/** Текст для полнотекстового поиска по заметке (палитра и т.п.). */
export function notePlainTextHaystack(note: Note): string {
  const parts = [note.title, note.description]
  for (const b of note.blocks) {
    parts.push(b.text)
    if (b.href) parts.push(b.href)
    if (b.todos) {
      for (const t of b.todos) {
        parts.push(t.label)
      }
    }
  }
  return parts.join('\n')
}
