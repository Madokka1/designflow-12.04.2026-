export const STAGE_STATUSES = [
  'В работе',
  'ожидает',
  'на паузе',
  'завершен',
] as const

export const PAYMENT_STATUSES = [
  'оплачено',
  'Ожидает оплаты',
  'поэтапная оплата',
] as const

export type StageChecklistDraft = {
  id: string
  label: string
  done?: boolean
}

export type CreateStageForm = {
  name: string
  /** Свободный текст, напр. «40ч 30мин» */
  plannedTime: string
  cost: string
  comment: string
  deadline: string
  stageStatus: (typeof STAGE_STATUSES)[number]
  paymentStatus: (typeof PAYMENT_STATUSES)[number]
  checklist: StageChecklistDraft[]
}

export function defaultStageForm(): CreateStageForm {
  return {
    name: '',
    plannedTime: '',
    cost: '',
    comment: '',
    deadline: '',
    stageStatus: 'В работе',
    paymentStatus: 'Ожидает оплаты',
    checklist: [],
  }
}
