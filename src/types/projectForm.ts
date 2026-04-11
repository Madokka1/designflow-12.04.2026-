export const PROJECT_STATUSES = [
  'В работе',
  'ожидает',
  'на паузе',
  'завершен',
] as const

export const PROJECT_PAYMENT_STATUSES = [
  'оплачено',
  'Ожидает оплаты',
  'поэтапная оплата',
] as const

export const PROJECT_SECTIONS = [
  'Разработка',
  'Поддержка',
  'Личные',
  'Архив',
] as const

export type CreateProjectForm = {
  title: string
  client: string
  cost: string
  comment: string
  deadline: string
  projectStatus: (typeof PROJECT_STATUSES)[number]
  paymentStatus: (typeof PROJECT_PAYMENT_STATUSES)[number]
  section: (typeof PROJECT_SECTIONS)[number]
}

export function defaultProjectForm(): CreateProjectForm {
  return {
    title: '',
    client: '',
    cost: '',
    comment: '',
    deadline: '',
    projectStatus: 'В работе',
    paymentStatus: 'Ожидает оплаты',
    section: 'Разработка',
  }
}
