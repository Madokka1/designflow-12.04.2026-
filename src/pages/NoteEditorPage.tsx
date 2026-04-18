import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useSettings } from '../hooks/useSettings'
import {
  fetchNoteRevisions,
  replaceNoteRevision,
} from '../lib/noteRevisionsSupabase'
import { NoteEditMetaModal } from '../components/NoteEditMetaModal'
import {
  BlockInsertMenu,
  type MenuAnchor,
} from '../components/notes/BlockInsertMenu'
import { NoteBlockRead } from '../components/notes/NoteBlockRead'
import { VideoEmbed } from '../components/notes/VideoEmbed'
import { newBlockId } from '../context/notesContext'
import { useNotesContext } from '../hooks/useNotesContext'
import { useProjects } from '../hooks/useProjects'
import type { Note, NoteBlock, NoteTodoItem } from '../types/note'

const BORDER = 'border-card-border'

function useAutosizeTextarea(
  ref: React.RefObject<HTMLTextAreaElement | null>,
  value: string,
) {
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    // Сначала "сжать", потом выставить по контенту.
    el.style.height = '0px'
    const next = Math.max(el.scrollHeight, 0)
    el.style.height = `${next}px`
  }, [ref, value])
}

function escapeHtmlText(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function paragraphTextToHtml(s: string): string {
  const t = s.trim()
  if (!t) return ''
  // Старые заметки: обычный текст → <br> переносы.
  return escapeHtmlText(s).replaceAll('\n', '<br>')
}

const ALLOWED_TAGS = new Set([
  'BR',
  'P',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'UL',
  'OL',
  'LI',
  'B',
  'STRONG',
  'I',
  'EM',
  'U',
  'S',
  'DEL',
  'A',
  'SPAN',
])

function sanitizeRichHtml(html: string): string {
  if (!html.trim()) return ''
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const body = doc.body

  const walk = (node: Node) => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement
      if (!ALLOWED_TAGS.has(el.tagName)) {
        const frag = doc.createDocumentFragment()
        while (el.firstChild) frag.appendChild(el.firstChild)
        el.replaceWith(frag)
        return
      }
      if (el.tagName === 'A') {
        const href = (el.getAttribute('href') ?? '').trim()
        // только http(s)
        if (!/^https?:\/\//i.test(href)) {
          el.removeAttribute('href')
        }
        el.setAttribute('target', '_blank')
        el.setAttribute('rel', 'noopener noreferrer')
      }
      // чистим все атрибуты кроме href/target/rel у A
      for (const attr of [...el.attributes]) {
        const name = attr.name.toLowerCase()
        if (el.tagName === 'A' && (name === 'href' || name === 'target' || name === 'rel')) {
          continue
        }
        el.removeAttribute(attr.name)
      }
    }
    for (const child of [...node.childNodes]) walk(child)
  }
  // Важно: не "заменять" сам body, иначе потеряем ссылку на него.
  for (const child of [...body.childNodes]) walk(child)

  // Нормализуем пустые <div>/<p> в <br> и убираем внешние обёртки.
  const out = body.innerHTML
    .replaceAll(/<(div|p)><br><\/(div|p)>/gi, '<br>')
    .replaceAll(/<\/?div>/gi, '')
  return out.trim()
}

function selectionIsInside(root: HTMLElement | null): boolean {
  if (!root) return false
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return false
  const range = sel.getRangeAt(0)
  const node = range.commonAncestorContainer
  const el = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement
  return !!el && root.contains(el)
}

function formatBlockValue(raw: string): string {
  const v = raw.trim().toLowerCase()
  if (!v) return 'p'
  if (/^h[1-6]$/.test(v)) return v
  return 'p'
}

function formatCreated(iso: string) {
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  } catch {
    return '—'
  }
}

function formatRevisionAt(iso: string) {
  try {
    return new Date(iso).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function readImageFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('not an image'))
      return
    }
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('read failed'))
    reader.readAsDataURL(file)
  })
}

