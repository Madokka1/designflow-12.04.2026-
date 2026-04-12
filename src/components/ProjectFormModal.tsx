import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { CostRubInput } from './CostRubInput'
import { DeadlineDdMmYyyyInput } from './DeadlineDdMmYyyyInput'
import {
  formInputUnderlineClass,
  modalEdgeBorderClass,
} from '../lib/formInputClasses'
import { formatRubDots } from '../lib/parseAmountRub'
import { sumStageCostsRub } from '../lib/stageCostSum'
import {
  PROJECT_PAYMENT_STATUSES,
  PROJECT_SECTIONS,
  PROJECT_STATUSES,
  type CreateProjectForm,
} from '../types/projectForm'
import type { ProjectStage } from '../types/project'
import type { WorkspaceClient } from '../types/workspaceClient'

type Props = {
  title: string
  submitLabel: string
  initialForm: CreateProjectForm
  onClose: () => void
  onSubmit: (data: CreateProjectForm) => void
  zClassName?: string
  /** Справочник клиентов: подставить имя и clientId */
  clientsForPicker?: readonly WorkspaceClient[]
  /** Шаблон этапов при создании проекта */
  templateSelect?: {
    value: string
    onChange: (templateId: string) => void
    options: { id: string; name: string }[]
  }
  /** Редактирование: показать опасную зону «Удалить проект». */
  showDeleteProject?: boolean
  onDeleteProject?: () => void | Promise<void>
  /**
   * Этапы для предпросмотра суммы при «поэтапная оплата» (редактирование проекта или шаблон при создании).
   * Без пропа считается как пустой список.
   */
  stagedPaymentPreviewStages?: readonly ProjectStage[]
}

function ChipRow<T extends string>({
  options,
  value,
  onChange,
  name,
}: {
  options: readonly T[]
  value: T
  onChange: (v: T) => void
  name: string
}) {
  return (
    <div className="flex flex-wrap items-center gap-2.5" role="group" aria-label={name}>
      {options.map((opt) => {
        const selected = value === opt
        return (
          <button
            key={opt}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(opt)}
            className={`rounded-[5px] border border-ink px-1.5 py-1 text-[10px] font-light uppercase leading-none tracking-[-0.02em] transition-colors duration-150 ${
              selected ? 'bg-ink/10' : 'bg-surface hover:bg-ink/5'
            }`}
          >
            {opt}
          </button>
        )
      })}
    </div>
  )
}

