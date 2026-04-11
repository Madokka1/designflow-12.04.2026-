export type FinanceTransactionKind = 'income' | 'expense'

export type FinanceTransaction = {
  id: string
  title: string
  /** Сумма в рублях, всегда положительная */
  amountRub: number
  kind: FinanceTransactionKind
}
