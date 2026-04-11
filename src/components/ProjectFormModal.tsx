import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { CostRubInput } from './CostRubInput'
import {
  formInputUnderlineClass,
  modalEdgeBorderClass,
} from '../lib/formInputClasses'
import {
  PROJECT_PAYMENT_STATUSES,
  PROJECT_SECTIONS,
  PROJECT_STATUSES,
  type CreateProjectForm,
} from '../types/projectForm'

type Props = {
  title: string
  submitLabel: string
  initialForm: CreateProjectForm
  onClose: () => void
  onSubmit: (data: CreateProjectForm) => void
  zClassName?: string
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
        <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-32 pt-16 sm:px-10 sm:pt-20">
            <h2
              id={titleId}
              className="text-[clamp(2rem,5vw,4rem)] font-light leading-[0.9] tracking-[-0.09em]"
            >
              {title}
            </h2>

            <div className="mt-10 flex max-w-[865px] flex-col gap-12 sm:gap-[50px]">
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
                <label className="block">
                  <span className="sr-only">Клиент</span>
                  <input
                    className={inputClass}
                    placeholder="Клиент"
                    value={form.client}
                    onChange={(e) => update('client', e.target.value)}
                  />
                </label>
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
                  <span className="sr-only">Дедлайн</span>
                  <input
                    className={inputClass}
                    placeholder="Дедлайн"
                    value={form.deadline}
                    onChange={(e) => update('deadline', e.target.value)}
                  />
                </label>
              </div>
            </div>
          </div>

          <div className="absolute bottom-0 left-0 right-0 flex flex-wrap items-center justify-between gap-4 border-t border-transparent bg-surface px-6 py-6 sm:px-10 sm:py-8">
            <button
              type="submit"
              className="h-8 rounded-full bg-fill-contrast-bg px-5 text-sm font-light tracking-[-0.05em] text-fill-contrast-fg transition-opacity hover:opacity-90"
            >
              {submitLabel}
            </button>
            <button
              type="button"
              className="h-8 rounded-full bg-fill-contrast-bg px-5 text-sm font-light tracking-[-0.05em] text-fill-contrast-fg transition-opacity hover:opacity-90"
              onClick={reset}
            >
              Сбросить
            </button>
          </div>
        </form>
      </div>
    </div>
  )

  return createPortal(node, document.body)
}
