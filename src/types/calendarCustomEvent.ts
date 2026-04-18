export type CalendarCustomEvent = {
  id: string
  title: string
  /** Дата в формате ДД.ММ.ГГГГ */
  dateRaw: string
  comment?: string
  /** Связанная задача (создаётся при добавлении события из календаря) */
  taskId?: string | null
}
