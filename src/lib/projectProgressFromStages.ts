import type { ProjectStage } from '../types/project'

/** Доля этапов со статусом «завершен» (без учёта регистра), 0–100. */
export function projectProgressPercentFromStages(
  stages: readonly ProjectStage[] | undefined,
): number {
  const list = stages?.length ? [...stages] : []
  if (list.length === 0) return 0
  const completed = list.filter(
    (s) => s.status.trim().toLowerCase() === 'завершен',
  ).length
  return Math.min(100, Math.max(0, Math.round((completed / list.length) * 100)))
}