export function ProjectFormModal({
  title,
  submitLabel,
  initialForm,
  onClose,
  onSubmit,
  zClassName = 'z-50',
  clientsForPicker,
  templateSelect,
  showDeleteProject,
  onDeleteProject,
  stagedPaymentPreviewStages,
}: Props) {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const [form, setForm] = useState<CreateProjectForm>(() => ({ ...initialForm }))

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

  const update = <K extends keyof CreateProjectForm>(key: K, v: CreateProjectForm[K]) =>
    setForm((f) => ({ ...f, [key]: v }))

  const reset = () => setForm({ ...initialForm })

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    onSubmit(form)
  }

  const inputClass = formInputUnderlineClass

  const node = (
    <div className={`fixed inset-0 flex justify-end ${zClassName}`}>
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
        className={`ui-modal-panel-right relative flex h-full w-full max-w-[960px] flex-col border-l ${modalEdgeBorderClass} bg-surface shadow-none`}
      >
        <form className="flex h-full min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
          <div className="flex shrink-0 items-center border-b border-card-border py-3 pl-[max(1.5rem,env(safe-area-inset-left))] pr-[max(1.5rem,env(safe-area-inset-right))] pt-[max(0.75rem,env(safe-area-inset-top))] sm:hidden">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex text-sm font-light tracking-[-0.02em] text-ink underline-offset-4 outline-none ring-ink transition-opacity hover:underline hover:opacity-90 focus-visible:ring-2"
            >
              ← Закрыть
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-6 sm:px-10 sm:pb-6 sm:pt-20">
            <h2
              id={titleId}
              className="text-[clamp(2rem,5vw,4rem)] font-light leading-[0.9] tracking-[-0.09em]"
            >
              {title}
            </h2>

            <div className="mt-10 flex max-w-[865px] flex-col gap-12 sm:gap-[50px]">
              {templateSelect && templateSelect.options.length > 0 ? (
                <label className="block max-w-md">
                  <span className="mb-1 block text-[10px] font-light uppercase tracking-[-0.02em] text-ink/55">
                    Шаблон этапов (необязательно)
                  </span>
                  <select
                    className={`${inputClass} cursor-pointer`}
                    value={templateSelect.value}
                    onChange={(e) => templateSelect.onChange(e.target.value)}
                  >
                    <option value="">Без шаблона</option>
                    {templateSelect.options.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <div className="flex flex-col gap-5">
                <label className="block">
                  <span className="sr-only">Название проекта</span>
                  <input
                    className={inputClass}
                    placeholder="Название проекта"
                    value={form.title}
                    onChange={(e) => update('title', e.target.value)}
                    autoFocus
                  />
                </label>
                {clientsForPicker && clientsForPicker.length > 0 ? (
                  <label className="block max-w-md">
                    <span className="mb-1 block text-[10px] font-light uppercase tracking-[-0.02em] text-ink/55">
                      Клиент из справочника
                    </span>
                    <select
                      className={`${inputClass} cursor-pointer`}
                      value={form.clientId}
                      onChange={(e) => {
                        const id = e.target.value
                        if (!id) {
                          update('clientId', '')
                          return
                        }
                        const c = clientsForPicker.find((x) => x.id === id)
                        setForm((f) => ({
                          ...f,
                          clientId: id,
                          client: c?.name ?? f.client,
                        }))
                      }}
                    >
                      <option value="">Вручную (поле ниже)</option>
                      {clientsForPicker.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                          {c.company ? ` — ${c.company}` : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                <label className="block">
                  <span className="sr-only">Клиент</span>
                  <input
                    className={inputClass}
                    placeholder="Клиент"
                    value={form.client}
                    onChange={(e) => update('client', e.target.value)}
                  />
                </label>
                {form.paymentStatus === 'поэтапная оплата' ? (
                  <div className="block">
                    <span className="mb-1 block text-[10px] font-light uppercase tracking-[-0.02em] text-ink/55">
                      Стоимость проекта
                    </span>
                    <p className="border-b border-[var(--color-form-border)] py-2.5 text-base font-light leading-[0.9] tracking-[-0.04em] text-ink">
                      {formatRubDots(
                        sumStageCostsRub(stagedPaymentPreviewStages ?? []),
                      )}
                    </p>
                    <p className="mt-1.5 text-xs font-light leading-snug tracking-[-0.02em] text-ink/55">
                      Сумма только по этапам со статусом оплаты «оплачено»; при
                      сохранении и при изменении этапов пересчитывается
                      автоматически.
                    </p>
                  </div>
                ) : (
                  <label className="block">
                    <span className="sr-only">Стоимость проекта</span>
                    <CostRubInput
                      inputClass={inputClass}
                      placeholder="Только цифры, напр. 10000"
                      aria-label="Стоимость проекта"
                      valueDigits={form.cost}
                      onChangeDigits={(d) => update('cost', d)}
                    />
                  </label>
                )}
                <label className="block">
                  <span className="mb-1 block text-[10px] font-light uppercase tracking-[-0.02em] text-ink/55">
                    Стоимость часа сотрудника (руб/ч)
                  </span>
                  <CostRubInput
                    inputClass={inputClass}
                    placeholder="Только цифры, напр. 2000"
                    aria-label="Стоимость часа сотрудника в рублях за час"
                    valueDigits={form.hourlyRate}
                    onChangeDigits={(d) => update('hourlyRate', d)}
                  />
                </label>
              </div>

              <div className="flex max-w-[405px] flex-col gap-10">
                <div className="flex flex-col gap-5">
                  <p className="text-base font-light leading-[0.9] tracking-[-0.09em] text-ink">
                    Статус проекта
                  </p>
                  <ChipRow
                    name="Статус проекта"
                    options={PROJECT_STATUSES}
                    value={form.projectStatus}
                    onChange={(v) => update('projectStatus', v)}
                  />
                </div>
                <div className="flex flex-col gap-5">
                  <p className="text-base font-light leading-[0.9] tracking-[-0.09em] text-ink">
                    Статус оплаты
                  </p>
                  <ChipRow
                    name="Статус оплаты"
                    options={PROJECT_PAYMENT_STATUSES}
                    value={form.paymentStatus}
                    onChange={(v) => update('paymentStatus', v)}
                  />
                </div>
                <div className="flex flex-col gap-5">
                  <p className="text-base font-light leading-[0.9] tracking-[-0.09em] text-ink">
                    Раздел
                  </p>
                  <ChipRow
                    name="Раздел"
                    options={PROJECT_SECTIONS}
                    value={form.section}
                    onChange={(v) => update('section', v)}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-5">
                <label className="block">
                  <span className="sr-only">Комментарий</span>
                  <textarea
                    className={`${inputClass} min-h-[4.5rem] resize-y border-b`}
                    placeholder="Комментарий"
                    rows={3}
                    value={form.comment}
                    onChange={(e) => update('comment', e.target.value)}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[10px] font-light uppercase tracking-[-0.02em] text-ink/55">
                    Дедлайн
                  </span>
                  <DeadlineDdMmYyyyInput
                    inputClass={inputClass}
                    aria-label="Дедлайн проекта"
                    value={form.deadline}
                    onChange={(v) => update('deadline', v)}
                  />
                </label>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-card-border bg-surface px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-10 sm:py-6">
            <button
              type="submit"
              className="h-8 rounded-full bg-fill-contrast-bg px-5 text-sm font-light tracking-[-0.05em] text-fill-contrast-fg transition-opacity hover:opacity-90"
            >
              {submitLabel}
            </button>
            <div className="flex flex-wrap items-center justify-end gap-3 sm:gap-4">
              <button
                type="button"
                className="h-8 rounded-full border border-card-border bg-surface px-5 text-sm font-light tracking-[-0.05em] text-ink transition-colors hover:bg-ink/[0.04]"
                onClick={onClose}
              >
                Отмена
              </button>
              <button
                type="button"
                className="h-8 rounded-full bg-fill-contrast-bg px-5 text-sm font-light tracking-[-0.05em] text-fill-contrast-fg transition-opacity hover:opacity-90"
                onClick={reset}
              >
                Сбросить
              </button>
              {showDeleteProject && onDeleteProject ? (
                <button
                  type="button"
                  className="h-8 rounded-full bg-fill-contrast-bg px-5 text-sm font-light tracking-[-0.05em] text-fill-contrast-fg transition-opacity hover:opacity-90"
                  onClick={() => {
                    if (
                      !window.confirm(
                        'Удалить проект безвозвратно? Данные в Supabase и этапы будут удалены.',
                      )
                    ) {
                      return
                    }
                    void onDeleteProject()
                  }}
                  aria-label="Удалить проект"
                >
                  Удалить проект
                </button>
              ) : null}
            </div>
          </div>
        </form>
      </div>
    </div>
  )

  return createPortal(node, document.body)
}
