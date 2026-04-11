import type { ProjectStage } from '../types/project'

/** Шаблон этапов для нового проекта (пустая заготовка) */
export const DEFAULT_PROJECT_STAGES: ProjectStage[] = [
  {
    id: 's1',
    name: 'Этап 1',
    status: 'В работе',
    deadline: '—',
    planned:
      'Планируемое время: — · Стоимость этапа: — · Оплата: Ожидает оплаты',
    actual: 'фактическое время: —',
  },
]
