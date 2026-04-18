import type { ProjectStage } from '../types/project'

/** Ключ dataTransfer для id этапа (text/plain — совместимость с Safari). */
export const STAGE_DND_TYPE = 'text/plain'

/** Вставить этап `dragId` перед позицией этапа `dropId` в списке. */
export function reorderStagesBeforeTarget(
  stages: readonly ProjectStage[],
  dragId: string,
  dropId: string,
): ProjectStage[] {
  if (dragId === dropId) return [...stages]
  const dragItem = stages.find((s) => s.id === dragId)
  if (!dragItem) return [...stages]
  const without = stages.filter((s) => s.id !== dragId)
  const insertBefore = without.findIndex((s) => s.id === dropId)
  if (insertBefore === -1) return [...without, dragItem]
  return [...without.slice(0, insertBefore), dragItem, ...without.slice(insertBefore)]
}

/** Переместить этап в конец списка. */
export function reorderStagesToEnd(
  stages: readonly ProjectStage[],
  dragId: string,
): ProjectStage[] {
  if (stages[stages.length - 1]?.id === dragId) return [...stages]
  const dragItem = stages.find((s) => s.id === dragId)
  if (!dragItem) return [...stages]
  const without = stages.filter((s) => s.id !== dragId)
  return [...without, dragItem]
}
