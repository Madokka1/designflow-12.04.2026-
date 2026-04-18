import type { FinanceTransaction } from '../types/financeTransaction'
import type { Project } from '../types/project'
import { PROJECT_PAYMENT_STATUSES } from '../types/projectForm'
import { parseAmountRub } from './parseAmountRub'
import { getProjectSection } from './projectSection'

function paymentTag(p: Project): string | null {
  for (const t of p.tags ?? []) {
    if ((PROJECT_PAYMENT_STATUSES as readonly string[]).includes(t)) {
      return t
    }
  }
  return null
}

/**
 * «Оборот» / общая выручка: как на странице Финансы.
 * — суммы проектов с оплатой «оплачено» (включая раздел «Личные»);
 * — плюс суммы по проектам «поэтапная оплата» не из «Личные» (`amount` = уже оплаченные этапы);
 * — плюс чистый результат транзакций (доход − расход).
 */
export function portfolioTurnoverRub(
  projects: readonly Project[],
  financeTransactions: readonly FinanceTransaction[],
): number {
  let paidProjectsSum = 0
  let stagedNonPersonalSum = 0
  for (const p of projects) {
    const a = parseAmountRub(p.amount)
    const pay = paymentTag(p)
    if (pay === 'оплачено') paidProjectsSum += a
    if (pay === 'поэтапная оплата' && getProjectSection(p) !== 'Личные') {
      stagedNonPersonalSum += a
    }
  }
  let transactionNet = 0
  for (const tx of financeTransactions) {
    transactionNet += tx.kind === 'income' ? tx.amountRub : -tx.amountRub
  }
  return paidProjectsSum + stagedNonPersonalSum + transactionNet
}
