import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useNotesContext } from '../hooks/useNotesContext'
import { useProjects } from '../hooks/useProjects'
import type { Note } from '../types/note'

const BORDER = 'border-card-border'

const SCOPE_FILTERS = ['Все заметки', 'С проектом', 'Без проекта'] as const

function formatNoteDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  } catch {
    return '—'
  }
}

function NoteCard({
  note,
  projectTitleBySlug,
  onDelete,
}: {
  note: Note
  projectTitleBySlug: Map<string, string>
  onDelete: () => void
}) {
  const attached = note.attachedProjectSlugs ?? []
  return (
    <article
      className={`relative flex min-h-[220px] flex-col justify-between border ${BORDER} p-5 transition-colors hover:bg-ink/[0.02]`}
    >
      <Link
        to={`/notes/${note.slug}`}
        className="block min-h-0 flex-1 text-left outline-none ring-ink transition-shadow focus-visible:ring-2"
      >
        <div className="flex flex-col gap-3">
          <h3 className="text-[32px] font-light leading-[0.9] tracking-[-0.09em]">
            {note.title.trim() || 'Без названия'}
          </h3>
          <p className="line-clamp-3 text-base font-light leading-[1.35] tracking-[-0.09em] text-ink/85">
            {note.description.trim() || 'Без описания'}
          </p>
        </div>
      </Link>

      <div className="mt-6 flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            {attached.length === 0 ? (
              <span className="text-[10px] font-light uppercase leading-none tracking-[-0.02em] text-ink/45">
                Без проекта
              </span>
            ) : (
              attached.map((slug) => (
                <span
                  key={slug}
                  className="max-w-[140px] truncate text-[10px] font-light uppercase leading-none tracking-[-0.02em] text-ink"
                  title={projectTitleBySlug.get(slug) ?? slug}
                >
                  {projectTitleBySlug.get(slug) ?? slug}
                </span>
              ))
            )}
          </div>
          <span className="shrink-0 text-[10px] font-light uppercase leading-none tracking-[-0.02em] text-ink/65">
            {formatNoteDate(note.createdAt)}
          </span>
        </div>
        <button
          type="button"
          className="self-start text-sm font-light tracking-[-0.02em] text-ink/50 underline-offset-4 hover:text-ink hover:underline"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onDelete()
          }}
        >
          Удалить
        </button>
      </div>
    </article>
  )
}

export function NotesIndexPage() {
  const { notes, createNote, deleteNote } = useNotesContext()
  const { projects } = useProjects()
  const navigate = useNavigate()

  const [scope, setScope] = useState<(typeof SCOPE_FILTERS)[number]>(
    'Все заметки',
  )
  const [projectSlug, setProjectSlug] = useState<string | null>(null)

  const projectTitleBySlug = useMemo(() => {
    const m = new Map<string, string>()
    for (const p of projects) m.set(p.slug, p.title)
    return m
  }, [projects])

  const sortedProjects = useMemo(
    () => [...projects].sort((a, b) => a.title.localeCompare(b.title, 'ru')),
    [projects],
  )

  const filteredNotes = useMemo(() => {
    let list = notes
    if (scope === 'С проектом') {
      list = list.filter((n) => (n.attachedProjectSlugs?.length ?? 0) > 0)
    } else if (scope === 'Без проекта') {
      list = list.filter((n) => (n.attachedProjectSlugs?.length ?? 0) === 0)
    }
    if (projectSlug) {
      list = list.filter((n) =>
        (n.attachedProjectSlugs ?? []).includes(projectSlug),
      )
    }
    return list
  }, [notes, scope, projectSlug])

  return (
    <main className="relative z-10 mx-auto w-full max-w-[1840px] px-4 pb-16 pt-8 sm:px-10 sm:pt-10">
      <div className="flex max-w-[487px] flex-col gap-5">
        <h1 className="text-[clamp(2.5rem,6vw,4rem)] font-light leading-[0.9] tracking-[-0.09em]">
          Заметки
        </h1>
      </div>

      <div className="mt-10 flex flex-col gap-10">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex min-w-0 flex-col gap-6">
            <div className="flex flex-wrap items-end gap-5 lg:gap-8">
              {SCOPE_FILTERS.map((label) => {
                const active = label === scope
                return (
                  <button
                    key={label}
                    type="button"
                    aria-current={active ? 'page' : undefined}
                    onClick={() => {
                      setScope(label)
                      if (label === 'Без проекта') setProjectSlug(null)
                    }}
                    className="group flex flex-col items-center gap-px"
                  >
                    <span
                      className={`text-base transition-colors ${
                        active
                          ? 'font-normal text-ink'
                          : 'font-normal text-ink/70'
                      }`}
                    >
                      {label}
                    </span>
                    <span
                      className={`h-px w-full origin-center scale-x-0 bg-ink transition-transform group-hover:scale-x-100 ${
                        active ? 'scale-x-100' : ''
                      }`}
                      aria-hidden
                    />
                  </button>
                )
              })}
            </div>

            {sortedProjects.length > 0 && scope !== 'Без проекта' ? (
              <div className="flex flex-col gap-3">
                <span className="text-[10px] font-light uppercase leading-none tracking-[-0.02em] text-ink/55">
                  Проект
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setProjectSlug(null)}
                    className={`rounded-full border px-3 py-1 text-sm font-light tracking-[-0.02em] transition-colors ${
                      projectSlug === null
                        ? 'border-fill-contrast-bg bg-fill-contrast-bg text-fill-contrast-fg'
                        : `${BORDER} text-ink hover:bg-ink/[0.04]`
                    }`}
                  >
                    Любой
                  </button>
                  {sortedProjects.map((p) => {
                    const active = projectSlug === p.slug
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() =>
                          setProjectSlug(active ? null : p.slug)
                        }
                        className={`max-w-[200px] truncate rounded-full border px-3 py-1 text-sm font-light tracking-[-0.02em] transition-colors ${
                          active
                            ? 'border-fill-contrast-bg bg-fill-contrast-bg text-fill-contrast-fg'
                            : `${BORDER} text-ink hover:bg-ink/[0.04]`
                        }`}
                        title={p.title}
                      >
                        {p.title}
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : null}
          </div>

          <button
            type="button"
            className="h-8 shrink-0 self-start rounded-full bg-fill-contrast-bg px-5 text-sm font-light tracking-[-0.05em] text-fill-contrast-fg transition-opacity hover:opacity-90 lg:self-auto"
            onClick={() => {
              const n = createNote()
              navigate(`/notes/${n.slug}`)
            }}
          >
            Новая заметка
          </button>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {filteredNotes.length === 0 ? (
            <p className="col-span-full text-base font-light text-ink/60">
              {notes.length === 0
                ? 'Заметок пока нет — нажмите «Новая заметка».'
                : 'Нет заметок по выбранным фильтрам.'}
            </p>
          ) : (
            filteredNotes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                projectTitleBySlug={projectTitleBySlug}
                onDelete={() => deleteNote(note.slug)}
              />
            ))
          )}
        </div>
      </div>
    </main>
  )
}
