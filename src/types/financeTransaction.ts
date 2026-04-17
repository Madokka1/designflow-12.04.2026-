export type FinanceTransactionKind = 'income' | 'expense'

export type FinanceTransaction = {
  id: string
  title: string
  /** Сумма в рублях, всегда положительная */
  amountRub: number
  kind: FinanceTransactionKind
  /** ISO дата создания (из Supabase created_at); для старых записей может отсутствовать */
  createdAt?: string
}
