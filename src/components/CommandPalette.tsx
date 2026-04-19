import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { useNotesContext } from '../hooks/useNotesContext'
import { useProjects } from '../hooks/useProjects'
import { notePlainTextHaystack } from '../lib/noteSearchText'
import { parseRuDate } from '../lib/parseRuDate'

function isoDayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

type Item = {
  id: string
  label: string
  hint?: string
  to: string
  /** Доп. строки для поиска */
  haystack?: string
}

const ROUTE_ITEMS: Item[] = [
  { id: 'home', label: 'Главная', hint: 'Обзор', to: '/' },
  { id: 'projects', label: 'Проекты', to: '/projects' },
  { id: 'tasks', label: 'Задачи', to: '/tasks' },
  { id: 'clients', label: 'Клиенты', to: '/clients' },
  { id: 'templates', label: 'Шаблоны проектов', to: '/templates' },
  { id: 'finance', label: 'Финансы', to: '/finance' },
  { id: 'calendar', label: 'Календарь', to: '/calendar' },
  { id: 'deadlines', label: 'Сроки', to: '/deadlines' },
  { id: 'reports', label: 'Отчёты', to: '/reports' },
  { id: 'resume', label: 'Резюме', to: '/resume' },
  { id: 'notes', label: 'Заметки', to: '/notes' },
  { id: 'settings', label: 'Настройки', to: '/settings' },
]

function parseTo(to: string): { path: string; search: string; hash: string } {
  const hashIdx = to.indexOf('#')
  const base = hashIdx >= 0 ? to.slice(0, hashIdx) : to
  const hash = hashIdx >= 0 ? to.slice(hashIdx) : ''
  const qIdx = base.indexOf('?')
  if (qIdx === -1) {
    return { path: base, search: '', hash }
  }
  return {
    path: base.slice(0, qIdx),
    search: base.slice(qIdx),
    hash,
  }
}

