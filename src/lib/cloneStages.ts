import type { ProjectStage } from '../types/project'
import { randomUuid } from './isUuid'

function newId(): string {
  return randomUuid()
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
