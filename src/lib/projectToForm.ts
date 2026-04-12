import { parseAmountRub } from './parseAmountRub'
import type { Project } from '../types/project'
import {
  PROJECT_PAYMENT_STATUSES,
  PROJECT_SECTIONS,
  PROJECT_STATUSES,
  type CreateProjectForm,
} from '../types/projectForm'

export function projectToForm(p: Project): CreateProjectForm {
  let projectStatus: CreateProjectForm['projectStatus'] = 'В работе'
  let paymentStatus: CreateProjectForm['paymentStatus'] = 'Ожидает оплаты'
  let section: CreateProjectForm['section'] = 'Разработка'

  for (const t of p.tags ?? []) {
    if ((PROJECT_STATUSES as readonly string[]).includes(t)) {
      projectStatus = t as CreateProjectForm['projectStatus']
    }
    if ((PROJECT_PAYMENT_STATUSES as readonly string[]).includes(t)) {
      paymentStatus = t as CreateProjectForm['paymentStatus']
    }
    if ((PROJECT_SECTIONS as readonly string[]).includes(t)) {
      section = t as CreateProjectForm['section']
    }
  }

  const rub = parseAmountRub(p.amount)
  const rate = p.employeeHourlyRateRub
  return {
    title: p.title,
    client: p.client,
    clientId: p.clientId ?? '',
    cost: String(Math.max(0, rub)),
    hourlyRate:
      rate != null && rate > 0 ? String(Math.max(0, Math.floor(rate))) : '',
    comment: p.comment ?? '',
    deadline: p.deadline === '—' ? '' : p.deadline,
    projectStatus,
    paymentStatus,
    section,
  }
}
