import type { TimerSessionLogEntry } from '../types/timerSessionLog'

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function row(cells: string[]): string {
  return cells.map(escapeCsvCell).join(',')
}

export function buildTimerSessionsCsv(entries: readonly TimerSessionLogEntry[]): string {
  const lines: string[] = []
  lines.push('# Журнал сессий таймера')
  lines.push(
    row([
      'endedAt',
      'seconds',
      'projectSlug',
      'stageId',
      'projectTitle',
      'stageName',
    ]),
  )
  const sorted = [...entries].sort(
    (a, b) => new Date(b.endedAt).getTime() - new Date(a.endedAt).getTime(),
  )
  for (const e of sorted) {
    lines.push(
      row([
        e.endedAt,
        String(e.seconds),
        e.projectSlug,
        e.stageId,
        e.projectTitle,
        e.stageName,
      ]),
    )
  }
  return lines.join('\n')
}
