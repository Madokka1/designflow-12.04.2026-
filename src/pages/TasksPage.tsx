import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { PageTabButton, PageTabList } from '../components/PageTabs'
import { useProjects } from '../hooks/useProjects'
import { useSettings } from '../hooks/useSettings'
import { DeadlineDdMmYyyyInput } from '../components/DeadlineDdMmYyyyInput'
import { accentButtonStyle } from '../lib/pickContrastText'
import { formInputUnderlineClass } from '../lib/formInputClasses'
import {
  REMINDER_PRESET_LABELS,
  datetimeLocalToIso,
  isoToDatetimeLocalValue,
  taskReminderSummary,
} from '../lib/taskReminderUi'
import {
  TASK_REMINDER_PRESETS,
  type TaskReminderPreset,
  type WorkspaceTask,
} from '../types/workspaceTask'

const input = formInputUnderlineClass

function TaskDetailPanel({
  task,
  updateTask,
}: {
  task: WorkspaceTask
  updateTask: (id: string, patch: Partial<Omit<WorkspaceTask, 'id'>>) => void
}) {
  const [commentLocal, setCommentLocal] = useState(task.comment)
  useEffect(() => {
    setCommentLocal(task.comment)
  }, [task.id, task.comment])

  const summary = taskReminderSummary(task)

  return (
    <div className="flex flex-col gap-3 border-t border-card-border bg-ink/[0.02] px-4 py-3 dark:bg-white/[0.02]">
      <label className="flex flex-col gap-1">
        <span className="text-[10px] font-light uppercase text-ink/50">
          Комментарий
        </span>
        <textarea
          className={`${input} min-h-[5rem] resize-y py-2 text-sm`}
          value={commentLocal}
          onChange={(e) => setCommentLocal(e.target.value)}
          onBlur={() => {
            if (commentLocal !== task.comment) {
              updateTask(task.id, { comment: commentLocal })
            }
          }}
          placeholder="Заметки к задаче"
          rows={4}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[10px] font-light uppercase text-ink/50">
          Уведомление
        </span>
        <select
          className={`${input} cursor-pointer text-sm`}
          value={task.reminderPreset}
          onChange={(e) => {
            const v = e.target.value as TaskReminderPreset
            updateTask(task.id, {
              reminderPreset: v,
              reminderAtCustom: v === 'custom' ? task.reminderAtCustom : '',
            })
          }}
        >
          {TASK_REMINDER_PRESETS.map((p) => (
            <option key={p} value={p}>
              {REMINDER_PRESET_LABELS[p]}
            </option>
          ))}
        </select>
      </label>
      {task.reminderPreset === 'custom' ? (
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-light uppercase text-ink/50">
            Дата и время
          </span>
          <input
            type="datetime-local"
            className={`${input} text-sm`}
            value={isoToDatetimeLocalValue(task.reminderAtCustom)}
            onChange={(e) =>
              updateTask(task.id, {
                reminderAtCustom: datetimeLocalToIso(e.target.value),
              })
            }
          />
        </label>
      ) : null}
      {summary ? (
        <p className="text-xs font-light text-ink/55">{summary}</p>
      ) : null}
    </div>
  )
}