export function NoteEditorPage() {
  const { noteSlug } = useParams<{ noteSlug: string }>()
  const { client, session } = useAuth()
  const { settings } = useSettings()
  const readOnly = settings.readOnlyMode
  const userId = session?.user?.id ?? null
  const { getNoteBySlug, updateNote, deleteNote } = useNotesContext()
  const { projects } = useProjects()
  const navigate = useNavigate()
  const note = noteSlug ? getNoteBySlug(noteSlug) : undefined

  const [revisions, setRevisions] = useState<
    { id: string; createdAt: string; snapshot: Note }[]
  >([])
  const [revLoading, setRevLoading] = useState(false)

  const [draft, setDraft] = useState<Note | null>(null)
  const [previewMode, setPreviewMode] = useState(false)
  const [menu, setMenu] = useState<{
    blockIndex: number
    anchor: MenuAnchor
  } | null>(null)
  const [metaModalOpen, setMetaModalOpen] = useState(false)
  /** Индекс вставки без вложенного setState (избегает двойного вызова в Strict Mode) */
  const insertMenuRef = useRef<{ blockIndex: number } | null>(null)
  const bodyRef = useRef<HTMLDivElement | null>(null)
  const bodyHydratedRef = useRef(false)
  const [rtToolbar, setRtToolbar] = useState<{
    open: boolean
    top: number
    left: number
  }>({ open: false, top: 0, left: 0 })

  useLayoutEffect(() => {
    if (!noteSlug || !note) {
      setDraft(null)
      return
    }
    setDraft({
      ...note,
      attachedProjectSlugs: [...(note.attachedProjectSlugs ?? [])],
      blocks: note.blocks.map((b) => ({
        ...b,
        todos: b.todos?.map((t) => ({ ...t })),
      })),
    })
    // Только смена заметки по slug/id, не перезапись при автосохранении в контекст
    // eslint-disable-next-line react-hooks/exhaustive-deps -- note.blocks обновляются из draft
  }, [noteSlug, note?.id])

  useLayoutEffect(() => {
    if (!draft) return
    const el = bodyRef.current
    if (!el) return
    // Гидрируем HTML в contentEditable, когда он (пере)смонтировался пустым
    // (например, после переключения Предпросмотр → Редактирование).
    if (previewMode) return
    const current = el.innerHTML.trim()
    if (bodyHydratedRef.current && current) return
    el.innerHTML = sanitizeRichHtml(draft.bodyHtml ?? '')
    bodyHydratedRef.current = true
  }, [draft?.id, previewMode])

  useEffect(() => {
    // После возврата из предпросмотра contentEditable создаётся заново — разрешаем гидрацию.
    if (!previewMode) {
      bodyHydratedRef.current = false
    }
  }, [previewMode, draft?.id])

  useEffect(() => {
    const updateToolbar = () => {
      const root = bodyRef.current
      const sel = window.getSelection()
      if (!root || !sel || sel.rangeCount === 0 || sel.isCollapsed) {
        setRtToolbar((s) => (s.open ? { ...s, open: false } : s))
        return
      }
      if (!selectionIsInside(root)) {
        setRtToolbar((s) => (s.open ? { ...s, open: false } : s))
        return
      }
      const range = sel.getRangeAt(0)
      const rect = range.getBoundingClientRect()
      if (!rect || rect.width === 0 && rect.height === 0) {
        setRtToolbar((s) => (s.open ? { ...s, open: false } : s))
        return
      }
      // Позиционируем по центру над выделением.
      const top = Math.max(10, rect.top - 44)
      const left = Math.max(10, Math.min(window.innerWidth - 10, rect.left + rect.width / 2))
      setRtToolbar({ open: true, top, left })
    }

    const onSel = () => updateToolbar()
    document.addEventListener('selectionchange', onSel)
    window.addEventListener('scroll', onSel, true)
    window.addEventListener('resize', onSel)
    return () => {
      document.removeEventListener('selectionchange', onSel)
      window.removeEventListener('scroll', onSel, true)
      window.removeEventListener('resize', onSel)
    }
  }, [])

  const applyBodyHtmlFromDom = useCallback(() => {
    const el = bodyRef.current
    if (!el || !noteSlug) return
    const html = sanitizeRichHtml(el.innerHTML)
    setDraft((d) => (d ? { ...d, bodyHtml: html } : d))
    updateNote(noteSlug, { bodyHtml: html })
  }, [noteSlug, updateNote])

  const exec = useCallback(
    (cmd: string, value?: string) => {
      // execCommand работает только по фокусу в contentEditable
      bodyRef.current?.focus()
      if (value !== undefined) {
        if (cmd === 'formatBlock') {
          const tag = formatBlockValue(value)
          document.execCommand(cmd, false, `<${tag}>`)
        } else {
          document.execCommand(cmd, false, value)
        }
      }
      else document.execCommand(cmd)
      applyBodyHtmlFromDom()
    },
    [applyBodyHtmlFromDom],
  )

  const persist = useCallback(
    (next: Note) => {
      if (!noteSlug) return
      updateNote(noteSlug, {
        title: next.title,
        description: next.description,
        bodyHtml: next.bodyHtml ?? '',
        blocks: next.blocks,
        attachedProjectSlugs: [...(next.attachedProjectSlugs ?? [])],
      })
    },
    [noteSlug, updateNote],
  )

  useEffect(() => {
    if (!draft || !noteSlug) return
    const t = window.setTimeout(() => persist(draft), 450)
    return () => window.clearTimeout(t)
  }, [draft, noteSlug, persist])

  useEffect(() => {
    if (previewMode) {
      insertMenuRef.current = null
      setMenu(null)
      setMetaModalOpen(false)
    }
  }, [previewMode])

  useEffect(() => {
    if (!noteSlug || !client || !userId) {
      setRevisions([])
      setRevLoading(false)
      return
    }
    let cancelled = false
    setRevLoading(true)
    void fetchNoteRevisions(client, userId, noteSlug).then((list) => {
      if (!cancelled) {
        setRevisions(list)
        setRevLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [noteSlug, client, userId])

  const toggleProjectAttachment = useCallback((projectSlug: string) => {
    setDraft((d) => {
      if (!d) return d
      const cur = d.attachedProjectSlugs ?? []
      const next = cur.includes(projectSlug)
        ? cur.filter((s) => s !== projectSlug)
        : [...cur, projectSlug]
      return { ...d, attachedProjectSlugs: next }
    })
  }, [])

  const closeInsertMenu = useCallback(() => {
    insertMenuRef.current = null
    setMenu(null)
  }, [])

  const openMenu = useCallback((blockIndex: number, el: HTMLElement) => {
    const r = el.getBoundingClientRect()
    insertMenuRef.current = { blockIndex }
    setMenu({
      blockIndex,
      anchor: {
        top: r.bottom,
        left: r.left,
        width: r.width,
      },
    })
  }, [])

  const applyPickedBlock = useCallback((block: NoteBlock) => {
    const ctx = insertMenuRef.current
    if (!ctx) return
    const i = ctx.blockIndex
    insertMenuRef.current = null
    setMenu(null)
    setDraft((d) => {
      if (!d) return d
      const blocks = [...d.blocks]
      blocks.splice(i + 1, 0, block)
      return { ...d, blocks }
    })
  }, [])

  const updateBlock = useCallback((index: number, block: NoteBlock) => {
    setDraft((d) => {
      if (!d) return d
      const blocks = [...d.blocks]
      blocks[index] = block
      return { ...d, blocks }
    })
  }, [])

  const removeBlock = useCallback((index: number) => {
    setDraft((d) => {
      if (!d) return d
      const next = d.blocks.filter((_, i) => i !== index)
      return { ...d, blocks: next }
    })
  }, [])

  if (!noteSlug || !note) {
    return <Navigate to="/notes" replace />
  }

  if (!draft) {
    return null
  }

  return (
    <main className="relative z-10 mx-auto flex h-full w-full max-w-[1840px] flex-1 flex-col overflow-hidden px-4 pt-8 sm:px-10 sm:pt-10">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex max-w-[487px] flex-col gap-5">
          <h1 className="text-[clamp(2rem,5vw,4rem)] font-light leading-[0.9] tracking-[-0.09em]">
            {draft.title.trim() || 'Без названия'}
          </h1>
          <p className="line-clamp-2 text-[32px] font-light leading-[0.9] tracking-[-0.09em] text-ink/80">
            {draft.description.trim() || 'Без описания'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={`h-8 shrink-0 rounded-full px-5 text-sm font-light tracking-[-0.05em] transition-opacity ${
              !previewMode
                ? 'bg-fill-contrast-bg text-fill-contrast-fg hover:opacity-90'
                : 'border border-[rgba(10,10,10,0.32)] text-ink hover:bg-ink/[0.04]'
            }`}
            onClick={() => setPreviewMode(false)}
          >
            Редактирование
          </button>
          <button
            type="button"
            className={`h-8 shrink-0 rounded-full px-5 text-sm font-light tracking-[-0.05em] transition-opacity ${
              previewMode
                ? 'bg-fill-contrast-bg text-fill-contrast-fg hover:opacity-90'
                : 'border border-[rgba(10,10,10,0.32)] text-ink hover:bg-ink/[0.04]'
            }`}
            onClick={() => setPreviewMode(true)}
          >
            Предпросмотр
          </button>
          <button
            type="button"
            className="h-8 shrink-0 rounded-full border border-[rgba(10,10,10,0.32)] px-4 text-sm font-light tracking-[-0.05em] text-ink hover:bg-ink/[0.04]"
            onClick={() =>
              document.getElementById('note-body')?.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
              })
            }
          >
            К содержимому
          </button>
          <button
            type="button"
            className="h-8 shrink-0 rounded-full border border-[rgba(10,10,10,0.32)] px-4 text-sm font-light tracking-[-0.05em] text-ink hover:bg-ink/[0.04] disabled:opacity-40"
            disabled={readOnly || !client || !userId}
            title="Записать в Supabase одну резервную копию (предыдущая для этой заметки будет заменена)"
            onClick={() => {
              if (!noteSlug || !client || !userId || !draft) return
              void (async () => {
                const err = await replaceNoteRevision(client, userId, noteSlug, draft)
                if (err) window.alert(err.message)
                else {
                  const list = await fetchNoteRevisions(client, userId, noteSlug)
                  setRevisions(list)
                }
              })()
            }}
          >
            Сохранить копию
          </button>
        </div>
      </div>

      <div className="mt-10 mb-10 flex min-h-0 flex-1 flex-col gap-6 xl:flex-row xl:items-start xl:gap-10">
        <aside
          className={`w-full shrink-0 border ${BORDER} p-5 xl:max-w-[445px]`}
        >
          {previewMode ? (
            <div className="flex flex-col gap-3">
              <h2 className="text-[32px] font-light leading-[0.9] tracking-[-0.09em] text-ink">
                {draft.title.trim() || 'Без названия'}
              </h2>
              <p className="text-base font-light leading-[1.35] tracking-[-0.09em] text-ink/85 whitespace-pre-wrap">
                {draft.description.trim() || '—'}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-3">
                <h2 className="text-[32px] font-light leading-[0.9] tracking-[-0.09em] text-ink">
                  {draft.title.trim() || 'Без названия'}
                </h2>
                <p className="text-base font-light leading-[1.35] tracking-[-0.09em] text-ink/85 whitespace-pre-wrap">
                  {draft.description.trim() || '—'}
                </p>
              </div>
              {!readOnly ? (
                <button
                  type="button"
                  className="h-8 w-fit shrink-0 rounded-full border border-card-border px-4 text-sm font-light tracking-[-0.04em] text-ink transition-colors hover:bg-ink/[0.04]"
                  onClick={() => setMetaModalOpen(true)}
                >
                  Редактировать заметку
                </button>
              ) : null}
            </div>
          )}
          <p className="mt-6 text-[10px] font-light uppercase leading-none tracking-[-0.02em] text-ink/70">
            Дата создания: {formatCreated(draft.createdAt)}
          </p>
          <div className="mt-8 border-t border-[rgba(10,10,10,0.15)] pt-6">
            <p className="text-[10px] font-light uppercase leading-none tracking-[-0.02em] text-ink/70">
              Проекты
            </p>
            {previewMode ? (
              <ul className="mt-3 flex flex-col gap-2">
                {(draft.attachedProjectSlugs ?? []).length === 0 ? (
                  <li className="text-sm font-light text-ink/45">
                    Не прикреплено
                  </li>
                ) : (
                  (draft.attachedProjectSlugs ?? []).map((ps) => {
                    const p = projects.find((x) => x.slug === ps)
                    return (
                      <li key={ps}>
                        {p ? (
                          <Link
                            to={`/projects/${ps}`}
                            className="text-sm font-light tracking-[-0.02em] text-ink underline-offset-4 hover:underline"
                          >
                            {p.title}
                          </Link>
                        ) : (
                          <span className="text-sm font-light text-ink/50">
                            {ps}
                          </span>
                        )}
                      </li>
                    )
                  })
                )}
              </ul>
            ) : (
              <ul className="mt-3 flex max-h-[220px] flex-col gap-2.5 overflow-y-auto pr-1">
                {projects.length === 0 ? (
                  <li className="text-sm font-light text-ink/45">
                    Нет проектов
                  </li>
                ) : (
                  [...projects]
                    .sort((a, b) => a.title.localeCompare(b.title, 'ru'))
                    .map((p) => (
                      <li key={p.id}>
                        <label className="flex cursor-pointer items-start gap-2.5 text-sm font-light tracking-[-0.02em] text-ink">
                          <input
                            type="checkbox"
                            className="mt-1 shrink-0 rounded-[3px] border border-[rgba(10,10,10,0.35)]"
                            checked={(draft.attachedProjectSlugs ?? []).includes(
                              p.slug,
                            )}
                            onChange={() => toggleProjectAttachment(p.slug)}
                          />
                          <span className="min-w-0 leading-snug">{p.title}</span>
                        </label>
                      </li>
                    ))
                )}
              </ul>
            )}
          </div>

          <div className="mt-8 border-t border-[rgba(10,10,10,0.15)] pt-6 dark:border-white/10">
            <p className="text-[10px] font-light uppercase leading-none tracking-[-0.02em] text-ink/70">
              Резервная копия (Supabase)
            </p>
            {readOnly ? (
              <p className="mt-2 text-xs font-light text-ink/45">
                В режиме только чтения копию в облако записать нельзя.
              </p>
            ) : null}
            {revLoading ? (
              <p className="mt-2 text-xs font-light text-ink/45">Загрузка…</p>
            ) : revisions.length === 0 ? (
              <p className="mt-2 text-xs font-light text-ink/45">
                Копия не создана. Нажмите «Сохранить копию» выше — в облаке хранится
                не больше одного снимка на заметку; при повторном сохранении он
                перезаписывается.
              </p>
            ) : (
              <ul className="mt-3 flex max-h-[220px] flex-col gap-2 overflow-y-auto pr-1">
                {revisions.map((r) => (
                  <li
                    key={r.id}
                    className="flex flex-col gap-1.5 border border-card-border p-2.5"
                  >
                    <span className="text-[10px] font-light text-ink/55">
                      {formatRevisionAt(r.createdAt)}
                    </span>
                    <button
                      type="button"
                      className="text-left text-xs font-light text-ink underline-offset-2 hover:underline disabled:opacity-40"
                      disabled={previewMode || readOnly || !noteSlug}
                      onClick={() => {
                        if (
                          !window.confirm(
                            'Заменить текущее содержимое заметки на эту версию?',
                          )
                        ) {
                          return
                        }
                        const snap = r.snapshot
                        const blocks = snap.blocks.map((b) => ({
                          ...b,
                          todos: b.todos?.map((t) => ({ ...t })),
                        }))
                        const attached = [...(snap.attachedProjectSlugs ?? [])]
                        updateNote(noteSlug, {
                          title: snap.title,
                          description: snap.description,
                        bodyHtml: (snap as { bodyHtml?: string }).bodyHtml ?? '',
                          blocks,
                          attachedProjectSlugs: attached,
                        })
                        setDraft((d) =>
                          d
                            ? {
                                ...d,
                                title: snap.title,
                                description: snap.description,
                              bodyHtml: (snap as { bodyHtml?: string }).bodyHtml ?? '',
                                blocks,
                                attachedProjectSlugs: attached,
                              }
                            : d,
                        )
                        if (client && userId) {
                          void fetchNoteRevisions(client, userId, noteSlug).then(
                            setRevisions,
                          )
                        }
                      }}
                    >
                      Восстановить
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Link
            to="/notes"
            className="mt-8 inline-flex text-sm font-light tracking-[-0.02em] text-ink underline-offset-4 hover:underline"
          >
            ← К списку заметок
          </Link>
        </aside>

        <section
          id="note-body"
          className={`min-w-0 flex h-full flex-1 flex-col overflow-y-auto border ${BORDER} px-5 pb-10 pt-5 sm:px-5 sm:pb-10 sm:pt-5`}
        >
          <h2 className="text-[32px] font-light leading-[0.9] tracking-[-0.09em]">
            Содержимое
          </h2>

          <div className="group mt-10 flex min-h-0 flex-1 flex-col gap-2 border-t border-[rgba(10,10,10,0.32)] pt-5">
            {rtToolbar.open && !previewMode ? (
              <div
                className="fixed z-[95] -translate-x-1/2 rounded-[3px] border border-card-border bg-surface/95 p-1 shadow-[0_8px_32px_rgba(10,10,10,0.12)] backdrop-blur-[20px]"
                style={{ top: rtToolbar.top, left: rtToolbar.left }}
                role="toolbar"
                aria-label="Форматирование"
              >
                <div className="flex items-center gap-1">
                  <select
                    className="h-8 rounded-[3px] border border-card-border bg-surface px-2 text-xs font-light text-ink"
                    defaultValue="P"
                    onChange={(e) => exec('formatBlock', e.target.value)}
                    onMouseDown={(e) => e.stopPropagation()}
                    aria-label="Стиль"
                  >
                    <option value="P">Текст</option>
                    <option value="H1">H1</option>
                    <option value="H2">H2</option>
                    <option value="H3">H3</option>
                    <option value="H4">H4</option>
                    <option value="H5">H5</option>
                    <option value="H6">H6</option>
                  </select>

                  <div className="mx-1 h-6 w-px bg-ink/10" aria-hidden />

                  <button
                    type="button"
                    className="h-8 rounded-[3px] px-2 text-xs font-light text-ink hover:bg-ink/[0.05]"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => exec('bold')}
                    aria-label="Жирный"
                  >
                    <span className="font-semibold">B</span>
                  </button>
                  <button
                    type="button"
                    className="h-8 rounded-[3px] px-2 text-xs font-light text-ink hover:bg-ink/[0.05]"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => exec('italic')}
                    aria-label="Курсив"
                  >
                    <span className="italic">I</span>
                  </button>
                  <button
                    type="button"
                    className="h-8 rounded-[3px] px-2 text-xs font-light text-ink hover:bg-ink/[0.05]"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => exec('underline')}
                    aria-label="Подчёркнутый"
                  >
                    <span className="underline underline-offset-2">U</span>
                  </button>
                  <button
                    type="button"
                    className="h-8 rounded-[3px] px-2 text-xs font-light text-ink hover:bg-ink/[0.05]"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => exec('strikeThrough')}
                    aria-label="Зачёркнутый"
                  >
                    <span className="line-through">S</span>
                  </button>

                  <div className="mx-1 h-6 w-px bg-ink/10" aria-hidden />

                  <button
                    type="button"
                    className="h-8 rounded-[3px] px-2 text-xs font-light text-ink hover:bg-ink/[0.05]"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      const url = window.prompt('Ссылка (https://...)', 'https://')?.trim()
                      if (!url) return
                      exec('createLink', url)
                    }}
                    aria-label="Ссылка"
                  >
                    🔗
                  </button>

                  <button
                    type="button"
                    className="h-8 rounded-[3px] px-2 text-xs font-light text-ink hover:bg-ink/[0.05]"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => exec('insertUnorderedList')}
                    aria-label="Маркированный список"
                  >
                    ••
                  </button>
                  <button
                    type="button"
                    className="h-8 rounded-[3px] px-2 text-xs font-light text-ink hover:bg-ink/[0.05]"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => exec('insertOrderedList')}
                    aria-label="Нумерованный список"
                  >
                    1.
                  </button>
                </div>
              </div>
            ) : null}

            {previewMode ? (
              <div
                className="whitespace-pre-wrap text-base font-light leading-[1.45] tracking-[-0.09em] text-ink [&_h1]:text-[32px] [&_h1]:leading-[0.9] [&_h1]:tracking-[-0.09em] [&_h1]:font-light [&_h1]:mt-6 [&_h1]:mb-2 [&_h2]:text-[28px] [&_h2]:leading-[0.9] [&_h2]:tracking-[-0.09em] [&_h2]:font-light [&_h2]:mt-5 [&_h2]:mb-2 [&_h3]:text-2xl [&_h3]:leading-[0.95] [&_h3]:tracking-[-0.07em] [&_h3]:font-light [&_h3]:mt-4 [&_h3]:mb-2 [&_h4]:text-xl [&_h4]:leading-[0.95] [&_h4]:tracking-[-0.06em] [&_h4]:font-light [&_h4]:mt-4 [&_h4]:mb-1 [&_h5]:text-lg [&_h5]:leading-[1.05] [&_h5]:tracking-[-0.05em] [&_h5]:font-light [&_h5]:mt-3 [&_h5]:mb-1 [&_h6]:text-base [&_h6]:leading-[1.1] [&_h6]:tracking-[-0.05em] [&_h6]:font-light [&_h6]:mt-3 [&_h6]:mb-1 [&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1"
                dangerouslySetInnerHTML={{
                  __html: sanitizeRichHtml(draft.bodyHtml ?? ''),
                }}
              />
            ) : (
              <div className="flex gap-2">
                <div className="mt-1 flex shrink-0 flex-col gap-0.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                  <button
                    type="button"
                    className="flex h-7 w-7 items-center justify-center rounded-[3px] text-sm text-ink/40 hover:bg-ink/5 hover:text-ink"
                    aria-label="Вставить блок"
                    onClick={(e) => {
                      e.stopPropagation()
                      openMenu(-1, e.currentTarget)
                    }}
                  >
                    +
                  </button>
                </div>
                <div
                  ref={bodyRef}
                  contentEditable
                  suppressContentEditableWarning
                  role="textbox"
                  aria-multiline="true"
                  data-placeholder="Начните писать…"
                  className="min-h-[40px] w-full bg-transparent py-1 text-base font-light leading-[1.45] tracking-[-0.09em] text-ink outline-none [overflow-wrap:anywhere] [&_h1]:text-[32px] [&_h1]:leading-[0.9] [&_h1]:tracking-[-0.09em] [&_h1]:font-light [&_h1]:mt-6 [&_h1]:mb-2 [&_h2]:text-[28px] [&_h2]:leading-[0.9] [&_h2]:tracking-[-0.09em] [&_h2]:font-light [&_h2]:mt-5 [&_h2]:mb-2 [&_h3]:text-2xl [&_h3]:leading-[0.95] [&_h3]:tracking-[-0.07em] [&_h3]:font-light [&_h3]:mt-4 [&_h3]:mb-2 [&_h4]:text-xl [&_h4]:leading-[0.95] [&_h4]:tracking-[-0.06em] [&_h4]:font-light [&_h4]:mt-4 [&_h4]:mb-1 [&_h5]:text-lg [&_h5]:leading-[1.05] [&_h5]:tracking-[-0.05em] [&_h5]:font-light [&_h5]:mt-3 [&_h5]:mb-1 [&_h6]:text-base [&_h6]:leading-[1.1] [&_h6]:tracking-[-0.05em] [&_h6]:font-light [&_h6]:mt-3 [&_h6]:mb-1 [&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1"
                  onFocus={() => {
                    bodyHydratedRef.current = true
                  }}
                  onKeyDown={(e) => {
                    if (!(e.metaKey || e.ctrlKey) || !e.altKey) return
                    const key = e.key.toLowerCase()
                    if (key === '0') {
                      e.preventDefault()
                      document.execCommand('formatBlock', false, 'P')
                      return
                    }
                    if (!/^[1-6]$/.test(key)) return
                    e.preventDefault()
                    document.execCommand('formatBlock', false, `H${key}`)
                  }}
                  onInput={(e) => {
                    const html = sanitizeRichHtml(e.currentTarget.innerHTML)
                    setDraft((d) => (d ? { ...d, bodyHtml: html } : d))
                    if (noteSlug) updateNote(noteSlug, { bodyHtml: html })
                  }}
                  onPaste={(e) => {
                    e.preventDefault()
                    const text = e.clipboardData.getData('text/plain')
                    const safe = paragraphTextToHtml(text)
                    document.execCommand('insertHTML', false, safe)
                  }}
                />
              </div>
            )}

            {previewMode
              ? draft.blocks.map((block) => (
                  <div
                    key={block.id}
                    className="border-b border-[rgba(10,10,10,0.08)] pb-4 pt-1 last:border-b-0"
                  >
                    <NoteBlockRead block={block} />
                  </div>
                ))
              : draft.blocks.map((block, index) => (
                  <BlockRow
                    key={block.id}
                    block={block}
                    index={index}
                    onChange={(b) => updateBlock(index, b)}
                    onOpenMenu={openMenu}
                    onRemove={() => removeBlock(index)}
                  />
                ))}
            <div aria-hidden className="h-10" />
          </div>
        </section>
      </div>

      {menu && !previewMode ? (
        <BlockInsertMenu
          anchor={menu.anchor}
          onClose={closeInsertMenu}
          onPick={applyPickedBlock}
        />
      ) : null}

      <NoteEditMetaModal
        key={metaModalOpen ? `note-edit-${noteSlug}` : 'note-edit-closed'}
        open={metaModalOpen}
        initialTitle={draft.title}
        initialDescription={draft.description}
        readOnly={readOnly}
        onClose={() => setMetaModalOpen(false)}
        onSave={(t, d) => {
          setDraft((prev) =>
            prev ? { ...prev, title: t, description: d } : null,
          )
        }}
        onDelete={() => {
          if (!noteSlug) return
          deleteNote(noteSlug)
          navigate('/notes', { replace: true })
        }}
      />
    </main>
  )
}

