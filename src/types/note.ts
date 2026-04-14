export type NoteBlockType =
  | 'paragraph'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'h5'
  | 'h6'
  | 'todo'
  | 'code'
  | 'link'
  | 'image'
  | 'video'

export type NoteTodoItem = {
  id: string
  label: string
  done: boolean
}

export type NoteBlock = {
  id: string
  type: NoteBlockType
  /** Основной текст, код, подпись */
  text: string
  language?: 'html' | 'css' | 'js'
  /** Ссылка (link), URL или data URL изображения (image), URL видео (video) */
  href?: string
  todos?: NoteTodoItem[]
}

export type Note = {
  id: string
  slug: string
  title: string
  description: string
  /** Основное тело заметки (rich text HTML, минимальный набор тегов). */
  bodyHtml?: string
  createdAt: string
  blocks: NoteBlock[]
  /** Slug проектов, к которым прикреплена заметка */
  attachedProjectSlugs?: string[]
}
