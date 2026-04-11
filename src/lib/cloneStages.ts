import type { ProjectStage } from '../types/project'

function newId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `st-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

/** Копия этапов с новыми id (для шаблонов и дублирования). */
export function cloneStagesWithNewIds(
  stages: readonly ProjectStage[],
): ProjectStage[] {
  return stages.map((s) => ({
    ...s,
    id: newId(),
    checklist: s.checklist?.map((c) => ({ ...c, id: newId() })),
  }))
}
