import { useState } from 'react'
import { formatRubDots } from '../lib/parseAmountRub'

type Props = {
  valueDigits: string
  onChangeDigits: (digits: string) => void
  inputClass: string
  placeholder?: string
  'aria-label'?: string
}

/** Ввод только цифр; вне фокуса — формат 10.000 руб. */
export function CostRubInput({
  valueDigits,
  onChangeDigits,
  inputClass,
  placeholder,
  'aria-label': ariaLabel,
}: Props) {
  const [focused, setFocused] = useState(false)
  const digits = valueDigits.replace(/\D/g, '')
  const n = Number.parseInt(digits, 10)
  const display = focused
    ? digits
    : digits && !Number.isNaN(n)
      ? formatRubDots(Math.max(0, n))
      : ''

  return (
    <input
      className={inputClass}
      placeholder={placeholder}
      aria-label={ariaLabel}
      inputMode="numeric"
      autoComplete="off"
      value={display}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={(e) => onChangeDigits(e.target.value.replace(/\D/g, ''))}
    />
  )
}
