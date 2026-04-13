import type { TaskReminderPreset, WorkspaceTask } from '../types/workspaceTask'
import { TASK_REMINDER_PRESETS } from '../types/workspaceTask'

function isPreset(x: unknown): x is TaskReminderPreset {
  return (
    typeof x === 'string' &&
    (TASK_REMINDER_PRESETS as readonly string[]).includes(x)
  )
}

/** Дозаполняет поля задачи (импорт, старые записи без comment / reminder). */
export function normalizeWorkspaceTask(
  t: Partial<WorkspaceTask> & { id: string },
): WorkspaceTask {
  const title =
    typeof t.title === 'string' && t.title.trim() ? t.title.trim() : 'Задача'
  return {
    id: t.id,
    title,
    done: Boolean(t.done),
    dueDate: typeof t.dueDate === 'string' ? t.dueDate : '',
    projectSlug:
      t.projectSlug === null || typeof t.projectSlug === 'string'
        ? (t.projectSlug ?? null)
        : null,
    labels: Array.isArray(t.labels) ? [...t.labels] : [],
    sortOrder: typeof t.sortOrder === 'number' ? t.sortOrder : 0,
    comment: typeof t.comment === 'string' ? t.comment : '',
    reminderPreset: isPreset(t.reminderPreset) ? t.reminderPreset : 'none',
    reminderAtCustom:
      typeof t.reminderAtCustom === 'string' ? t.reminderAtCustom : '',
  }
}
