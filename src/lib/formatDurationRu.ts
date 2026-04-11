/** «20ч 49мин 10сек» — как в макете этапа */
export function formatDurationRu(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return `${h}ч ${m}мин ${sec}сек`
}