export function CommandPalette() {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const location = useLocation()
  const {
    projects,
    clients,
    tasks,
    financeTransactions,
    calendarCustomEvents,
  } = useProjects()
  const { notes } = useNotesContext()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)

  const allItems = useMemo(() => {
    const calendarItems: Item[] = []
    for (const c of calendarCustomEvents) {
      if (c.taskId) continue
      const d = parseRuDate(c.dateRaw)
      if (!d) continue
      calendarItems.push({
        id: `cal-ce-${c.id}`,
        label: c.title,
        hint: 'Событие календаря',
        to: `/calendar#cal-day-${isoDayKey(d)}`,
        haystack: `${c.dateRaw} ${c.comment ?? ''}`,
      })
    }
    for (const t of tasks) {
      const d = parseRuDate(t.dueDate)
      if (!d) continue
      calendarItems.push({
        id: `cal-task-${t.id}`,
        label: t.title,
        hint: 'Задача в календаре',
        to: `/calendar#cal-day-${isoDayKey(d)}`,
        haystack: `${t.dueDate} ${t.comment} ${t.labels.join(' ')}`,
      })
    }
    for (const p of projects) {
      const d = parseRuDate(p.deadline ?? '')
      if (!d) continue
      calendarItems.push({
        id: `cal-pd-${p.slug}`,
        label: `Дедлайн проекта: ${p.title}`,
        hint: 'Календарь',
        to: `/calendar#cal-day-${isoDayKey(d)}`,
        haystack: `${p.deadline} ${p.client}`,
      })
      for (const s of p.stages ?? []) {
        const sd = parseRuDate(s.deadline ?? '')
        if (!sd) continue
        calendarItems.push({
          id: `cal-sd-${p.slug}-${s.id}`,
          label: `${s.name} · ${p.title}`,
          hint: 'Этап в календаре',
          to: `/calendar#cal-day-${isoDayKey(sd)}`,
          haystack: s.deadline,
        })
      }
    }

    const dynamic: Item[] = [
      ...projects.map((p) => ({
        id: `project-${p.slug}`,
        label: p.title,
        hint: 'Проект',
        to: `/projects/${p.slug}`,
        haystack: `${p.slug} ${p.client ?? ''} ${p.comment ?? ''} ${(p.tags ?? []).join(' ')}`,
      })),
      ...notes.map((n) => ({
        id: `note-${n.slug}`,
        label: n.title || 'Без названия',
        hint: 'Заметка',
        to: `/notes/${n.slug}`,
        haystack: notePlainTextHaystack(n),
      })),
      ...clients.map((c) => ({
        id: `client-${c.id}`,
        label: c.name,
        hint: 'Клиент',
        to: `/clients?focus=${encodeURIComponent(c.id)}`,
        haystack: `${c.email} ${c.company} ${c.phone}`,
      })),
      ...tasks.map((t) => ({
        id: `task-${t.id}`,
        label: t.title,
        hint: 'Задача',
        to: `/tasks#task-${t.id}`,
        haystack: t.labels.join(' '),
      })),
      ...financeTransactions.map((tx) => ({
        id: `fin-${tx.id}`,
        label: tx.title,
        hint: tx.kind === 'income' ? 'Доход' : 'Расход',
        to: `/finance#finance-tx-${tx.id}`,
        haystack: `${tx.amountRub}`,
      })),
      ...calendarItems,
    ]
    return [...ROUTE_ITEMS, ...dynamic]
  }, [
    projects,
    notes,
    clients,
    tasks,
    financeTransactions,
    calendarCustomEvents,
  ])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return ROUTE_ITEMS
    return allItems.filter((it) => {
      const h = (it.haystack ?? '').toLowerCase()
      return (
        it.label.toLowerCase().includes(s) ||
        (it.hint?.toLowerCase().includes(s) ?? false) ||
        h.includes(s) ||
        it.to.toLowerCase().includes(s)
      )
    })
  }, [q, allItems])

  const activeIndex =
    filtered.length === 0 ? 0 : Math.min(active, filtered.length - 1)

  const close = useCallback(() => {
    setOpen(false)
    setQ('')
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((o) => {
          if (!o) setActive(0)
          return !o
        })
        return
      }
      if (!open) return
      if (e.key === 'Escape') {
        e.preventDefault()
        close()
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActive((i) => Math.min(i + 1, Math.max(0, filtered.length - 1)))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActive((i) => Math.max(i - 1, 0))
        return
      }
      if (e.key === 'Enter' && filtered.length > 0) {
        e.preventDefault()
        const i = Math.min(active, Math.max(0, filtered.length - 1))
        navigate(filtered[i].to)
        close()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, close, filtered, active, navigate])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  useFocusTrap(open, panelRef)

  if (!open) return null

  const node = (
    <div className="fixed inset-0 z-[70] flex items-start justify-center pt-[12vh] px-4">
      <button
        type="button"
        className="ui-modal-backdrop absolute inset-0 bg-surface/60 backdrop-blur-sm"
        aria-label="Закрыть"
        onClick={close}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="ui-modal-panel-center relative w-full max-w-lg border border-card-border bg-surface shadow-lg"
      >
        <div className="border-b border-[rgba(10,10,10,0.08)] px-4 py-3 dark:border-white/10">
          <span id={titleId} className="sr-only">
            Быстрый переход и поиск
          </span>
          <input
            autoFocus
            className="w-full border-0 bg-transparent py-1 text-base font-light tracking-[-0.03em] text-ink outline-none placeholder:text-ink/40"
            placeholder="Раздел или поиск по проектам, заметкам, клиентам, задачам…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setActive(0)
            }}
            aria-activedescendant={
              filtered[activeIndex]
                ? `cmd-${filtered[activeIndex].id}`
                : undefined
            }
          />
          <p className="mt-1 text-[10px] font-light text-ink/45">
            ↑↓ выбор · Enter — открыть · Esc — закрыть · ⌘K / Ctrl+K — открыть или
            закрыть палитру
          </p>
        </div>
        <div className="border-b border-[rgba(10,10,10,0.06)] px-4 py-2 dark:border-white/10">
          <p className="text-[10px] font-light uppercase tracking-[-0.02em] text-ink/40">
            Подсказки
          </p>
          <ul className="mt-1 space-y-0.5 text-[10px] font-light leading-snug text-ink/50">
            <li>
              <kbd className="rounded-[3px] border border-card-border px-1 font-mono text-[9px]">
                ⌘K
              </kbd>{' '}
              /{' '}
              <kbd className="rounded-[3px] border border-card-border px-1 font-mono text-[9px]">
                Ctrl+K
              </kbd>{' '}
              — командная палитра
            </li>
            <li>
              <kbd className="rounded-[3px] border border-card-border px-1 font-mono text-[9px]">
                Esc
              </kbd>{' '}
              — закрыть диалог / палитру (где открыто)
            </li>
            <li>
              <kbd className="rounded-[3px] border border-card-border px-1 font-mono text-[9px]">
                Tab
              </kbd>{' '}
              — переход по полям; в модальных окнах фокус не уходит за пределы окна
            </li>
          </ul>
        </div>
        <ul className="max-h-[min(50vh,320px)] overflow-y-auto py-2" role="listbox">
          {filtered.length === 0 ? (
            <li className="px-4 py-3 text-sm font-light text-ink/50">
              Ничего не найдено
            </li>
          ) : (
            filtered.map((it, i) => {
              const selected = i === activeIndex
              const { path, search, hash } = parseTo(it.to)
              const here =
                location.pathname === path &&
                location.search === search &&
                (!hash || window.location.hash === hash)
              return (
                <li key={it.id} role="option" aria-selected={selected}>
                  <button
                    id={`cmd-${it.id}`}
                    type="button"
                    className={`flex w-full flex-col items-start gap-0.5 px-4 py-2.5 text-left text-sm font-light transition-colors ${
                      selected ? 'bg-ink/[0.06] text-ink' : 'text-ink/80'
                    }`}
                    onClick={() => {
                      navigate(it.to)
                      close()
                    }}
                    onMouseEnter={() => setActive(i)}
                  >
                    <span>
                      {it.label}
                      {here ? (
                        <span className="ml-2 text-[10px] uppercase text-ink/40">
                          сейчас
                        </span>
                      ) : null}
                    </span>
                    {it.hint ? (
                      <span className="text-xs text-ink/45">{it.hint}</span>
                    ) : null}
                  </button>
                </li>
              )
            })
          )}
        </ul>
      </div>
    </div>
  )

  return createPortal(node, document.body)
}
