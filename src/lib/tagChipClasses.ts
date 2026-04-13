const chipTypography =
  'inline-flex items-center text-[10px] font-light uppercase leading-none tracking-[-0.02em]'

const chipDefault = `${chipTypography} rounded-full border border-ink/12 bg-ink/[0.03] px-2.5 py-1 text-ink/80 dark:border-white/12 dark:bg-white/[0.04] dark:text-ink/75`

const chipInWork = `${chipTypography} rounded-[3px] border border-solid border-[rgb(91,194,91)] bg-[rgba(8,152,7,0.04)] p-1 text-ink/80 dark:text-ink/75`
const chipDone = `${chipTypography} rounded-[3px] border border-solid border-[rgb(194,91,91)] bg-[rgba(194,91,91,0.04)] p-1 text-ink/80 dark:text-ink/75`
const chipAwaiting = `${chipTypography} rounded-[3px] border border-solid border-[rgb(255,191,84)] bg-[rgba(255,191,84,0.04)] p-1 text-ink/80 dark:text-ink/75`
const chipPaused = `${chipTypography} rounded-[3px] border border-solid border-[rgb(255,85,85)] bg-[rgba(255,85,85,0.04)] p-1 text-ink/80 dark:text-ink/75`
const chipStagedPayment = `${chipTypography} rounded-[3px] border border-solid border-[rgb(64,150,255)] bg-[rgba(64,150,255,0.04)] p-1 text-ink/80 dark:text-ink/75`

const stageStatusByNorm: Record<string, string> = {
  'в работе': chipInWork,
  завершен: chipDone,
  завершён: chipDone,
  ожидает: chipAwaiting,
  'на паузе': chipPaused,
}

/** Чип статуса этапа (карточка этапа на странице проекта). */
export function stageStatusChipClass(status: string): string {
  const s = status.trim().toLowerCase()
  return stageStatusByNorm[s] ?? chipDefault
}

/**
 * Чип тега на карточке проекта: статус проекта, оплата, раздел.
 * Оплату проверяем раньше, чтобы «ожидает оплаты» не путать с «ожидает».
 */
export function projectCardTagChipClass(tag: string): string {
  const s = tag.trim().toLowerCase()
  if (s === 'ожидает оплаты') return chipAwaiting
  if (s === 'оплачено') return chipInWork
  if (s === 'поэтапная оплата') return chipStagedPayment
  return stageStatusChipClass(tag)
}

/** Строки в шапке модалки этапа: статус, «дедлайн: …», оплата из modalTags. */
export function modalStageHeaderChipClass(label: string): string {
  if (label.trim().toLowerCase().startsWith('дедлайн:')) return chipDefault
  return projectCardTagChipClass(label)
}
