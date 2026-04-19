import { formatStageCostForDisplay } from './stageCostSum'
import type { Project, ProjectStage } from '../types/project'
import { PAYMENT_STATUSES } from '../types/stageForm'
import { stagePlannedRows } from './stagePlannedRows'
import { stageActualTimeLine } from './stageToForm'

export type StageMetricRow = { label: string; value: string }

/** Короткие подписи в сетке карточки этапа */
export function shortStageMetricLabel(label: string): string {
  const n = label.trim().toLowerCase()
  if (n === 'планируемое время') return 'План'
  if (n === 'стоимость этапа') return 'Стоимость'
  if (n === 'фактическое время') return 'Время'
  return label
}

/** Одна строка planned для текста в модалке (с короткими подписисями). */
export function shortenStagePlannedDisplayLine(line: string): string {
  const row = parseStageMetricLine(line)
  return `${shortStageMetricLabel(row.label)}: ${row.value}`
}

/** Строка planned для модалки: при поэтапной оплате стоимость пересчитывается по времени × ставка. */
export function stagePlannedDisplayLineForProject(
  line: string,
  stage: ProjectStage,
  project: Project,
): string {
  const row = parseStageMetricLine(line)
  if (row.label.toLowerCase().includes('стоимость')) {
    return `${shortStageMetricLabel(row.label)}: ${formatStageCostForDisplay(stage, project)}`
  }
  return shortenStagePlannedDisplayLine(line)
}

/** «Подпись: значение» из одной строки блока этапа */
export function parseStageMetricLine(line: string): StageMetricRow {
  const t = line.trim()
  const m = t.match(/^(.+?):\s*(.*)$/s)
  if (!m) return { label: t, value: '' }
  return { label: m[1].trim(), value: m[2].trim() }
}

/** Подпись оплаты для тега в шапке карточки этапа (как на карточке проекта). */
export function stagePaymentTagLabel(stage: ProjectStage): string | null {
  const tag0 = stage.modalTags?.[0]?.trim()
  if (tag0 && (PAYMENT_STATUSES as readonly string[]).includes(tag0)) {
    return tag0
  }
  for (const line of stagePlannedRows(stage.planned)) {
    const row = parseStageMetricLine(line)
    if (row.label.toLowerCase() !== 'оплата') continue
    const v = row.value.trim()
    if (!v) continue
    if ((PAYMENT_STATUSES as readonly string[]).includes(v)) return v
    const hit = (PAYMENT_STATUSES as readonly string[]).find(
      (p) => p.toLowerCase() === v.toLowerCase(),
    )
    if (hit) return hit
    return v
  }
  return null
}

/** Строки planned без блока «Оплата» (оплата показывается отдельным тегом). */
export function stagePlannedRowsWithoutPayment(planned: string): string[] {
  return stagePlannedRows(planned).filter((line) => {
    const { label } = parseStageMetricLine(line)
    return label.toLowerCase() !== 'оплата'
  })
}

/** Строки для правой колонки карточки: план (без оплаты) + фактическое время */
export function stageCardMetricRows(
  stage: ProjectStage,
  project?: Project,
): StageMetricRow[] {
  const mapRow = (row: StageMetricRow): StageMetricRow => {
    const short = shortStageMetricLabel(row.label)
    const isCost = row.label.toLowerCase().includes('стоимость')
    const value =
      isCost && project != null
        ? formatStageCostForDisplay(stage, project)
        : row.value
    return { label: short, value }
  }
  return [
    ...stagePlannedRowsWithoutPayment(stage.planned).map((line) =>
      mapRow(parseStageMetricLine(line)),
    ),
    mapRow(parseStageMetricLine(stageActualTimeLine(stage))),
  ]
}
