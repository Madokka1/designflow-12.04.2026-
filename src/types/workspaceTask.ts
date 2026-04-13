export const TASK_REMINDER_PRESETS = [
  'none',
  '1h',
  '1d',
  '1w',
  'custom',
] as const

export type TaskReminderPreset = (typeof TASK_REMINDER_PRESETS)[number]

export type WorkspaceTask = {
  id: string
  title: string
  done: boolean
  /** ДД.ММ.ГГГГ или пусто */
  dueDate: string
  /** Привязка к проекту по slug */
  projectSlug: string | null
  labels: string[]
  sortOrder: number
  comment: string
  /** Относительно срока (кроме custom) или своя дата в reminderAtCustom */
  reminderPreset: TaskReminderPreset
  /** ISO 8601, только при reminderPreset === 'custom' */
  reminderAtCustom: string
}
