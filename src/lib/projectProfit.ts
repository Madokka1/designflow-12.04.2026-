import { parseAmountRub } from './parseAmountRub'

/**
 * Профит = общая стоимость проекта − (ставка руб/ч × фактическое время в часах).
 * Время — сумма этапов + активный таймер (как getProjectTrackedSeconds).
 */
export function computeProjectProfitRub(params: {
  amountDisplay: string
  employeeHourlyRateRub: number | undefined | null
  trackedSeconds: number
}): number {
  const totalRub = parseAmountRub(params.amountDisplay)
  const hourly = Math.max(0, Number(params.employeeHourlyRateRub) || 0)
  const sec = Math.max(0, Math.floor(params.trackedSeconds))
  const laborRub = Math.round((hourly * sec) / 3600)
  return totalRub - laborRub
}
