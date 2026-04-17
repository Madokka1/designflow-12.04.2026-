/** Парсит суммы вроде «40.000 руб.» в число (руб., без копеек). */
export function parseAmountRub(raw: string): number {
  const digits = raw.replace(/\D/g, '')
  if (!digits) return 0
  return parseInt(digits, 10)
}

export function formatRub(amount: number): string {
  return (
    new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(amount) +
    ' руб.'
  )
}

/** «10.000 руб.» — точки как разделитель тысяч (как в макете финансов) */
export function formatRubDots(amount: number): string {
  const n = new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: 0,
  }).format(amount)
  return `${n.replace(/\s/g, '.')} руб.`
}

