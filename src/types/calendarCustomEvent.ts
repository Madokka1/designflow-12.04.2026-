export type CalendarCustomEvent = {
  id: string
  title: string
  /** Дата в формате ДД.ММ.ГГГГ */
  dateRaw: string
  comment?: string
}