export function TasksPage() {
  const location = useLocation()
  const { settings } = useSettings()
  const {
    tasks,
    projects,
    addTask,
    toggleTaskDone,
    deleteTask,
    updateTask,
  } = useProjects()
  const [title, setTitle] = useState('')
  const [due, setDue] = useState('')
  const [projectSlug, setProjectSlug] = useState('')
  const [labelDraft, setLabelDraft] = useState('')
  const [filter, setFilter] = useState<'all' | 'open' | 'done'>('open')
  const [bulkSelect, setBulkSelect] = useState(false)
  const [picked, setPicked] = useState<Set<string>>(() => new Set())
  const [bulkProject, setBulkProject] = useState('')
  const [openDetailsId, setOpenDetailsId] = useState<string | null>(null)
  const [newReminderPreset, setNewReminderPreset] =
    useState<TaskReminderPreset>('none')
  const [newReminderLocal, setNewReminderLocal] = useState('')
  const [newComment, setNewComment] = useState('')

  const filtered = useMemo(() => {
    if (filter === 'all') return tasks
    if (filter === 'open') return tasks.filter((t) => !t.done)
    return tasks.filter((t) => t.done)
  }, [tasks, filter])

  const sorted = useMemo(
    () =>
      [...filtered].sort((a, b) => {
        if (a.done !== b.done) return a.done ? 1 : -1
        return a.sortOrder - b.sortOrder
      }),
    [filtered],
  )

  useEffect(() => {
    const hash = location.hash.replace(/^#/, '')
    if (!hash.startsWith('task-')) return
    window.setTimeout(() => {
      document.getElementById(hash)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
    }, 100)
  }, [location.hash, sorted.length])

  return (
    <main className="relative z-10 mx-auto w-full max-w-[1840px] px-4 pb-16 pt-8 sm:px-10 sm:pt-10">
      <h1 className="text-[clamp(2rem,5vw,3.5rem)] font-light leading-[0.9] tracking-[-0.09em]">
        Задачи
      </h1>

      <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 flex-1">
          <PageTabList role="tablist" aria-label="Фильтр задач">
            {(
              [
                ['open', 'Активные'],
                ['all', 'Все'],
                ['done', 'Выполненные'],
              ] as const
            ).map(([id, label]) => (
              <PageTabButton
                key={id}
                selected={filter === id}
                aria-current={filter === id ? 'page' : undefined}
                onClick={() => setFilter(id)}
              >
                {label}
              </PageTabButton>
            ))}
          </PageTabList>
        </div>
        <button
          type="button"
          onClick={() => {
            setBulkSelect((v) => !v)
            setPicked(new Set())
          }}
          className={`h-8 shrink-0 self-start rounded-full border px-5 text-sm font-light tracking-[-0.05em] transition-[opacity,transform,background-color,border-color] duration-200 hover:opacity-90 active:scale-[0.98] motion-reduce:active:scale-100 lg:self-auto ${
            bulkSelect
              ? 'border-ink bg-ink/10 text-ink'
              : 'border-card-border text-ink/60 hover:text-ink'
          }`}
        >
          {bulkSelect ? 'Закрыть выделение' : 'Массовый выбор'}
        </button>
      </div>

      {bulkSelect && sorted.length > 0 ? (
        <div className="mt-4 flex max-w-3xl flex-wrap items-center gap-2 border border-card-border p-3 text-xs font-light">
          <button
            type="button"
            className="rounded-full border border-card-border px-3 py-1"
            onClick={() => {
              if (picked.size === sorted.length) setPicked(new Set())
              else setPicked(new Set(sorted.map((t) => t.id)))
            }}
          >
            {picked.size === sorted.length ? 'Снять все' : 'Выбрать все на экране'}
          </button>
          <span className="text-ink/55">Выбрано: {picked.size}</span>
          <button
            type="button"
            className="rounded-full px-3 py-1"
            style={accentButtonStyle(settings.accentColor)}
            disabled={picked.size === 0}
            onClick={() => {
              picked.forEach((id) => {
                const t = tasks.find((x) => x.id === id)
                if (t && !t.done) toggleTaskDone(id)
              })
              setPicked(new Set())
            }}
          >
            Выполнить
          </button>
          <button
            type="button"
            className="rounded-full border border-card-border px-3 py-1 text-ink/80"
            disabled={picked.size === 0}
            onClick={() => {
              if (!window.confirm(`Удалить ${picked.size} задач?`)) return
              picked.forEach((id) => deleteTask(id))
              setPicked(new Set())
            }}
          >
            Удалить
          </button>
          <label className="flex items-center gap-2">
            <span className="text-ink/55">Проект:</span>
            <select
              className={`${input} max-w-[10rem] cursor-pointer text-xs`}
              value={bulkProject}
              onChange={(e) => setBulkProject(e.target.value)}
            >
              <option value="">—</option>
              {projects.filter((p) => !p.archived).map((p) => (
                <option key={p.slug} value={p.slug}>
                  {p.title}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="rounded-full border border-card-border px-3 py-1"
              disabled={picked.size === 0 || !bulkProject}
              onClick={() => {
                const slug = bulkProject || null
                picked.forEach((id) => updateTask(id, { projectSlug: slug }))
                setPicked(new Set())
              }}
            >
              Назначить
            </button>
          </label>
        </div>
      ) : null}

      <form
        className="mt-8 flex max-w-3xl flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end"
        onSubmit={(e) => {
          e.preventDefault()
          const labels = labelDraft
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
          addTask({
            title,
            dueDate: due.trim(),
            projectSlug: projectSlug || null,
            done: false,
            labels,
            comment: newComment.trim(),
            reminderPreset: newReminderPreset,
            reminderAtCustom:
              newReminderPreset === 'custom'
                ? datetimeLocalToIso(newReminderLocal)
                : '',
          })
          setTitle('')
          setDue('')
          setLabelDraft('')
          setNewComment('')
          setNewReminderPreset('none')
          setNewReminderLocal('')
        }}
      >
        <label className="min-w-[12rem] flex-1">
          <span className="text-[10px] font-light uppercase text-ink/50">
            Задача
          </span>
          <input
            className={input}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Что сделать"
          />
        </label>
        <label className="min-w-[12rem] max-w-full sm:max-w-[16rem]">
          <span className="text-[10px] font-light uppercase text-ink/50">
            Срок
          </span>
          <DeadlineDdMmYyyyInput
            inputClass={input}
            aria-label="Срок задачи"
            value={due}
            onChange={setDue}
          />
        </label>
        <label className="min-w-[10rem] flex-1">
          <span className="text-[10px] font-light uppercase text-ink/50">
            Проект
          </span>
          <select
            className={`${input} cursor-pointer`}
            value={projectSlug}
            onChange={(e) => setProjectSlug(e.target.value)}
          >
            <option value="">—</option>
            {projects.filter((p) => !p.archived).map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.title}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-[8rem] flex-1">
          <span className="text-[10px] font-light uppercase text-ink/50">
            Метки
          </span>
          <input
            className={input}
            value={labelDraft}
            onChange={(e) => setLabelDraft(e.target.value)}
            placeholder="срочно, дом"
          />
        </label>
        <label className="min-w-[12rem] flex-1">
          <span className="text-[10px] font-light uppercase text-ink/50">
            Уведомление
          </span>
          <select
            className={`${input} cursor-pointer`}
            value={newReminderPreset}
            onChange={(e) =>
              setNewReminderPreset(e.target.value as TaskReminderPreset)
            }
          >
            {TASK_REMINDER_PRESETS.map((p) => (
              <option key={p} value={p}>
                {REMINDER_PRESET_LABELS[p]}
              </option>
            ))}
          </select>
        </label>
        {newReminderPreset === 'custom' ? (
          <label className="min-w-[12rem] max-w-full sm:max-w-[16rem]">
            <span className="text-[10px] font-light uppercase text-ink/50">
              Когда напомнить
            </span>
            <input
              type="datetime-local"
              className={input}
              value={newReminderLocal}
              onChange={(e) => setNewReminderLocal(e.target.value)}
            />
          </label>
        ) : null}
        <label className="min-w-full flex-1 sm:min-w-[20rem]">
          <span className="text-[10px] font-light uppercase text-ink/50">
            Комментарий
          </span>
          <input
            className={input}
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Краткая заметка"
          />
        </label>
        <button
          type="submit"
          className="h-9 rounded-full px-6 text-sm font-light"
          style={accentButtonStyle(settings.accentColor)}
        >
          Добавить
        </button>
      </form>

      <ul className="mt-10 flex max-w-3xl flex-col gap-2">
        {sorted.length === 0 ? (
          <li className="text-sm font-light text-ink/50">Пока пусто</li>
        ) : (
          sorted.map((t) => (
            <li
              key={t.id}
              id={`task-${t.id}`}
              className="scroll-mt-24 overflow-hidden border border-card-border"
            >
              <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                {bulkSelect ? (
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-ink"
                    checked={picked.has(t.id)}
                    onChange={() => {
                      setPicked((prev) => {
                        const next = new Set(prev)
                        if (next.has(t.id)) next.delete(t.id)
                        else next.add(t.id)
                        return next
                      })
                    }}
                    aria-label="Выбрать для массовых действий"
                  />
                ) : null}
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-ink"
                  checked={t.done}
                  onChange={() => toggleTaskDone(t.id)}
                  aria-label="Выполнено"
                />
                <span
                  className={`min-w-0 flex-1 text-sm font-light ${
                    t.done ? 'text-ink/45 line-through' : ''
                  }`}
                >
                  {t.title}
                  {t.dueDate ? (
                    <span className="ml-2 text-xs text-ink/45">
                      до {t.dueDate}
                    </span>
                  ) : null}
                </span>
                {t.comment.trim() ? (
                  <span
                    className="max-w-[8rem] truncate text-[10px] font-light uppercase text-ink/45"
                    title={t.comment}
                  >
                    есть комментарий
                  </span>
                ) : null}
                {t.reminderPreset !== 'none' ? (
                  <span className="text-[10px] font-light uppercase text-ink/45">
                    напоминание
                  </span>
                ) : null}
                {t.projectSlug ? (
                  <Link
                    to={`/projects/${t.projectSlug}`}
                    className="text-xs font-light text-ink/60 underline-offset-2 hover:underline"
                  >
                    проект
                  </Link>
                ) : null}
                {t.labels.map((lb) => (
                  <span
                    key={lb}
                    className="rounded-full border border-card-border px-2 py-0.5 text-[10px] font-light uppercase text-ink/60"
                  >
                    {lb}
                  </span>
                ))}
                <button
                  type="button"
                  className="text-xs font-light text-ink/55 underline-offset-2 hover:text-ink hover:underline"
                  aria-expanded={openDetailsId === t.id}
                  onClick={() =>
                    setOpenDetailsId((id) => (id === t.id ? null : t.id))
                  }
                >
                  {openDetailsId === t.id
                    ? 'Свернуть'
                    : 'Комментарий и уведомление'}
                </button>
                <button
                  type="button"
                  className="text-xs font-light text-ink/50 hover:text-ink"
                  onClick={() => {
                    if (openDetailsId === t.id) setOpenDetailsId(null)
                    deleteTask(t.id)
                  }}
                >
                  Удалить
                </button>
              </div>
              {openDetailsId === t.id ? (
                <TaskDetailPanel task={t} updateTask={updateTask} />
              ) : null}
            </li>
          ))
        )}
      </ul>
    </main>
  )
}
