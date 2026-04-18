import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from 'react'
import { createPortal } from 'react-dom'
import { formatDateRu, parseRuDateStrict } from '../lib/parseRuDate'
import { useFocusTrap } from '../hooks/useFocusTrap'

function digitsToMasked(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 8)
  if (d.length <= 2) return d
  if (d.length <= 4) return `${d.slice(0, 2)}.${d.slice(2)}`
  return `${d.slice(0, 2)}.${d.slice(2, 4)}.${d.slice(4)}`
}

const WEEKDAY_LABELS = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'] as const

const MONTH_NAMES_RU = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
] as const

const PANEL_W_PX = 280
const PANEL_H_EST = 300

function sameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function buildMonthGrid(year: number, monthIndex: number): Date[] {
  const first = new Date(year, monthIndex, 1)
  const start = new Date(first)
  const mondayOffset = (first.getDay() + 6) % 7
  start.setDate(1 - mondayOffset)
  const cells: Date[] = []
  const cur = new Date(start)
  for (let i = 0; i < 42; i++) {
    cells.push(new Date(cur))
    cur.setDate(cur.getDate() + 1)
  }
  return cells
}

type MiniCalendarProps = {
  panelId: string
  panelRef: RefObject<HTMLDivElement | null>
  fixedStyle: { top: number; left: number }
  initialAnchor: Date
  selected: Date | null
  onPick: (d: Date) => void
  onClose: () => void
}

function MiniCalendarPopover({
  panelId,
  panelRef,
  fixedStyle,
  initialAnchor,
  selected,
  onPick,
  onClose,
}: MiniCalendarProps) {
  const [viewYear, setViewYear] = useState(() => initialAnchor.getFullYear())
  const [viewMonth, setViewMonth] = useState(() => initialAnchor.getMonth())

  useFocusTrap(true, panelRef)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const grid = buildMonthGrid(viewYear, viewMonth)
  const monthLabel = `${MONTH_NAMES_RU[viewMonth]} ${viewYear}`

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11)
      setViewYear((y) => y - 1)
    } else {
      setViewMonth((m) => m - 1)
    }
  }

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0)
      setViewYear((y) => y + 1)
    } else {
      setViewMonth((m) => m + 1)
    }
  }

  return (
    <div
      id={panelId}
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-label="Выбор даты"
      style={{
        position: 'fixed',
        top: fixedStyle.top,
        left: fixedStyle.left,
        width: PANEL_W_PX,
        zIndex: 200,
      }}
      className="rounded-[3px] border border-card-border bg-surface p-2.5 shadow-[0_8px_32px_rgba(10,10,10,0.12)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.45)]"
    >
      <div className="mb-2 flex items-center justify-between gap-1">
        <button
          type="button"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[3px] border border-ink/10 text-sm text-ink transition-colors hover:bg-ink/[0.05] dark:border-white/15"
          aria-label="Предыдущий месяц"
          onClick={prevMonth}
        >
          ‹
        </button>
        <span className="min-w-0 flex-1 text-center text-xs font-light tracking-[-0.02em] text-ink">
          {monthLabel}
        </span>
        <button
          type="button"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[3px] border border-ink/10 text-sm text-ink transition-colors hover:bg-ink/[0.05] dark:border-white/15"
          aria-label="Следующий месяц"
          onClick={nextMonth}
        >
          ›
        </button>
      </div>
      <div className="grid grid-cols-7 gap-y-0.5 text-center">
        {WEEKDAY_LABELS.map((w) => (
          <div
            key={w}
            className="pb-1 text-[9px] font-light uppercase tracking-[-0.02em] text-ink/45"
          >
            {w}
          </div>
        ))}
        {grid.map((d) => {
          const inMonth = d.getMonth() === viewMonth
          const isToday = sameCalendarDay(d, today)
          const isSelected = selected && sameCalendarDay(d, selected)
          return (
            <button
              key={d.getTime()}
              type="button"
              onClick={() => {
                onPick(d)
                onClose()
              }}
              className={`mx-auto flex h-8 w-8 items-center justify-center rounded-[3px] text-xs font-light tabular-nums transition-colors ${
                !inMonth
                  ? 'text-ink/35 hover:bg-ink/[0.04] dark:text-ink/40 dark:hover:bg-white/[0.06]'
                  : isSelected
                    ? 'bg-ink text-white dark:bg-white dark:text-ink'
                    : isToday
                      ? 'border border-ink/25 text-ink dark:border-white/30'
                      : 'text-ink hover:bg-ink/[0.06] dark:hover:bg-white/[0.08]'
              }`}
            >
              {d.getDate()}
            </button>
          )
        })}
      </div>
    </div>
  )
}

