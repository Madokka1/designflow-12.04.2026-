import { formatRubDots, parseAmountRub } from './parseAmountRub'
import { stageEffectiveTimeSpentSeconds } from './stageToForm'
import type { Project, ProjectStage } from '../types/project'

/** Достаточно контекста проекта для расчёта стоимости этапа при поэтапной оплате. */
export type ProjectStagedCostContext = Pick<Project, 'tags' | 'employeeHourlyRateRub'>

function useDynamicStagedCost(ctx: ProjectStagedCostContext | undefined): boolean {
  if (!ctx) return false
  const r = ctx.employeeHourlyRateRub
  if (r == null || r <= 0) return false
  return (ctx.tags ?? []).includes('поэтапная оплата')
}

/** Стоимость из поля planned (руб). */
export function stageRecordedCostRub(stage: ProjectStage): number {
  const costMatch = stage.planned.match(/Стоимость этапа:\s*([^·]+)/)
  return costMatch ? parseAmountRub(costMatch[1].trim()) : 0
}

function stageDynamicStagedCostRub(stage: ProjectStage, ratePerHour: number): number {
  const sec = stageEffectiveTimeSpentSeconds(stage) ?? 0
  return Math.round((sec / 3600) * ratePerHour)
}

/** Рубли: при поэтапной оплате и ставке — часы × ставка, иначе сумма из planned. */
export function stageCostRubForStagedOrRecorded(
  stage: ProjectStage,
  ctx?: ProjectStagedCostContext,
): number {
  if (useDynamicStagedCost(ctx)) {
    return stageDynamicStagedCostRub(stage, ctx!.employeeHourlyRateRub!)
  }
  return stageRecordedCostRub(stage)
}

/** Строка «N руб.» для карточки / модалки. */
export function formatStageCostForDisplay(
  stage: ProjectStage,
  ctx: ProjectStagedCostContext | undefined,
): string {
  return formatRubDots(stageCostRubForStagedOrRecorded(stage, ctx))
}

/**
 * Сумма рублей по этапам со статусом оплаты «оплачено» (поле «Оплата» в строке planned).
 * При поэтапной оплате и заданной ставке стоимость этапа считается по фактическому времени.
 */
export function sumStageCostsRub(
  stages: readonly ProjectStage[] | undefined,
  ctx?: ProjectStagedCostContext,
): number {
  if (!stages?.length) return 0
  let sum = 0
  for (const s of stages) {
    const payMatch = s.planned.match(/Оплата:\s*(.+)$/)
    if (!payMatch) continue
    if (payMatch[1].trim() !== 'оплачено') continue
    sum += stageCostRubForStagedOrRecorded(s, ctx)
  }
  return sum
}

/**
 * Сумма рублей по этапам со статусом оплаты «Ожидает оплаты» (как в форме этапа).
 * Для вкладки «Ожидает оплату» у проектов с поэтапной оплатой.
 */
export function sumAwaitingPaymentStageCostsRub(
  stages: readonly ProjectStage[] | undefined,
  ctx?: ProjectStagedCostContext,
): number {
  if (!stages?.length) return 0
  let sum = 0
  for (const s of stages) {
    const payMatch = s.planned.match(/Оплата:\s*(.+)$/)
    if (!payMatch) continue
    if (payMatch[1].trim().toLowerCase() !== 'ожидает оплаты') continue
    sum += stageCostRubForStagedOrRecorded(s, ctx)
  }
  return sum
}

/** Если у проекта поэтапная оплата — пересчитать `amount` из оплаченных этапов. */
export function syncStagedProjectAmount(p: Project): Project {
  if (!(p.tags ?? []).includes('поэтапная оплата')) return p
  return { ...p, amount: formatRubDots(sumStageCostsRub(p.stages, p)) }
}
