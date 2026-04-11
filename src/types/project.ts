export type StageChecklistItem = {
  id: string
  label: string
  done?: boolean
}

export type ProjectStage = {
  id: string
  name: string
  status: string
  deadline: string
  planned: string
  actual: string
  /** Накопленное фактическое время по этапу (сек), синхронизируется с таймером */
  timeSpentSeconds?: number
  /** первая строка в макете — факт в тёмной капсуле */
  actualInPill?: boolean
  /** Текст под карточкой проекта в модалке этапа */
  description?: string
  checklist?: readonly StageChecklistItem[]
  /** Доп. метки в блоке этапа (например статус оплаты) */
  modalTags?: readonly string[]
  /** Когда этап создан (ISO), для «недавних» на главной */
  addedAt?: string
}

export type Project = {
  id: string
  /** URL-сегмент, например project1 */
  slug: string
  title: string
  client: string
  amount: string
  deadline: string
  progress: number
  tags?: readonly string[]
  stages?: readonly ProjectStage[]
  /** Комментарий из формы создания/редактирования */
  comment?: string
}
