/** Завершённый отрезок учёта времени на этапе (для журнала и экспорта). */
export type TimerSessionLogEntry = {
  id: string
  endedAt: string
  projectSlug: string
  stageId: string
  projectTitle: string
  stageName: string
  seconds: number
}
