import { parseRuDate } from './parseRuDate'
import type { TaskReminderPreset, WorkspaceTask } from '../types/workspaceTask'

export const REMINDER_PRESET_LABELS: Record<TaskReminderPreset, string> = {
  none: 'Без уведомления',
  '1h': 'За час до срока',
  '1d': 'За день до срока',
  '1w': 'За неделю до срока',
  custom: 'Ручной ввод (дата и время)',
}

/** Для input type="datetime-local" из ISO или пусто. */
export function isoToDatetimeLocalValue(iso: string): string {
  if (!iso.trim()) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function datetimeLocalToIso(local: string): string {
  const t = local.trim()
  if (!t) return ''
  const d = new Date(t)
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString()
}

/** Конец календарного дня срока (локально) как опорная точка для «до срока». */
function dueDateEndOfDay(dueDateRu: string): Date | null {
  const d = parseRuDate(dueDateRu.trim())
  if (!d) return null
  d.setHours(23, 59, 59, 999)
  return d
}

/** Текст подсказки: когда сработает напоминание. */
export function taskReminderSummary(task: WorkspaceTask): string {
  const { reminderPreset, reminderAtCustom, dueDate } = task
  if (reminderPreset === 'none') return ''

  if (reminderPreset === 'custom') {
    if (!reminderAtCustom.trim()) return 'Укажите дату и время уведомления'
    const d = new Date(reminderAtCustom)
    if (Number.isNaN(d.getTime())) return 'Некорректная дата уведомления'
    return `Напоминание: ${d.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })}`
  }

  const end = dueDateEndOfDay(dueDate)
  if (!end) return 'Укажите срок задачи (ДД.ММ.ГГГГ) для расчёта напоминания'

  const ms =
    reminderPreset === '1h'
      ? 60 * 60 * 1000
      : reminderPreset === '1d'
        ? 24 * 60 * 60 * 1000
        : 7 * 24 * 60 * 60 * 1000
  const at = new Date(end.getTime() - ms)
  return `Напоминание: ${at.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })} (до срока)`
}
