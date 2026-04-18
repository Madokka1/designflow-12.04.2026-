import { formatRubDots, parseAmountRub } from './parseAmountRub'
import type { Project, ProjectStage } from '../types/project'

/**
 * Сумма рублей по этапам со статусом оплаты «оплачено» (поле «Оплата» в строке planned).
 */
export function sumStageCostsRub(
  stages: readonly ProjectStage[] | undefined,
): number {
  if (!stages?.length) return 0
  let sum = 0
  for (const s of stages) {
    const payMatch = s.planned.match(/Оплата:\s*(.+)$/)
    if (!payMatch) continue
    if (payMatch[1].trim() !== 'оплачено') continue
    const costMatch = s.planned.match(/Стоимость этапа:\s*([^·]+)/)
    if (!costMatch) continue
    sum += parseAmountRub(costMatch[1].trim())
  }
  return sum
}

/**
 * Сумма рублей по этапам со статусом оплаты «Ожидает оплаты» (как в форме этапа).
 * Для вкладки «Ожидает оплату» у проектов с поэтапной оплатой.
 */
export function sumAwaitingPaymentStageCostsRub(
  stages: readonly ProjectStage[] | undefined,
): number {
  if (!stages?.length) return 0
  let sum = 0
  for (const s of stages) {
    const payMatch = s.planned.match(/Оплата:\s*(.+)$/)
    if (!payMatch) continue
    if (payMatch[1].trim().toLowerCase() !== 'ожидает оплаты') continue
    const costMatch = s.planned.match(/Стоимость этапа:\s*([^·]+)/)
    if (!costMatch) continue
    sum += parseAmountRub(costMatch[1].trim())
  }
  return sum
}

/** Если у проекта поэтапная оплата — пересчитать `amount` из оплаченных этапов. */
export function syncStagedProjectAmount(p: Project): Project {
  if (!(p.tags ?? []).includes('поэтапная оплата')) return p
  return { ...p, amount: formatRubDots(sumStageCostsRub(p.stages)) }
}