type Props = {
  value: string
  onChange: (v: string) => void
  inputClass: string
  'aria-label'?: string
  id?: string
}

export function DeadlineDdMmYyyyInput({
  value,
  onChange,
  inputClass,
  'aria-label': ariaLabel,
  id,
}: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const calendarPanelRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [pickerMount, setPickerMount] = useState(0)
  const [calPos, setCalPos] = useState<{ top: number; left: number } | null>(
    null,
  )
  const panelId = useId()

  const handleTextChange = useCallback(
    (raw: string) => {
      onChange(digitsToMasked(raw))
    },
    [onChange],
  )

  const handleBlur = useCallback(() => {
    const t = value.trim()
    if (!t) {
      onChange('')
      return
    }
    const d = parseRuDateStrict(t)
    if (d) {
      onChange(formatDateRu(d))
      return
    }
    const digits = t.replace(/\D/g, '')
    if (digits.length === 8) {
      const candidate = `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4)}`
      const d2 = parseRuDateStrict(candidate)
      if (d2) onChange(formatDateRu(d2))
    }
  }, [value, onChange])

  const selectedDate = parseRuDateStrict(value.trim())
  const anchorDate = selectedDate ?? new Date()

  useLayoutEffect(() => {
    if (!open) return
    const wrap = wrapperRef.current
    if (!wrap) return

    const update = () => {
      const r = wrap.getBoundingClientRect()
      let left = r.right - PANEL_W_PX
      left = Math.max(10, Math.min(left, window.innerWidth - PANEL_W_PX - 10))
      let top = r.bottom + 6
      if (top + PANEL_H_EST > window.innerHeight - 10) {
        top = Math.max(10, r.top - PANEL_H_EST - 6)
      }
      setCalPos({ top, left })
    }

    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [open, pickerMount])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node
      if (wrapperRef.current?.contains(t)) return
      if (calendarPanelRef.current?.contains(t)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const pickerLabel =
    ariaLabel != null ? `${ariaLabel}: открыть календарь` : 'Открыть календарь'

  return (
    <div ref={wrapperRef} className="flex flex-wrap items-end gap-2">
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        className={`${inputClass} min-w-[7.5rem] flex-1 sm:min-w-[9rem]`}
        placeholder="ДД.ММ.ГГГГ"
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => handleTextChange(e.target.value)}
        onBlur={handleBlur}
      />
      <button
        type="button"
        className="h-8 shrink-0 rounded-full border border-card-border px-3 text-xs font-light tracking-[-0.02em] text-ink transition-colors hover:bg-ink/[0.04] motion-reduce:transition-colors"
        aria-label={pickerLabel}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={open ? panelId : undefined}
        onClick={() => {
          setOpen((v) => {
            const next = !v
            if (next) setPickerMount((n) => n + 1)
            return next
          })
        }}
      >
        Календарь
      </button>
      {open && calPos && typeof document !== 'undefined'
        ? createPortal(
            <MiniCalendarPopover
              key={pickerMount}
              panelId={panelId}
              panelRef={calendarPanelRef}
              fixedStyle={calPos}
              initialAnchor={anchorDate}
              selected={selectedDate}
              onPick={(d) => onChange(formatDateRu(d))}
              onClose={() => setOpen(false)}
            />,
            document.body,
          )
        : null}
    </div>
  )
}
