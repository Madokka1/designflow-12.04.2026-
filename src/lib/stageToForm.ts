import {
  formatDurationTokensForInput,
  parseDurationRuPhrase,
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

  return {
    name: stage.name,
    plannedTime,
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
