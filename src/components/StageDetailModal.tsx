import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { modalEdgeBorderClass } from '../lib/formInputClasses'
import { partitionProjectCardTags } from '../lib/projectSection'
import {
  modalStageHeaderChipClass,
  projectCardTagChipClass,
} from '../lib/tagChipClasses'
import { formatDurationRu } from '../lib/formatDurationRu'
import { stagePlannedRows } from '../lib/stagePlannedRows'
import type { Project, ProjectStage } from '../types/project'

const CARD_FALLBACK_TAGS = ['Ожидает оплаты', 'В работе', 'Разработка'] as const

type Props = {
  project: Project
  stage: ProjectStage
  /** Суммарное фактическое время по проекту (все этапы + активный таймер) */
  projectTrackedSeconds: number
  /** Сеанс таймера на этапе (идёт или на паузе) — для подписи кнопки */
  timerSessionActive: boolean
  onToggleTimer: () => void
  onToggleChecklistItem: (itemId: string) => void
  onClose: () => void
  onEdit: () => void
}

export function StageDetailModal({
  project,
  stage,
  projectTrackedSeconds,
  timerSessionActive,
  onToggleTimer,
  onToggleChecklistItem,
  onClose,
  onEdit,
}: Props) {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const tags = project.tags ?? CARD_FALLBACK_TAGS
  const { section: cardSection, chipTags: cardChipTags } =
    partitionProjectCardTags(tags)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  useFocusTrap(true, panelRef)

  const description =
    stage.description ??
    'Дополнительное описание этапа можно добавить при создании или редактировании.'

  const headerTags = [
    stage.status,
    `дедлайн: ${stage.deadline}`,
    ...(stage.modalTags ?? []),
  ]

  const node = (
    <div className="fixed inset-0 z-[60] flex justify-end">
      <button
        type="button"
        className="ui-modal-backdrop absolute inset-0 bg-surface/40 backdrop-blur-[5px]"
        aria-label="Закрыть"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`ui-modal-panel-right relative flex h-full max-h-[100dvh] min-h-0 w-full max-w-[525px] flex-col border-l ${modalEdgeBorderClass} bg-surface shadow-none`}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-card-border py-3 pl-[max(1.5rem,env(safe-area-inset-left))] pr-[max(1.5rem,env(safe-area-inset-right))] pt-[max(0.75rem,env(safe-area-inset-top))] sm:hidden">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex text-sm font-light tracking-[-0.02em] text-ink underline-offset-4 outline-none ring-ink transition-opacity hover:underline hover:opacity-90 focus-visible:ring-2"
            aria-label="Вернуться к проекту"
          >
            ← К проекту
          </button>
          <button
            type="button"
            onClick={onToggleTimer}
            className="rounded-full border border-black bg-black px-4 py-2 text-sm font-light tabular-nums tracking-[-0.04em] text-white transition-[background-color,opacity] duration-200 hover:bg-neutral-900 active:opacity-90"
          >
            {timerSessionActive ? 'Остановить таймер' : 'Запустить таймер'}
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-6 sm:px-10 sm:pt-16">
          <span id={titleId} className="sr-only">
            {stage.name}
          </span>

          <div className="flex max-w-[445px] flex-col justify-between gap-2.5 rounded-[3px] border border-card-border p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 flex flex-col gap-3">
                <h2 className="text-[24px] font-light leading-[0.9] tracking-[-0.09em]">
                  {project.title}
                </h2>
                <p className="text-[14px] font-light leading-[0.9] tracking-[-0.09em]">
                  {project.client}
                </p>
              </div>
              {cardSection ? (
                <span className="max-w-[45%] shrink-0 pt-0.5 text-right text-[10px] font-light uppercase leading-none tracking-[-0.02em] text-ink/65">
                  {cardSection}
                </span>
              ) : null}
            </div>
            <div className="mt-4 flex flex-col gap-2.5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  {cardChipTags.map((label, i) => (
                    <span
                      key={`${label}-${i}`}
                      className={projectCardTagChipClass(label)}
                    >
                      {label}
                    </span>
                  ))}
                </div>
                <span className="shrink-0 text-base font-light leading-[0.9] tracking-[-0.09em]">
                  {project.amount}
                </span>
              </div>
              <div className="h-0.5 w-full overflow-hidden rounded-full bg-progress-track">
                <div
                  className="h-full rounded-full bg-ink transition-[width] duration-500 ease-out"
                  style={{ width: `${project.progress}%` }}
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-[10px] font-light uppercase leading-none tracking-[-0.02em]">
                <span>
                  дедлайн: {project.deadline}
                  <span className="text-ink/65">
                    {' '}
                    · фактическое время:{' '}
                    {formatDurationRu(projectTrackedSeconds)}
                  </span>
                </span>
                <span>{project.progress}%</span>
              </div>
            </div>
          </div>

          <p className="mt-10 max-w-[445px] text-base font-light leading-[1.4] tracking-[-0.06em] text-ink">
            {description}
          </p>

          <div className="mt-10 flex max-w-[445px] flex-col gap-6 border border-card-border p-5">
            <div className="flex flex-col gap-5">
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                {headerTags.map((label, i) => (
                  <span
                    key={`${label}-${i}`}
                    className={modalStageHeaderChipClass(label)}
                  >
                    {label}
                  </span>
                ))}
              </div>
              <h3 className="text-[32px] font-light leading-[0.9] tracking-[-0.09em]">
                {stage.name}
              </h3>
            </div>
            <div className={`flex flex-col gap-3 border-t pt-5 ${modalEdgeBorderClass}`}>
              {stagePlannedRows(stage.planned).map((line, i) => (
                <p
                  key={i}
                  className="text-[10px] font-light uppercase leading-relaxed tracking-[-0.02em] text-ink/90"
                >
                  {line}
                </p>
              ))}
            </div>
            {stage.checklist && stage.checklist.length > 0 ? (
              <div className={`flex flex-col gap-3 border-t pt-5 ${modalEdgeBorderClass}`}>
                {stage.checklist.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onToggleChecklistItem(item.id)}
                    className={`flex w-full cursor-pointer items-start gap-2.5 text-left outline-none ring-ink transition-opacity hover:opacity-90 focus-visible:ring-2 ${item.done ? 'opacity-60' : ''}`}
                  >
                    <span
                      className={`mt-1.5 h-2 w-2 shrink-0 border border-ink ${item.done ? 'bg-ink' : ''}`}
                      aria-hidden
                    />
                    <span className="text-base font-light leading-[1.4] tracking-[-0.06em]">
                      {item.label}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="mt-8 flex max-w-[445px] flex-wrap gap-2 sm:hidden">
            <button
              type="button"
              onClick={onEdit}
              className="h-8 rounded-full bg-fill-contrast-bg px-5 text-sm font-light tracking-[-0.05em] text-fill-contrast-fg transition-opacity hover:opacity-90"
            >
              Редактировать этап
            </button>
          </div>
          <div className="pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:hidden" aria-hidden />
        </div>

        <div className="hidden shrink-0 border-t border-card-border bg-surface px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:flex sm:flex-wrap sm:items-center sm:justify-between sm:gap-3 sm:px-10 sm:py-6">
          <button
            type="button"
            className="h-8 rounded-full bg-fill-contrast-bg px-5 text-sm font-light tracking-[-0.05em] text-fill-contrast-fg transition-opacity hover:opacity-90"
            onClick={onEdit}
          >
            Редактировать этап
          </button>
        </div>
      </div>
    </div>
  )

  return createPortal(node, document.body)
}
