import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useSettings } from '../hooks/useSettings'
import {
  fetchNoteRevisions,
  insertNoteRevision,
} from '../lib/noteRevisionsSupabase'
import {
  BlockInsertMenu,
  type MenuAnchor,
} from '../components/notes/BlockInsertMenu'
import { NoteBlockRead } from '../components/notes/NoteBlockRead'
import { VideoEmbed } from '../components/notes/VideoEmbed'
import { createEmptyBlock, newBlockId } from '../context/notesContext'
import { useNotesContext } from '../hooks/useNotesContext'
import { useProjects } from '../hooks/useProjects'
import type { Note, NoteBlock, NoteTodoItem } from '../types/note'

const BORDER = 'border-card-border'

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
  const { getNoteBySlug, updateNote } = useNotesContext()
  const { projects } = useProjects()
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
  /** Индекс вставки без вложенного setState (избегает двойного вызова в Strict Mode) */
  const insertMenuRef = useRef<{ blockIndex: number } | null>(null)

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

  const persist = useCallback(
    (next: Note) => {
      if (!noteSlug) return
      updateNote(noteSlug, {
        title: next.title,
        description: next.description,
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
      const cur = blocks[i]
      const replace =
        cur?.type === 'paragraph' && !cur.text.trim()
      if (replace) {
        blocks[i] = { ...block, id: cur.id }
      } else {
        blocks.splice(i + 1, 0, block)
      }
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
      const blocks =
        next.length > 0 ? next : [createEmptyBlock('paragraph')]
      return { ...d, blocks }
    })
  }, [])

  if (!noteSlug || !note) {
    return <Navigate to="/notes" replace />
  }

  if (!draft) {
    return null
  }

  return (
    <main className="relative z-10 mx-auto w-full max-w-[1840px] px-4 pb-16 pt-8 sm:px-10 sm:pt-10">
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
            title="Сохранить снимок в историю (без ограничения по времени)"
            onClick={() => {
              if (!noteSlug || !client || !userId || !draft) return
              void (async () => {
                const err = await insertNoteRevision(client, userId, noteSlug, draft)
                if (err) window.alert(err.message)
                else {
                  const list = await fetchNoteRevisions(client, userId, noteSlug)
                  setRevisions(list)
                }
              })()
            }}
          >
            Сохранить версию
          </button>
        </div>
      </div>

      <div className="mt-10 flex flex-col gap-6 xl:flex-row xl:items-start xl:gap-10">
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
            <div className="flex flex-col gap-3">
              <label className="block">
                <span className="sr-only">Название</span>
                <input
                  className="w-full border-0 bg-transparent text-[32px] font-light leading-[0.9] tracking-[-0.09em] text-ink outline-none placeholder:text-ink/40"
                  value={draft.title}
                  placeholder="Название скрипта"
                  onChange={(e) =>
                    setDraft((d) => (d ? { ...d, title: e.target.value } : d))
                  }
                />
              </label>
              <label className="block">
                <span className="sr-only">Описание</span>
                <textarea
                  className="mt-2 w-full resize-y border-0 bg-transparent text-base font-light leading-[0.9] tracking-[-0.09em] text-ink outline-none placeholder:text-ink/40"
                  rows={3}
                  value={draft.description}
                  placeholder="Описание"
                  onChange={(e) =>
                    setDraft((d) =>
                      d ? { ...d, description: e.target.value } : d,
                    )
                  }
                />
              </label>
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
                            className="mt-1 shrink-0 rounded border-[rgba(10,10,10,0.35)]"
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
              Версии (Supabase)
            </p>
            {readOnly ? (
              <p className="mt-2 text-xs font-light text-ink/45">
                В режиме только чтения новые ревизии не пишутся.
              </p>
            ) : null}
            {revLoading ? (
              <p className="mt-2 text-xs font-light text-ink/45">Загрузка…</p>
            ) : revisions.length === 0 ? (
              <p className="mt-2 text-xs font-light text-ink/45">
                Пока нет сохранённых версий (снимок предыдущего состояния не чаще чем
                раз в ~1,5 мин. при правках).
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
                          blocks,
                          attachedProjectSlugs: attached,
                        })
                        setDraft((d) =>
                          d
                            ? {
                                ...d,
                                title: snap.title,
                                description: snap.description,
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
          className={`min-w-0 flex-1 border ${BORDER} p-5 sm:p-5`}
        >
          <h2 className="text-[32px] font-light leading-[0.9] tracking-[-0.09em]">
            Содержимое
          </h2>

          <div className="mt-10 flex flex-col gap-2 border-t border-[rgba(10,10,10,0.32)] pt-5">
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
  const isEmptyPara = block.type === 'paragraph' && !block.text.trim()

  const gutter = (
    <div className="mt-1 flex shrink-0 flex-col gap-0.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
      <button
        type="button"
        className="flex h-7 w-7 items-center justify-center rounded text-sm text-ink/40 hover:bg-ink/5 hover:text-ink"
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
        className="flex h-7 w-7 items-center justify-center rounded text-xs text-ink/35 hover:bg-ink/5 hover:text-ink/80"
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

  const openFromLine = (e: MouseEvent<HTMLElement>) => {
    if (isEmptyPara) {
      e.stopPropagation()
      onOpenMenu(index, e.currentTarget)
    }
  }

  const baseInput =
    'w-full border-0 bg-transparent font-light tracking-[-0.09em] text-ink outline-none placeholder:text-ink/35 focus:ring-0'

  let body: ReactNode
  switch (block.type) {
    case 'h1':
      body = (
        <input
          className={`${baseInput} text-[32px] leading-[0.9]`}
          value={block.text}
          placeholder="Заголовок H1"
          onChange={(e) => onChange({ ...block, text: e.target.value })}
        />
      )
      break
    case 'h2':
      body = (
        <input
          className={`${baseInput} text-[28px] leading-[0.9]`}
          value={block.text}
          placeholder="Заголовок H2"
          onChange={(e) => onChange({ ...block, text: e.target.value })}
        />
      )
      break
    case 'h3':
      body = (
        <input
          className={`${baseInput} text-2xl leading-[0.9]`}
          value={block.text}
          placeholder="Заголовок H3"
          onChange={(e) => onChange({ ...block, text: e.target.value })}
        />
      )
      break
    case 'h4':
      body = (
        <input
          className={`${baseInput} text-xl leading-[0.9]`}
          value={block.text}
          placeholder="Заголовок H4"
          onChange={(e) => onChange({ ...block, text: e.target.value })}
        />
      )
      break
    case 'h5':
      body = (
        <input
          className={`${baseInput} text-lg leading-[0.9]`}
          value={block.text}
          placeholder="Заголовок H5"
          onChange={(e) => onChange({ ...block, text: e.target.value })}
        />
      )
      break
    case 'h6':
      body = (
        <input
          className={`${baseInput} text-base leading-[0.9]`}
          value={block.text}
          placeholder="Заголовок H6"
          onChange={(e) => onChange({ ...block, text: e.target.value })}
        />
      )
      break
    case 'paragraph':
      body = isEmptyPara ? (
        <button
          type="button"
          className={`${baseInput} w-full cursor-text py-2 text-left text-base leading-[0.9] text-ink/35`}
          onClick={openFromLine}
        >
          Найти и вставить
        </button>
      ) : (
        <textarea
          className={`${baseInput} min-h-[4rem] resize-y py-2 text-base leading-[1.4]`}
          value={block.text}
          placeholder="Параграф"
          rows={3}
          onChange={(e) => onChange({ ...block, text: e.target.value })}
        />
      )
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
            className="w-auto max-w-[120px] border border-[rgba(10,10,10,0.2)] bg-ink/[0.04] px-2 py-1 text-xs font-light"
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
            className={`${baseInput} min-h-[120px] resize-y rounded bg-[rgba(10,10,10,0.08)] p-4 font-mono text-sm leading-relaxed`}
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
        <div className="flex flex-col gap-4 rounded border border-[rgba(10,10,10,0.2)] bg-ink/[0.02] p-4">
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
                className="max-h-[min(70vh,520px)] w-full rounded border border-[rgba(10,10,10,0.12)] object-contain"
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
        <div className="flex flex-col gap-4 rounded border border-[rgba(10,10,10,0.2)] bg-ink/[0.02] p-4">
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
        className="min-w-0 flex-1 border-0 bg-transparent text-base font-light leading-[1.4] tracking-[-0.09em] text-ink outline-none"
        value={item.label}
        placeholder="Задача"
        onChange={(e) => onChange({ ...item, label: e.target.value })}
      />
    </div>
  )
}
