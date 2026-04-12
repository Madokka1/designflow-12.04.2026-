import { useCallback, useRef } from 'react'
import {
  formatDateRu,
  parseRuDateStrict,
  ruDeadlineToIso,
} from '../lib/parseRuDate'

function digitsToMasked(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 8)
  if (d.length <= 2) return d
  if (d.length <= 4) return `${d.slice(0, 2)}.${d.slice(2)}`
  return `${d.slice(0, 2)}.${d.slice(2, 4)}.${d.slice(4)}`
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
  const datePickerRef = useRef<HTMLInputElement>(null)
  const iso = ruDeadlineToIso(value)

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

  const openPicker = () => {
    const el = datePickerRef.current
    if (!el) return
    try {
      el.showPicker?.()
    } catch {
      el.focus()
      el.click()
    }
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
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
      <input
        ref={datePickerRef}
        type="date"
        className="absolute -left-[9999px] h-px w-px opacity-0"
        tabIndex={-1}
        aria-hidden
        value={iso}
        onChange={(e) => {
          const v = e.target.value
          if (!v) {
            onChange('')
            return
          }
          const [y, m, day] = v.split('-').map(Number)
          if (!y || !m || !day) return
          const d = new Date(y, m - 1, day)
          if (
            d.getFullYear() !== y ||
            d.getMonth() !== m - 1 ||
            d.getDate() !== day
          ) {
            return
          }
          onChange(formatDateRu(d))
        }}
      />
      <button
        type="button"
        className="h-8 shrink-0 rounded-full border border-card-border px-3 text-xs font-light tracking-[-0.02em] text-ink transition-colors hover:bg-ink/[0.04] motion-reduce:transition-colors"
        onClick={openPicker}
        aria-label={
          ariaLabel ? `${ariaLabel}: открыть календарь` : 'Открыть календарь'
        }
      >
        Календарь
      </button>
    </div>
  )
}
