import { formatDurationRu } from './formatDurationRu'
import {
  formatDurationTokensForInput,
  parseDurationRuPhrase,
  parseDurationTokensLoose,
} from './durationTokens'
import { parseAmountRub } from './parseAmountRub'
import type { ProjectStage } from '../types/project'
import {
  PAYMENT_STATUSES,
  STAGE_STATUSES,
  type CreateStageForm,
} from '../types/stageForm'

function normalizeStageStatus(status: string): CreateStageForm['stageStatus'] {
  const s = status.trim()
  if ((STAGE_STATUSES as readonly string[]).includes(s)) {
    return s as CreateStageForm['stageStatus']
  }
  if (s === 'Ожидает') return 'ожидает'
  return 'В работе'
}

function parsePaymentFromPlanned(planned: string): CreateStageForm['paymentStatus'] | null {
  const m = planned.match(/Оплата:\s*(.+)$/)
  if (!m) return null
  const raw = m[1].trim()
  if ((PAYMENT_STATUSES as readonly string[]).includes(raw)) {
    return raw as CreateStageForm['paymentStatus']
  }
  return null
}

function plannedTimeInputFromPlanned(planned: string): string {
  const m = planned.match(/Планируемое время:\s*([^·]+)/)
  if (!m) return ''
  const inner = m[1].trim()
  if (!inner || inner === '—') return ''
  const p = parseDurationRuPhrase(inner)
  if (p) return formatDurationTokensForInput(p.h, p.m, p.s)
  return ''
}

function costDigitsFromPlannedSegment(seg: string): string {
  const raw = seg.trim()
  if (!raw || raw === '—') return ''
  const n = parseAmountRub(raw)
  return String(Math.max(0, n))
}

function commentFromActual(actual: string): string {
  const sep = ' · '
  const i = actual.indexOf(sep)
  if (i === -1) return ''
  return actual.slice(i + sep.length).trim()
}

function secondsToDurationInput(sec: number): string {
  const s = Math.max(0, Math.floor(sec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = s % 60
  return formatDurationTokensForInput(h, m, ss)
}

/** Разбор «фактическое время: …» из строки actual (если нет timeSpentSeconds в данных) */
function parseActualSecondsFromStageActual(actual: string): number | undefined {
  const idx = actual.indexOf(' · ')
  const head = idx >= 0 ? actual.slice(0, idx).trim() : actual.trim()
  const m = head.match(/^фактическое время:\s*(.+)$/i)
  if (!m) return undefined
  const inner = m[1].trim()
  if (!inner || inner === '—') return undefined
  const p = parseDurationRuPhrase(inner)
  if (!p) return undefined
  return p.h * 3600 + p.m * 60 + p.s
}

/** Строка actual и секунды из формы этапа */
export function buildActualFromStageForm(data: CreateStageForm): {
  timeSpentSeconds?: number
  actual: string
} {
  const comment = data.comment.trim()
  const trimmed = data.actualTime.trim()
  let sec: number | undefined
  if (trimmed) {
    const p = parseDurationTokensLoose(trimmed)
    if (p != null) sec = p.h * 3600 + p.m * 60 + p.s
  }
  const timePhrase = sec == null ? '—' : formatDurationRu(sec)
  const actual = comment
    ? `фактическое время: ${timePhrase} · ${comment}`
    : `фактическое время: ${timePhrase}`
  return {
    timeSpentSeconds: sec,
    actual,
  }
}

/** Заполняет форму редактирования из модели этапа */
export function stageToForm(stage: ProjectStage): CreateStageForm {
  const planned = stage.planned
  let cost = ''
  const costMatch = planned.match(/Стоимость этапа:\s*([^·]+)/)
  if (costMatch) cost = costDigitsFromPlannedSegment(costMatch[1])

  let paymentStatus: CreateStageForm['paymentStatus'] =
    parsePaymentFromPlanned(planned) ?? 'Ожидает оплаты'
  const tag0 = stage.modalTags?.[0]
  if (
    tag0 &&
    (PAYMENT_STATUSES as readonly string[]).includes(tag0)
  ) {
    paymentStatus = tag0 as CreateStageForm['paymentStatus']
  }

  const comment =
    stage.description?.trim() ||
    commentFromActual(stage.actual) ||
    ''

  const deadline = stage.deadline === '—' ? '' : stage.deadline
  const plannedTime = plannedTimeInputFromPlanned(planned)

  let actualTime = ''
  if (stage.timeSpentSeconds != null && stage.timeSpentSeconds >= 0) {
    actualTime = secondsToDurationInput(stage.timeSpentSeconds)
  } else {
    const parsed = parseActualSecondsFromStageActual(stage.actual)
    if (parsed != null) actualTime = secondsToDurationInput(parsed)
  }

  return {
    name: stage.name,
    plannedTime,
    actualTime,
    cost,
    comment,
    deadline,
    stageStatus: normalizeStageStatus(stage.status),
    paymentStatus,
    checklist:
      stage.checklist?.map((c) => ({
        id: c.id,
        label: c.label,
        done: c.done,
      })) ?? [],
  }
}
