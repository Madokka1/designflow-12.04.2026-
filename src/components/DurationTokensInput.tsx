import {
  formatDurationTokensForInput,
  parseDurationTokensLoose,
  sanitizeDurationInput,
  sanitizeDurationInputWhileTyping,
} from '../lib/durationTokens'

type Props = {
  value: string
  onChange: (v: string) => void
  inputClass: string
  placeholder?: string
  'aria-label'?: string
}

/** Часы минуты секунды через пробел: «1 30», «0 30 0» */
export function DurationTokensInput({
  value,
  onChange,
  inputClass,
  placeholder,
  'aria-label': ariaLabel,
}: Props) {
  return (
    <input
      className={inputClass}
      placeholder={placeholder ?? '0 30 0'}
      aria-label={ariaLabel}
      inputMode="text"
      autoComplete="off"
      value={value}
      onChange={(e) =>
        onChange(sanitizeDurationInputWhileTyping(e.target.value))
      }
      onBlur={() => {
        const trimmed = sanitizeDurationInput(value)
        if (!trimmed) {
          onChange('')
          return
        }
        const p = parseDurationTokensLoose(trimmed)
        if (p) {
          onChange(formatDurationTokensForInput(p.h, p.m, p.s))
        }
      }}
    />
  )
}