function BlockRow({
  block,
  index,
  onChange,
  onOpenMenu,
  onRemove,
}: {
  block: NoteBlock
  index: number
  onChange: (b: NoteBlock) => void
  onOpenMenu: (index: number, el: HTMLElement) => void
  onRemove: () => void
}) {
  const imageFileInputId = useId()
  const codeTextareaRef = useRef<HTMLTextAreaElement | null>(null)
  useAutosizeTextarea(codeTextareaRef, block.type === 'code' ? block.text : '')

  const gutter = (
    <div className="mt-1 flex shrink-0 flex-col gap-0.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
      <button
        type="button"
        className="flex h-7 w-7 items-center justify-center rounded-[3px] text-sm text-ink/40 hover:bg-ink/5 hover:text-ink"
        aria-label="Добавить блок"
        onClick={(e) => {
          e.stopPropagation()
          onOpenMenu(index, e.currentTarget)
        }}
      >
        +
      </button>
      <button
        type="button"
        className="flex h-7 w-7 items-center justify-center rounded-[3px] text-xs text-ink/35 hover:bg-ink/5 hover:text-ink/80"
        aria-label="Удалить блок"
        onClick={(e) => {
          e.stopPropagation()
          onRemove()
        }}
      >
        ×
      </button>
    </div>
  )

  const baseInput =
    'w-full border-0 bg-transparent font-light tracking-[-0.04em] text-ink outline-none placeholder:text-ink/35 focus:ring-0'

  let body: ReactNode
  switch (block.type) {
    case 'h1':
    case 'h2':
    case 'h3':
    case 'h4':
    case 'h5':
    case 'h6':
    case 'paragraph':
      // Текстовые блоки больше не используются (теперь есть общий холст bodyHtml).
      body = null
      break
    case 'todo':
      body = (
        <div className="flex flex-col gap-2 py-1">
          {(block.todos ?? []).map((t, ti) => (
            <TodoLine
              key={t.id}
              item={t}
              onChange={(item) => {
                const todos = [...(block.todos ?? [])]
                todos[ti] = item
                onChange({ ...block, todos })
              }}
            />
          ))}
          <button
            type="button"
            className="self-start text-sm font-light text-ink/50 hover:text-ink"
            onClick={() =>
              onChange({
                ...block,
                todos: [
                  ...(block.todos ?? []),
                  { id: newBlockId(), label: '', done: false },
                ],
              })
            }
          >
            + пункт
          </button>
        </div>
      )
      break
    case 'code':
      body = (
        <div className="flex flex-col gap-2">
          <select
            className="w-auto max-w-[120px] rounded-[3px] border border-[rgba(10,10,10,0.2)] bg-ink/[0.04] px-2 py-1 text-xs font-light"
            value={block.language ?? 'html'}
            onChange={(e) =>
              onChange({
                ...block,
                language: e.target.value as 'html' | 'css' | 'js',
              })
            }
          >
            <option value="html">HTML</option>
            <option value="css">CSS</option>
            <option value="js">JS</option>
          </select>
          <textarea
            ref={codeTextareaRef}
            className={`${baseInput} min-h-[120px] resize-none overflow-hidden rounded-[3px] bg-[rgba(10,10,10,0.08)] p-4 font-mono text-sm leading-relaxed`}
            value={block.text}
            placeholder={
              block.language === 'css'
                ? '<style>'
                : block.language === 'js'
                  ? '<script>'
                  : '<div>'
            }
            onChange={(e) => onChange({ ...block, text: e.target.value })}
          />
        </div>
      )
      break
    case 'link':
      body = (
        <div className="flex flex-col gap-2 py-1 sm:flex-row sm:items-center sm:gap-4">
          <input
            className={`${baseInput} flex-1 border-b border-[rgba(10,10,10,0.12)] py-1 text-base`}
            value={block.text}
            placeholder="Текст ссылки"
            onChange={(e) => onChange({ ...block, text: e.target.value })}
          />
          <input
            className={`${baseInput} flex-1 border-b border-[rgba(10,10,10,0.12)] py-1 text-base text-ink/70`}
            value={block.href ?? ''}
            placeholder="https://"
            onChange={(e) => onChange({ ...block, href: e.target.value })}
          />
        </div>
      )
      break
    case 'image': {
      const src = (block.href ?? '').trim()
      body = (
        <div className="flex flex-col gap-4 rounded-[3px] border border-[rgba(10,10,10,0.2)] bg-ink/[0.02] p-4">
          <div className="flex flex-wrap items-center gap-3">
            <label
              htmlFor={imageFileInputId}
              className="inline-flex cursor-pointer items-center rounded-full border border-[rgba(10,10,10,0.32)] bg-surface px-4 py-1.5 text-sm font-light tracking-[-0.02em] text-ink transition-colors hover:bg-ink/[0.04]"
            >
              Загрузить файл
            </label>
            <input
              id={imageFileInputId}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0]
                e.target.value = ''
                if (!f) return
                void readImageFileAsDataUrl(f).then(
                  (dataUrl) => onChange({ ...block, href: dataUrl }),
                  () => {},
                )
              }}
            />
            <span className="text-sm font-light text-ink/40">или</span>
            <input
              className={`${baseInput} min-w-[12rem] flex-1 border-b border-[rgba(10,10,10,0.15)] py-1 text-sm`}
              value={block.href ?? ''}
              placeholder="URL изображения"
              onChange={(e) => onChange({ ...block, href: e.target.value })}
            />
          </div>
          {src ? (
            <figure className="m-0">
              <img
                src={src}
                alt={block.text || ''}
                className="max-h-[min(70vh,520px)] w-full rounded-[3px] border border-[rgba(10,10,10,0.12)] object-contain"
              />
              <figcaption className="mt-2">
                <input
                  className={`${baseInput} w-full text-center text-sm text-ink/70`}
                  value={block.text}
                  placeholder="Подпись (опционально)"
                  onChange={(e) => onChange({ ...block, text: e.target.value })}
                />
              </figcaption>
            </figure>
          ) : (
            <input
              className={`${baseInput} text-sm text-ink/50`}
              value={block.text}
              placeholder="Подпись (опционально)"
              onChange={(e) => onChange({ ...block, text: e.target.value })}
            />
          )}
        </div>
      )
      break
    }
    case 'video': {
      const vurl = (block.href ?? '').trim()
      body = (
        <div className="flex flex-col gap-4 rounded-[3px] border border-[rgba(10,10,10,0.2)] bg-ink/[0.02] p-4">
          <input
            className={`${baseInput} border-b border-[rgba(10,10,10,0.15)] py-1 text-base`}
            value={block.href ?? ''}
            placeholder="Ссылка: YouTube, Vimeo или прямой URL (.mp4, .webm…)"
            onChange={(e) => onChange({ ...block, href: e.target.value })}
          />
          <input
            className={`${baseInput} text-sm text-ink/60`}
            value={block.text}
            placeholder="Подпись (опционально)"
            onChange={(e) => onChange({ ...block, text: e.target.value })}
          />
          {vurl ? <VideoEmbed url={vurl} /> : null}
        </div>
      )
      break
    }
    default:
      body = null
  }

  return (
    <div className="group flex gap-2 border-b border-[rgba(10,10,10,0.08)] pb-3 pt-1">
      {gutter}
      <div className="min-w-0 flex-1">
        {body}
      </div>
    </div>
  )
}

function TodoLine({
  item,
  onChange,
}: {
  item: NoteTodoItem
  onChange: (t: NoteTodoItem) => void
}) {
  return (
    <div className="flex items-start gap-2.5 opacity-90">
      <button
        type="button"
        className={`mt-1 h-2 w-2 shrink-0 border border-ink ${item.done ? 'bg-ink' : ''}`}
        aria-pressed={item.done}
        onClick={() => onChange({ ...item, done: !item.done })}
        aria-label={item.done ? 'Снять отметку' : 'Отметить'}
      />
      <input
        className="min-w-0 flex-1 border-0 bg-transparent text-base font-light leading-[1.4] tracking-[-0.04em] text-ink outline-none"
        value={item.label}
        placeholder="Задача"
        onChange={(e) => onChange({ ...item, label: e.target.value })}
      />
    </div>
  )
}
